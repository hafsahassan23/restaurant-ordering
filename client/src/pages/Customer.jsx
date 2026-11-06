import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { api } from "../lib/api";
import { tableSocket } from "../lib/socket";
import { money, pick } from "../lib/format";

/** Bottom sheet: choose modifiers, notes and quantity for one dish. */
function DishSheet({ dish, lang, t, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState({}); // groupId -> [modifier ids]

  const toggle = (group, id) =>
    setPicked((p) => {
      const cur = p[group.id] || [];
      if (group.max_select === 1) return { ...p, [group.id]: [id] };
      if (cur.includes(id))
        return { ...p, [group.id]: cur.filter((x) => x !== id) };
      if (cur.length >= group.max_select) return p;
      return { ...p, [group.id]: [...cur, id] };
    });

  const chosen = dish.modifier_groups.flatMap((g) =>
    g.modifiers.filter((m) => (picked[g.id] || []).includes(m.id)),
  );
  const valid = dish.modifier_groups.every(
    (g) =>
      !g.is_required ||
      (picked[g.id] || []).length >= Math.max(1, g.min_select),
  );
  const unit = dish.price + chosen.reduce((s, m) => s + m.price_delta, 0);

  return (
    <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose}>
      <div
        className="absolute bottom-0 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{pick(dish, "name", lang)}</h2>
            <p className="text-slate-600">{pick(dish, "description", lang)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="h-11 w-11 rounded-full bg-slate-100 text-xl"
          >
            ×
          </button>
        </div>

        {dish.modifier_groups.map((g) => (
          <fieldset key={g.id} className="mt-4">
            <legend className="font-semibold">
              {pick(g, "name", lang)}{" "}
              <span className="text-sm font-normal text-slate-600">
                (
                {g.is_required
                  ? t("customer.required")
                  : t("customer.optional")}{" "}
                ·{" "}
                {g.max_select === 1
                  ? t("customer.chooseOne")
                  : t("customer.chooseUpTo", { n: g.max_select })}
                )
              </span>
            </legend>
            {g.modifiers.map((m) => (
              <label
                key={m.id}
                className={`mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-line px-3 ${m.available ? "" : "opacity-50"}`}
              >
                <input
                  type={g.max_select === 1 ? "radio" : "checkbox"}
                  name={`g${g.id}`}
                  disabled={!m.available}
                  checked={(picked[g.id] || []).includes(m.id)}
                  onChange={() => toggle(g, m.id)}
                  className="h-5 w-5"
                />
                <span className="flex-1">
                  {pick(m, "name", lang)}
                  {!m.available && (
                    <span className="text-sm">
                      {" "}
                      · {t("customer.unavailable")}
                    </span>
                  )}
                </span>
                {m.price_delta > 0 && (
                  <span className="text-slate-600">
                    +{money(m.price_delta)}
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        ))}

        <label htmlFor="notes" className="mt-4 block font-semibold">
          {t("customer.notes")}
        </label>
        <input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={255}
          placeholder={t("customer.notesHint")}
          className="mt-1 h-12 w-full rounded-xl border border-line px-4"
        />

        <div className="mt-4 flex items-center justify-between">
          <span className="font-semibold">{t("customer.quantity")}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-12 w-12 rounded-xl border border-line text-xl"
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              className="h-12 w-12 rounded-xl border border-line text-xl"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onAdd({
              dishId: dish.id,
              name_so: dish.name_so,
              name_en: dish.name_en,
              quantity: qty,
              notes,
              modifierIds: chosen.map((m) => m.id),
              modifiers: chosen,
              unitPrice: unit,
            })
          }
          className="mt-5 h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-40"
        >
          {t("customer.add")} · {money(unit * qty)}
        </button>
      </div>
    </div>
  );
}

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
      "item:updated",
    ].forEach((e) => socket.on(e, loadOrders));
    socket.on("menu:updated", loadMenu); // a dish can become unavailable while the customer is browsing
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

  return (
    <div className="min-h-screen bg-surface pb-28">
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

      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
        {menu.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`h-11 shrink-0 rounded-full px-5 font-semibold ${
              active.id === c.id
                ? "bg-brand text-white"
                : "border border-line bg-white"
            }`}
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
            className={`flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-4 text-left ${
              d.available ? "" : "bg-slate-100 text-slate-500"
            }`}
          >
            <div
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface text-3xl ${d.available ? "" : "grayscale"}`}
            >
              🍲
            </div>
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

      {orders.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 text-xl font-bold">{t("customer.yourOrders")}</h2>
          {orders.map((o) => (
            <div
              key={o.id}
              className="mb-3 rounded-2xl border border-line bg-white p-4"
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

      {count > 0 && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 z-10 flex h-14 items-center justify-between rounded-2xl bg-brand px-5 text-lg font-semibold text-white shadow-lg"
        >
          <span>
            {t("customer.cart")} ({count})
          </span>
          <span>{money(total)}</span>
        </button>
      )}

      {sheet && (
        <DishSheet
          dish={sheet}
          lang={lang}
          t={t}
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
