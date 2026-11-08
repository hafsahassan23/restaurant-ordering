import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import StatusChip from "../components/StatusChip.jsx";
import DishSheet from "../components/DishSheet.jsx";
import { api } from "../lib/api";
import { tableSocket } from "../lib/socket";
import { money, pick } from "../lib/format";

/** Customer page opened from the table QR code: menu, own orders with live status, cart. */
export default function Customer() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMenu = useCallback(
    () =>
      api("/public/menu")
        .then(setMenu)
        .catch(() => setError(t("common.error"))),
    [t],
  );
  const loadOrders = useCallback(
    () =>
      api(`/public/table/${token}/orders`)
        .then(setOrders)
        .catch(() => {}),
    [token],
  );

  useEffect(() => {
    api(`/public/table/${token}`)
      .then(setTable)
      .catch(() => setInvalid(true));
    loadMenu();
    loadOrders();
    const socket = tableSocket(token);
    [
      "order:pending",
      "order:confirmed",
      "order:rejected",
      "order:moved",
      "item:updated",
    ].forEach((e) => socket.on(e, loadOrders));
    socket.on("connect", loadOrders); // refresh after the phone lost the connection
    socket.on("menu:updated", loadMenu); // a dish can switch off while the customer is browsing
    return () => socket.disconnect();
  }, [token, loadMenu, loadOrders]);

  const Header = (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-brand px-4 py-3 text-white">
      <div>
        <div className="font-bold">{t("app.name")}</div>
        {table && (
          <div className="text-sm">
            {t("customer.table")} {table.number}
          </div>
        )}
      </div>
      <LanguageSwitch />
    </header>
  );

  if (invalid || table?.is_closed) {
    return (
      <div className="min-h-screen bg-surface">
        {Header}
        <p className="m-6 rounded-2xl bg-white p-8 text-center text-lg">
          {invalid ? t("customer.invalidTable") : t("customer.closed")}
        </p>
      </div>
    );
  }
  if (!menu)
    return (
      <div className="grid min-h-screen place-items-center">
        {t("common.loading")}
      </div>
    );

  const active = menu.find((c) => c.id === cat) || menu[0];
  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const openItems = orders
    .flatMap((o) => o.items)
    .filter((i) =>
      ["pending", "ordered", "cooking", "ready"].includes(i.status),
    ).length;

  async function send() {
    setSending(true);
    setError("");
    try {
      await api("/public/orders", {
        method: "POST",
        body: {
          tableToken: token,
          items: cart.map((l) => ({
            dishId: l.dishId,
            quantity: l.quantity,
            notes: l.notes || undefined,
            modifierIds: l.modifierIds,
          })),
        },
      });
      setCart([]);
      setShowCart(false);
      setTab("orders");
      setNotice(t("customer.sent"));
      loadOrders();
    } catch (e) {
      if (e.code === "TABLE_CLOSED") setTable({ ...table, is_closed: true });
      else if (e.code === "TABLE_PAYING") setError(t("customer.paying"));
      else if (
        e.code === "DISH_UNAVAILABLE" ||
        e.code === "MODIFIER_UNAVAILABLE"
      )
        setError(t("customer.unavailableErr"));
      else setError(e.message);
      loadMenu();
    } finally {
      setSending(false);
    }
  }

  const nav = [
    ["menu", "🍽️", t("customer.navMenu"), 0, () => setTab("menu")],
    [
      "orders",
      "🧾",
      t("customer.navOrders"),
      openItems,
      () => {
        setTab("orders");
        setNotice("");
      },
    ],
    ["cart", "🛒", t("customer.navCart"), count, () => setShowCart(true)],
  ];

  return (
    <div className="min-h-screen bg-surface pb-40">
      {Header}
      {notice && (
        <div className="m-4 rounded-xl bg-green-50 p-3 text-green-900">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      {tab === "menu" && (
        <>
          <nav className="flex gap-2 overflow-x-auto px-4 py-3">
            {menu.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`h-11 shrink-0 rounded-full px-5 font-semibold ${active.id === c.id ? "bg-brand text-white" : "border border-line bg-white"}`}
              >
                {pick(c, "name", lang)}
              </button>
            ))}
          </nav>
          <div className="space-y-3 px-4">
            {active.dishes.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={!d.available}
                onClick={() => setSheet(d)}
                className={`flex w-full items-center gap-4 rounded-2xl border border-line p-4 text-left shadow-sm ${d.available ? "bg-white" : "bg-slate-100 text-slate-500"}`}
              >
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt=""
                    className={`h-16 w-16 shrink-0 rounded-xl object-cover ${d.available ? "" : "grayscale"}`}
                  />
                ) : (
                  <div
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface text-3xl ${d.available ? "" : "grayscale"}`}
                  >
                    🍲
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-lg font-semibold">
                    {pick(d, "name", lang)}
                  </div>
                  <div className="text-sm">{pick(d, "description", lang)}</div>
                  <div className="mt-1 text-sm">
                    ⏱ {d.prep_minutes} {t("customer.minutes")}
                  </div>
                  {!d.available && (
                    <div className="mt-1 font-semibold">
                      {t("customer.unavailable")}
                    </div>
                  )}
                </div>
                <div className="text-lg font-bold">{money(d.price)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "orders" && (
        <section className="mt-4 px-4">
          <h2 className="mb-2 text-xl font-bold">{t("customer.yourOrders")}</h2>
          {orders.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-slate-600">
              {t("customer.noOrders")}
            </p>
          )}
          {orders.map((o) => (
            <div
              key={o.id}
              className="mb-3 rounded-2xl border border-line bg-white p-4 shadow-sm"
            >
              {o.status === "pending_confirmation" && (
                <p className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-blue-900">
                  {t("customer.waitingWaiter")}
                </p>
              )}
              <ul className="space-y-2">
                {o.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {i.quantity} × {pick(i, "dish_name", lang)}
                    </span>
                    <StatusChip kind="item" status={i.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {count > 0 && tab === "menu" && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-4 right-4 z-10 flex h-14 items-center justify-between rounded-2xl bg-brand px-5 text-lg font-semibold text-white shadow-lg"
        >
          <span>
            {t("customer.cart")} ({count})
          </span>
          <span>{money(total)}</span>
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-white">
        {nav.map(([id, icon, label, badge, onClick]) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            aria-current={tab === id ? "page" : undefined}
            className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${tab === id ? "text-brand" : "text-slate-600"}`}
          >
            <span aria-hidden="true" className="text-xl">
              {icon}
            </span>
            {label}
            {badge > 0 && (
              <span className="absolute right-1/4 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-paying px-1 text-xs font-bold text-white">
                {badge}
              </span>
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
            setCart((c) => [
              ...c,
              { ...line, key: Date.now() + Math.random() },
            ]);
            setSheet(null);
            setNotice("");
          }}
        />
      )}

      {showCart && (
        <div
          className="fixed inset-0 z-20 bg-black/40"
          onClick={() => setShowCart(false)}
        >
          <div
            className="absolute bottom-0 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-xl font-bold">{t("customer.cart")}</h2>
            {cart.length === 0 && <p>{t("customer.emptyCart")}</p>}
            {cart.map((l) => (
              <div
                key={l.key}
                className="flex items-start justify-between gap-3 border-b border-line py-3"
              >
                <div>
                  <div className="font-semibold">
                    {l.quantity} × {pick(l, "name", lang)}
                  </div>
                  {l.modifiers.length > 0 && (
                    <div className="text-sm text-slate-600">
                      {l.modifiers.map((m) => pick(m, "name", lang)).join(", ")}
                    </div>
                  )}
                  {l.notes && <div className="text-sm italic">{l.notes}</div>}
                  <button
                    type="button"
                    onClick={() =>
                      setCart((c) => c.filter((x) => x.key !== l.key))
                    }
                    className="mt-1 text-sm text-paying"
                  >
                    {t("customer.remove")}
                  </button>
                </div>
                <div className="font-semibold">
                  {money(l.unitPrice * l.quantity)}
                </div>
              </div>
            ))}
            <div className="mt-3 flex justify-between text-lg font-bold">
              <span>{t("customer.total")}</span>
              <span>{money(total)}</span>
            </div>
            <button
              type="button"
              disabled={sending || cart.length === 0}
              onClick={send}
              className="mt-4 h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-50"
            >
              {sending ? t("customer.sending") : t("customer.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
