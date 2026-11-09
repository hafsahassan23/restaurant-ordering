import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  UtensilsCrossed, ReceiptText, Search, ShoppingBag, Clock, Plus, Trash2, X, Check, ChefHat,
  BellRing, Hourglass, Lock, AlertTriangle, CheckCircle2, Send,
} from "lucide-react";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import DishSheet, { DishImage } from "../components/DishSheet.jsx";
import { Alert, Button, EmptyState, LoadingState } from "../components/ui.jsx";
import { api } from "../lib/api";
import { tableSocket } from "../lib/socket";
import { money, pick } from "../lib/format";

// Progress of one item: received → confirmed → cooking → ready → served
const STEPS = [
  { key: "waiting", Icon: Hourglass, so: "La diray", en: "Received" },
  { key: "confirmed", Icon: Check, so: "La xaqiijiyay", en: "Confirmed" },
  { key: "cooking", Icon: ChefHat, so: "Karinta", en: "Cooking" },
  { key: "ready", Icon: BellRing, so: "Diyaar", en: "Ready" },
  { key: "served", Icon: UtensilsCrossed, so: "La keenay", en: "Served" },
];

function itemStage(item, order) {
  if (order.status === "pending_confirmation") return 0;
  const stages = { pending: 1, ordered: 1, confirmed: 1, cooking: 2, ready: 3, served: 4 };
  return stages[String(item.status || "").toLowerCase()] ?? 1;
}

const STATUS = {
  pending_confirmation: ["Sugaya xaqiijinta waiter-ka", "Waiting for waiter", "bg-amber-50 text-amber-800 ring-amber-200"],
  pending: ["La xaqiijiyay", "Confirmed", "bg-blue-50 text-blue-700 ring-blue-200"],
  ordered: ["Jikada ayaa loo diray", "Sent to kitchen", "bg-blue-50 text-blue-700 ring-blue-200"],
  confirmed: ["La xaqiijiyay", "Confirmed", "bg-blue-50 text-blue-700 ring-blue-200"],
  cooking: ["Waa la karinayaa", "Cooking", "bg-amber-50 text-amber-800 ring-amber-200"],
  ready: ["Waa diyaar", "Ready", "bg-green-50 text-green-700 ring-green-200"],
  served: ["Miiska ayaa laguu keenay", "Served", "bg-violet-50 text-violet-700 ring-violet-200"],
  closed: ["La xiray", "Closed", "bg-slate-100 text-slate-600 ring-slate-200"],
  rejected: ["Waa la diiday", "Rejected", "bg-red-50 text-red-700 ring-red-200"],
  cancelled: ["Waa la joojiyay", "Cancelled", "bg-red-50 text-red-700 ring-red-200"],
};

function StatusLabel({ status, isSo }) {
  const [so, en, cls] = STATUS[status] || ["Dalabka waa la helay", "Order received", "bg-slate-100 text-slate-600 ring-slate-200"];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{isSo ? so : en}</span>;
}

