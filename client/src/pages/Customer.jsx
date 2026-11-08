import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import DishSheet from "../components/DishSheet.jsx";
import { api } from "../lib/api";
import { tableSocket } from "../lib/socket";
import { money, pick } from "../lib/format";

const steps = [
  { key: "waiting", icon: "✓" },
  { key: "confirmed", icon: "✓" },
  { key: "cooking", icon: "♨" },
  { key: "ready", icon: "✓" },
  { key: "served", icon: "🍽" },
];

function itemStage(item, order) {
  if (order.status === "pending_confirmation") return 0;

  const status = String(item.status || "").toLowerCase();

  const stages = {
    pending: 1,
    ordered: 1,
    confirmed: 1,
    cooking: 2,
    ready: 3,
    served: 4,
  };

  return stages[status] ?? 1;
}

function StatusLabel({ status, lang }) {
  const labels = {
    pending_confirmation: ["Sugaya xaqiijinta waiter-ka", "Waiting for waiter"],
    pending: ["La xaqiijiyay", "Confirmed"],
    ordered: ["Jikada ayaa loo diray", "Sent to kitchen"],
    confirmed: ["La xaqiijiyay", "Confirmed"],
    cooking: ["Waa la karinayaa", "Cooking"],
    ready: ["Waa diyaar", "Ready for serving"],
    served: ["Miiska ayaa laguu keenay", "Served"],
    rejected: ["Waa la diiday", "Rejected"],
    cancelled: ["Waa la joojiyay", "Cancelled"],
  };

  const [so, en] = labels[status] || ["Dalabka waa la helay", "Order received"];

  const colors = {
    pending_confirmation: "bg-amber-50 text-amber-700",
    pending: "bg-blue-50 text-blue-700",
    ordered: "bg-blue-50 text-blue-700",
    confirmed: "bg-blue-50 text-blue-700",
    cooking: "bg-orange-50 text-orange-700",
    ready: "bg-emerald-50 text-emerald-700",
    served: "bg-green-100 text-green-800",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${colors[status] || "bg-slate-100 text-slate-600"}`}
    >
      {lang.startsWith("so") ? so : en}
    </span>
  );
}

function OrderProgress({ stage, lang }) {
  const labels = lang.startsWith("so")
    ? ["La diray", "La xaqiijiyay", "Karinta", "Diyaar", "La keenay"]
    : ["Received", "Confirmed", "Cooking", "Ready", "Served"];

  return (
    <div className="mt-5">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const completed = index < stage;
          const current = index === stage;

          return (
            <div
              key={step.key}
              className="flex flex-1 items-center last:flex-none"
            >
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  completed || current
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400"
                } ${current ? "ring-4 ring-emerald-100" : ""}`}
              >
                {completed ? "✓" : step.icon}
              </div>
              {index !== steps.length - 1 && (
                <div
                  className={`h-1 flex-1 ${completed ? "bg-emerald-500" : "bg-slate-100"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {labels.map((label, index) => (
          <span
            key={label}
            className={`text-center text-[10px] leading-tight sm:text-xs ${
              index <= stage ? "font-bold text-emerald-700" : "text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

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
    api("/public/menu")
      .then(setMenu)
      .catch(() => setError(t("common.error")));
  }, [t]);

  const loadOrders = useCallback(() => {
    api(`/public/table/${token}/orders`)
      .then(setOrders)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    let mounted = true;

    api(`/public/table/${token}`)
      .then((data) => {
        if (mounted) setTable(data);
      })
      .catch(() => {
        if (mounted) setInvalid(true);
      });

    loadMenu();
    loadOrders();

    const socket = tableSocket(token);

    [
      "order:pending",
      "order:confirmed",
      "order:rejected",
      "order:moved",
      "item:updated",
      "order:served",
    ].forEach((event) => socket.on(event, loadOrders));

    socket.on("connect", () => {
      loadOrders();
      loadMenu();
    });

    socket.on("menu:updated", loadMenu);

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [token, loadMenu, loadOrders]);

  const categories = menu || [];

  const active = categories.find((c) => c.id === cat) || categories[0];

  const visibleDishes = useMemo(() => {
    if (!active) return [];

    return active.dishes.filter((dish) => {
      const name = pick(dish, "name", lang) || "";
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [active, search, lang]);

  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  const activeOrders = orders.filter(
    (order) => !["cancelled", "rejected", "paid"].includes(order.status),
  );

  async function sendOrder() {
    setSending(true);
    setError("");

    try {
      await api("/public/orders", {
        method: "POST",
        body: {
          tableToken: token,
          items: cart.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            notes: item.notes || undefined,
            modifierIds: item.modifierIds,
          })),
        },
      });

      setCart([]);
      setShowCart(false);
      setTab("orders");
      setNotice(
        text(
          "Dalabkaaga waa la diray. Sug xaqiijinta waiter-ka.",
          "Your order has been submitted. Please wait for waiter confirmation.",
        ),
      );

      loadOrders();
    } catch (e) {
      if (e.code === "TABLE_CLOSED") {
        setTable((old) => ({ ...old, is_closed: true }));
      } else if (e.code === "TABLE_PAYING") {
        setError(t("customer.paying"));
      } else if (
        e.code === "DISH_UNAVAILABLE" ||
        e.code === "MODIFIER_UNAVAILABLE"
      ) {
        setError(t("customer.unavailableErr"));
        loadMenu();
      } else {
        setError(e.message || t("common.error"));
      }
    } finally {
      setSending(false);
    }
  }

  if (invalid || table?.is_closed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-4xl">
            {invalid ? "⚠️" : "🔒"}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {invalid ? t("customer.invalidTable") : t("customer.closed")}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {text(
              "Fadlan la xiriir shaqaalaha maqaayadda si laguu caawiyo.",
              "Please ask a restaurant waiter for assistance.",
            )}
          </p>
          <LanguageSwitch />
        </div>
      </main>
    );
  }

  if (!menu || !table) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-line border-t-blue-700" />
          <p className="font-medium text-slate-600">{t("common.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-28 text-slate-800">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-2xl text-white">
              🍽
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-brand">
                {t("app.name")}
              </h1>
              <p className="text-xs text-slate-500">
                {text("Restaurant Ordering", "Restaurant Ordering")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:block">
              ● {text("Miiska waa la xaqiijiyay", "Table verified")}
            </div>
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* WELCOME / TABLE HERO */}
        <section
          className="relative flex min-h-[280px] items-center overflow-hidden
  rounded-3xl bg-cover bg-center p-6 text-white shadow-lg sm:min-h-[340px] sm:p-9"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(10,20,35,.88), rgba(10,20,35,.35)), url('/images/cover.png')",
          }}
        >
          {" "}
          <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                ✨ {text("Ku soo dhawoow", "Welcome")}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {text(
                  "Maxaad maanta dalbanaysaa?",
                  "What would you like today?",
                )}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                {text(
                  "Ka dooro cuntada aad jeceshahay. Dalabkaagana si toos ah uga la soco shaashaddaada.",
                  "Explore our menu, customize your meal and track your order in real time.",
                )}
              </p>
            </div>

            {/* <div className="min-w-40 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-medium text-blue-100">
                {text("Miiskaaga", "YOUR TABLE")}
              </p>
              <p className="mt-1 text-4xl font-black">{table.number}</p>
              <p className="mt-2 text-xs text-blue-100">
                <span className="mr-1">●</span>
                {text("QR waa la xaqiijiyay", "QR verified")}
              </p>
            </div> */}
          </div>
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rounded-full border-[35px] border-white/5" />
        </section>

        {/* NOTICES */}
        {notice && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <span className="text-xl">✓</span>
            <p className="flex-1">{notice}</p>
            <button onClick={() => setNotice("")} aria-label="Close">
              ×
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* NAVIGATION */}
        <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-xl border border-line bg-white p-1 shadow-sm">
            <button
              onClick={() => setTab("menu")}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold ${
                tab === "menu" ? "bg-brand text-white shadow" : "text-slate-600"
              }`}
            >
              🍽 {text("Cuntada", "Menu")}
            </button>

            <button
              onClick={() => setTab("orders")}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold ${
                tab === "orders"
                  ? "bg-brand text-white shadow"
                  : "text-slate-600"
              }`}
            >
              🧾 {text("Dalabyadayda", "My Orders")}
              {activeOrders.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-900">
                  {activeOrders.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-sm text-slate-500">
            {text("Miiska", "Table")}{" "}
            <strong className="text-slate-900">{table.number}</strong>
          </div>
        </div>

        {/* MENU */}
        {tab === "menu" && (
          <>
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {text("Menu-ga Maqaayadda", "Our Menu")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {text(
                    "Dooro cuntada aad rabto",
                    "Choose your favourite dishes",
                  )}
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2">
                  ⌕
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={text("Raadi cunto...", "Search dishes...")}
                  className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* CATEGORIES */}
            <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCat(category.id)}
                  className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition ${
                    active?.id === category.id
                      ? "bg-brand text-white shadow-md"
                      : "border border-line bg-white text-slate-600 hover:border-brand"
                  }`}
                >
                  {pick(category, "name", lang)}
                </button>
              ))}
            </div>

            {/* DISH GRID */}
            {visibleDishes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <span className="text-4xl">🍽</span>
                <p className="mt-3 font-semibold text-slate-700">
                  {text("Cunto lama helin", "No dishes found")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleDishes.map((dish) => (
                  <article
                    key={dish.id}
                    className={`group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                      !dish.available ? "opacity-70" : ""
                    }`}
                  >
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      {dish.photo_url ? (
                        <img
                          src={dish.photo_url}
                          alt={pick(dish, "name", lang)}
                          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
                            !dish.available ? "grayscale" : ""
                          }`}
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-6xl">
                          🍲
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-700 shadow">
                        ⏱ {dish.prep_minutes} {text("daqiiqo", "min")}
                      </div>

                      {!dish.available && (
                        <div className="absolute inset-0 grid place-items-center bg-black/35">
                          <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-red-700">
                            {text("Hadda lama heli karo", "Not available now")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold leading-6 text-slate-900">
                          {pick(dish, "name", lang)}
                        </h3>
                        <span className="shrink-0 text-sm font-extrabold text-brand">
                          {money(dish.price)}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                        {pick(dish, "description", lang)}
                      </p>

                      <button
                        disabled={!dish.available}
                        onClick={() => setSheet(dish)}
                        className="mt-4 h-11 w-full rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {dish.available
                          ? `+ ${text("Ku dar dalabka", "Add to order")}`
                          : text("Lama heli karo", "Unavailable")}
                      </button>
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
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-slate-900">
                {text("La soco dalabkaaga", "Track Your Order")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {text(
                  "Waxaad si toos ah u arki kartaa halka cuntadaadu marayso.",
                  "Follow every step from waiter confirmation to food delivery.",
                )}
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div className="text-5xl">🧾</div>
                <h3 className="mt-4 text-lg font-bold">
                  {text("Weli dalab ma jiro", "No orders yet")}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {text(
                    "Dooro cunto si aad u bilowdo.",
                    "Choose dishes to get started.",
                  )}
                </p>
                <button
                  onClick={() => setTab("menu")}
                  className="mt-5 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white"
                >
                  {text("Eeg menu-ga", "Explore Menu")}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {orders.map((order) => {
                  const items = order.items || [];

                  return (
                    <article
                      key={order.id}
                      className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {text("Dalabka", "Order")} #{order.id}
                          </p>
                          <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                            {text("Miiska", "Table")} {table.number}
                          </h3>
                        </div>

                        <StatusLabel status={order.status} lang={lang} />
                      </div>

                      {order.status === "pending_confirmation" && (
                        <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="font-bold text-amber-900">
                            ⏳{" "}
                            {text(
                              "Sugaya xaqiijinta waiter-ka",
                              "Waiting for waiter confirmation",
                            )}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">
                            {text(
                              "Waiter-ka ayaa hubinaya dalabkaaga. Marka uu xaqiijiyo waxaa loo gudbinayaa jikada.",
                              "Your waiter is reviewing the order. Once confirmed, it will be sent to the kitchen.",
                            )}
                          </p>
                        </div>
                      )}

                      <div className="space-y-5 p-5">
                        {items.map((item) => {
                          const stage = itemStage(item, order);
                          const cancelled = ["cancelled", "rejected"].includes(
                            item.status,
                          );

                          return (
                            <div
                              key={item.id}
                              className="rounded-xl bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h4 className="font-bold text-slate-900">
                                    {item.quantity} ×{" "}
                                    {pick(item, "dish_name", lang)}
                                  </h4>
                                  {item.notes && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      {text("Fiiro gaar ah:", "Note:")}{" "}
                                      {item.notes}
                                    </p>
                                  )}
                                </div>

                                <StatusLabel
                                  status={
                                    cancelled
                                      ? item.status
                                      : steps[stage].key === "waiting"
                                        ? "pending_confirmation"
                                        : item.status
                                  }
                                  lang={lang}
                                />
                              </div>

                              {cancelled ? (
                                <p className="mt-3 text-sm text-red-700">
                                  {text(
                                    "Qaybtan dalabka waa la joojiyay.",
                                    "This item was cancelled.",
                                  )}
                                </p>
                              ) : (
                                <OrderProgress stage={stage} lang={lang} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {order.status === "rejected" && (
                        <div className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-800">
                          {text(
                            "Dalabkan lama aqbalin. Fadlan la xiriir waiter-ka.",
                            "This order was not accepted. Please contact your waiter.",
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* FLOATING CART */}
      {count > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-4 right-4 z-20 mx-auto flex h-16 max-w-3xl items-center justify-between rounded-2xl bg-brand px-6 text-white shadow-xl transition hover:bg-brand-dark"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xl">
              🛒
            </span>
            <div className="text-left">
              <p className="text-sm font-bold">
                {text("Dalabkaaga", "Your order")} ({count})
              </p>
              <p className="text-xs text-white/80">
                {text("Eeg cart-ka", "View cart")}
              </p>
            </div>
          </div>
          <span className="text-lg font-extrabold">{money(total)} →</span>
        </button>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-line bg-white shadow-lg">
        <button
          onClick={() => setTab("menu")}
          className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${
            tab === "menu" ? "text-brand" : "text-slate-400"
          }`}
        >
          <span className="text-xl">🍽</span>
          {text("Menu", "Menu")}
        </button>

        <button
          onClick={() => setTab("orders")}
          className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${
            tab === "orders" ? "text-brand" : "text-slate-400"
          }`}
        >
          <span className="text-xl">🧾</span>
          {text("Dalabyadayda", "My Orders")}
          {activeOrders.length > 0 && (
            <span className="absolute right-[30%] top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] text-white">
              {activeOrders.length}
            </span>
          )}
        </button>
      </nav>

      {/* DISH MODIFIERS */}
      {sheet && (
        <DishSheet
          dish={sheet}
          lang={lang}
          onClose={() => setSheet(null)}
          onAdd={(line) => {
            setCart((current) => [
              ...current,
              { ...line, key: `${Date.now()}-${Math.random()}` },
            ]);
            setSheet(null);
            setNotice("");
          }}
        />
      )}

      {/* CART DRAWER */}
      {showCart && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm"
          onClick={() => setShowCart(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={text("Dalabkaaga", "Your cart")}
            className="absolute bottom-0 left-0 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {text("Dalabkaaga", "Your Order")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {text("Miiska", "Table")} {table.number}
                </p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl"
                aria-label="Close cart"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {t("customer.emptyCart")}
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">
                        {item.quantity} × {pick(item, "name", lang)}
                      </h3>

                      {(item.modifiers || []).length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.modifiers
                            .map((modifier) => pick(modifier, "name", lang))
                            .join(", ")}
                        </p>
                      )}

                      {item.notes && (
                        <p className="mt-1 text-xs italic text-slate-500">
                          {item.notes}
                        </p>
                      )}

                      <button
                        onClick={() =>
                          setCart((current) =>
                            current.filter((x) => x.key !== item.key),
                          )
                        }
                        className="mt-2 text-xs font-bold text-red-600"
                      >
                        {t("customer.remove")}
                      </button>
                    </div>

                    <p className="shrink-0 font-bold">
                      {money(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="font-bold text-slate-600">
                {text("Wadarta", "Total")}
              </span>
              <span className="text-2xl font-extrabold text-brand">
                {money(total)}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              {text(
                "Dalabka waxaa loo dirayaa waiter-ka si uu u xaqiijiyo ka hor inta aan jikada loo gudbin.",
                "Your order goes to the waiter for confirmation before being sent to the kitchen.",
              )}
            </p>

            <button
              disabled={sending || cart.length === 0}
              onClick={sendOrder}
              className="mt-5 h-14 w-full rounded-xl bg-brand text-sm font-extrabold text-white shadow-lg transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? text("Waa la dirayaa...", "Submitting...")
                : text("Xaqiiji oo dir dalabka", "Submit Order")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