function OrderProgress({ stage, isSo }) {
  return (
    <ol className="mt-4 grid grid-cols-5">
      {STEPS.map((step, index) => {
        const done = index < stage;
        const current = index === stage;
        const Icon = done ? Check : step.Icon;
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center">
            {index > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${index <= stage ? "bg-brand" : "bg-slate-200"}`} aria-hidden="true" />}
            <span
              className={`relative z-10 grid h-8 w-8 place-items-center rounded-full ${
                done ? "bg-brand text-white" : current ? "bg-brand text-white ring-4 ring-brand-100" : "bg-slate-100 text-slate-400"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${index <= stage ? "font-semibold text-brand-dark" : "text-slate-400"}`}>
              {isSo ? step.so : step.en}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Customer phone after scanning the table QR: browse, choose, send, and follow the order live. */
export default function Customer() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const isSo = lang.startsWith("so");
  const text = (so, en) => (isSo ? so : en);

  const [table, setTable] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [menu, setMenu] = useState(null);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState(null);
  const [tab, setTab] = useState("menu");
  const [sheet, setSheet] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMenu = useCallback(() => {
    api("/public/menu").then(setMenu).catch(() => setError(t("common.error")));
  }, [t]);

  const loadOrders = useCallback(() => {
    api(`/public/table/${token}/orders`).then(setOrders).catch(() => {});
  }, [token]);

  useEffect(() => {
    let mounted = true;
    api(`/public/table/${token}`)
      .then((data) => mounted && setTable(data))
      .catch(() => mounted && setInvalid(true));
    loadMenu();
    loadOrders();

    const socket = tableSocket(token);
    ["order:pending", "order:confirmed", "order:rejected", "order:moved", "item:updated", "order:served"].forEach((event) => socket.on(event, loadOrders));
    socket.on("connect", () => {
      loadOrders();
      loadMenu();
    });
    socket.on("menu:updated", loadMenu);
    // The manager regenerated this table's QR: this link no longer works
    socket.on("table:token-revoked", () => setInvalid(true));
    socket.on("connect_error", (err) => {
      if (err?.message === "unauthorized") setInvalid(true);
    });
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [token, loadMenu, loadOrders]);

  const categories = useMemo(() => menu || [], [menu]);
  const active = categories.find((c) => c.id === cat) || categories[0];

  // Searching looks through every category; otherwise show the chosen category.
  const visibleDishes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return categories.flatMap((c) => c.dishes).filter((d) => `${d.name_so} ${d.name_en}`.toLowerCase().includes(q));
    return active ? active.dishes : [];
  }, [categories, active, search]);

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeOrders = orders.filter((order) => !["cancelled", "rejected", "paid", "closed"].includes(order.status));

  async function sendOrder() {
    setSending(true);
    setError("");
    try {
      await api("/public/orders", {
        method: "POST",
        body: {
          tableToken: token,
          items: cart.map((item) => ({ dishId: item.dishId, quantity: item.quantity, notes: item.notes || undefined, modifierIds: item.modifierIds })),
        },
      });
      setCart([]);
      setShowCart(false);
      setTab("orders");
      setNotice(text("Dalabkaaga waa la diray. Sug xaqiijinta waiter-ka.", "Your order has been sent. Your waiter will confirm it shortly."));
      loadOrders();
    } catch (e) {
      if (e.code === "TABLE_CLOSED") setTable((old) => ({ ...old, is_closed: true }));
      else if (e.code === "TABLE_PAYING") setError(t("customer.paying"));
      else if (e.code === "DISH_UNAVAILABLE" || e.code === "MODIFIER_UNAVAILABLE") {
        setError(t("customer.unavailableErr"));
        loadMenu();
      } else setError(e.message || t("common.error"));
    } finally {
      setSending(false);
    }
  }

  if (invalid || table?.is_closed) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-5">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <span className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full ${invalid ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
            {invalid ? <AlertTriangle className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
          </span>
          <h1 className="text-xl font-bold">{invalid ? t("customer.invalidTable") : t("customer.closed")}</h1>
          <p className="mt-2 text-sm text-muted">{text("Fadlan la xiriir shaqaalaha maqaayadda si laguu caawiyo.", "Please ask a member of staff for help.")}</p>
          <div className="mt-6 flex justify-center">
            <LanguageSwitch />
          </div>
        </div>
      </main>
    );
  }

  if (!menu || !table) return <LoadingState className="min-h-screen" />;

  return (
    <div className="min-h-screen bg-surface pb-36 sm:pb-28">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white">
              <UtensilsCrossed className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold">{t("app.name")}</div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {text("Miiska", "Table")} {table.number}
                {table.area ? ` · ${table.area}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg bg-slate-100 p-0.5 sm:flex">
              {[
                ["menu", UtensilsCrossed, text("Cuntada", "Menu")],
                ["orders", ReceiptText, text("Dalabyadayda", "My orders")],
              ].map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition ${tab === id ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {id === "orders" && activeOrders.length > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-ink">{activeOrders.length}</span>
                  )}
                </button>
              ))}
            </div>
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {notice && (
          <Alert tone="success" onClose={() => setNotice("")}>
            {notice}
          </Alert>
        )}
        {error && <Alert onClose={() => setError("")}>{error}</Alert>}

        {/* MENU */}
        {tab === "menu" && (
          <>
            {/* Welcome banner */}
            <section className="relative mb-5 overflow-hidden rounded-2xl bg-brand-900 text-white">
              <img src="/images/cover.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/80 to-transparent" />
              <div className="relative px-5 py-7 sm:px-8 sm:py-10">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">{text("Ku soo dhawoow", "Welcome")}</p>
                <h1 className="mt-1 max-w-md text-2xl font-bold leading-tight sm:text-3xl">{text("Maxaad maanta dalbanaysaa?", "What would you like today?")}</h1>
                <p className="mt-2 max-w-md text-sm text-white/75">
                  {text("Dooro cuntada, dir dalabka, oo si toos ah ula soco.", "Pick your dishes, send your order and follow it live.")}
                </p>
              </div>
            </section>

            {/* Search + categories (sticky under the header) */}
            <div className="sticky top-16 z-20 -mx-4 mb-5 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={text("Raadi cunto...", "Search dishes...")}
                  aria-label={text("Raadi cunto", "Search dishes")}
                  className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-10 text-[15px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label={t("common.close")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!search && (
                <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCat(category.id)}
                      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                        active?.id === category.id ? "bg-ink text-white" : "border border-line bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {pick(category, "name", lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {visibleDishes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-white">
                <EmptyState icon={UtensilsCrossed} title={text("Cunto lama helin", "No dishes found")} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {visibleDishes.map((dish) => (
                  <article
                    key={dish.id}
                    className={`flex overflow-hidden rounded-xl border border-line bg-white shadow-card transition sm:flex-col ${
                      dish.available ? "hover:shadow-md" : "opacity-70"
                    }`}
                  >
                    <div className="relative w-28 shrink-0 sm:h-44 sm:w-full">
                      <DishImage dish={dish} lang={lang} className={`h-full w-full ${dish.available ? "" : "grayscale"}`} />
                      {!dish.available && (
                        <span className="absolute inset-x-2 bottom-2 rounded-md bg-white/95 px-2 py-1 text-center text-[11px] font-bold text-red-700 shadow sm:inset-x-auto sm:left-3 sm:top-3 sm:bottom-auto">
                          {t("customer.unavailable")}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-snug">{pick(dish, "name", lang)}</h3>
                        <span className="tabular shrink-0 font-bold text-brand">{money(dish.price)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{pick(dish, "description", lang)}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {dish.prep_minutes} {t("customer.minutes")}
                        </span>
                        <button
                          type="button"
                          disabled={!dish.available}
                          onClick={() => setSheet(dish)}
                          aria-label={`${t("customer.add")}: ${pick(dish, "name", lang)}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          {t("customer.add")}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* LIVE ORDER TRACKING */}
        {tab === "orders" && (
          <section>
            <div className="mb-5">
              <h1 className="text-2xl font-bold">{text("La soco dalabkaaga", "Track your order")}</h1>
              <p className="mt-1 text-sm text-muted">{text("Waxaad si toos ah u arki kartaa halka cuntadaadu marayso.", "Every step updates live, from the waiter to your table.")}</p>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-white">
                <EmptyState icon={ReceiptText} title={text("Weli dalab ma jiro", "No orders yet")} text={text("Dooro cunto si aad u bilowdo.", "Choose dishes to get started.")}>
                  <Button onClick={() => setTab("menu")}>{text("Eeg menu-ga", "See the menu")}</Button>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <article key={order.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
                      <p className="text-sm font-semibold">
                        {text("Dalabka", "Order")} <span className="text-muted">#{order.id}</span>
                      </p>
                      <StatusLabel status={order.status} isSo={isSo} />
                    </div>

                    {order.status === "pending_confirmation" && (
                      <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:mx-5">
                        <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>{text("Waiter-ka ayaa hubinaya dalabkaaga. Marka uu xaqiijiyo waxaa loo gudbinayaa jikada.", "Your waiter is checking the order. Once confirmed it goes straight to the kitchen.")}</p>
                      </div>
                    )}

                    <ul className="divide-y divide-line">
                      {(order.items || []).map((item) => {
                        const stage = itemStage(item, order);
                        const cancelled = ["cancelled", "rejected"].includes(item.status);
                        return (
                          <li key={item.id} className="px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  <span className="tabular mr-1 text-muted">{item.quantity}×</span>
                                  {pick(item, "dish_name", lang)}
                                </p>
                                {item.notes && <p className="mt-0.5 text-xs text-muted">{item.notes}</p>}
                              </div>
                              <StatusLabel status={cancelled ? item.status : STEPS[stage].key === "waiting" ? "pending_confirmation" : item.status} isSo={isSo} />
                            </div>
                            {cancelled ? (
                              <p className="mt-2 text-sm text-red-700">{text("Qaybtan dalabka waa la joojiyay.", "This item was cancelled.")}</p>
                            ) : (
                              <OrderProgress stage={stage} isSo={isSo} />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {order.status === "rejected" && (
                      <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
                        {text("Dalabkan lama aqbalin. Fadlan la xiriir waiter-ka.", "This order was not accepted. Please speak to your waiter.")}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* FLOATING CART */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4 pb-3 sm:bottom-0 sm:pb-5">
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="mx-auto flex h-14 w-full max-w-xl items-center justify-between rounded-xl bg-ink px-4 text-white shadow-pop transition hover:bg-slate-800"
          >
            <span className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-ink">{count}</span>
              </span>
              <span className="text-sm font-semibold">{text("Eeg dalabkaaga", "View your order")}</span>
            </span>
            <span className="tabular text-lg font-bold">{money(total)}</span>
          </button>
        </div>
      )}

      {/* PHONE BOTTOM NAVIGATION */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-2 border-t border-line bg-white sm:hidden">
        {[
          ["menu", UtensilsCrossed, text("Cuntada", "Menu")],
          ["orders", ReceiptText, text("Dalabyadayda", "My orders")],
        ].map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === id ? "text-brand" : "text-slate-500"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
            {id === "orders" && activeOrders.length > 0 && (
              <span className="absolute left-1/2 top-2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">{activeOrders.length}</span>
            )}
          </button>
        ))}
      </nav>

      {sheet && (
        <DishSheet
          dish={sheet}
          lang={lang}
          onClose={() => setSheet(null)}
          onAdd={(line) => {
            setCart((current) => [...current, { ...line, key: `${Date.now()}-${Math.random()}` }]);
            setSheet(null);
            setNotice("");
          }}
        />
      )}

      {/* CART */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => setShowCart(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={text("Dalabkaaga", "Your order")}
            className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:max-w-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">{text("Dalabkaaga", "Your order")}</h2>
                <p className="text-xs text-muted">
                  {text("Miiska", "Table")} {table.number}
                </p>
              </div>
              <button type="button" onClick={() => setShowCart(false)} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5">
              {cart.length === 0 ? (
                <EmptyState icon={ShoppingBag} title={t("customer.emptyCart")} />
              ) : (
                <ul className="divide-y divide-line">
                  {cart.map((item) => (
                    <li key={item.key} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          <span className="tabular mr-1 text-muted">{item.quantity}×</span>
                          {pick(item, "name", lang)}
                        </p>
                        {(item.modifiers || []).length > 0 && <p className="mt-0.5 text-xs text-muted">{item.modifiers.map((m) => pick(m, "name", lang)).join(", ")}</p>}
                        {item.notes && <p className="mt-0.5 text-xs italic text-amber-800">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="tabular font-semibold">{money(item.unitPrice * item.quantity)}</span>
                        <button
                          type="button"
                          onClick={() => setCart((current) => current.filter((x) => x.key !== item.key))}
                          aria-label={t("customer.remove")}
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line bg-slate-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">{text("Wadarta", "Total")}</span>
                <span className="tabular text-2xl font-bold">{money(total)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {text("Dalabka waxaa loo dirayaa waiter-ka si uu u xaqiijiyo ka hor inta aan jikada loo gudbin.", "The waiter confirms your order before it goes to the kitchen.")}
              </p>
              <Button size="lg" loading={sending} disabled={cart.length === 0} onClick={sendOrder} className="mt-4 w-full">
                <Send className="h-4 w-4" aria-hidden="true" />
                {sending ? text("Waa la dirayaa...", "Sending...") : text("Dir dalabka", "Send order")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
