import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Trash2, Send, UtensilsCrossed } from "lucide-react";
import { Alert, Button, EmptyState, LoadingState, Modal } from "./ui.jsx";
import DishSheet from "./DishSheet.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { money, pick } from "../lib/format";

/** Waiter enters an order for a table: menu, choices, notes, cart. The order is confirmed at once. */
export default function OrderBuilder({ table, onClose, onDone }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [menu, setMenu] = useState(null);
  const [cat, setCat] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("/public/menu")
      .then((m) => !cancelled && setMenu(m))
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const active = menu ? menu.find((c) => c.id === cat) || menu[0] : null;
  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("/orders", {
        method: "POST",
        body: {
          tableId: table.id,
          items: cart.map((l) => ({ dishId: l.dishId, quantity: l.quantity, notes: l.notes || undefined, modifierIds: l.modifierIds })),
        },
      });
      onDone();
    } catch (e) {
      setError(errorText(t, "waiter", e));
      api("/public/menu").then(setMenu).catch(() => {}); // a dish may have just run out
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal title={t("waiter.newOrder")} subtitle={`${t("waiter.table")} ${table.number}`} onClose={onClose} wide>
        {error && <Alert onClose={() => setError("")}>{error}</Alert>}
        {!menu && !error && <LoadingState />}
        {menu && active && (
          <div className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-3">
              <div className="scroll-thin mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                {menu.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={`h-9 shrink-0 rounded-lg px-4 text-sm font-semibold transition ${
                      active.id === c.id ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    {pick(c, "name", lang)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {active.dishes.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!d.available}
                    onClick={() => setSheet(d)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                      d.available ? "border-line bg-white hover:border-brand/40 hover:bg-brand-50/40" : "cursor-not-allowed border-line bg-slate-50 text-slate-400"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{pick(d, "name", lang)}</span>
                      {!d.available && <span className="text-xs">{t("customer.unavailable")}</span>}
                    </span>
                    <span className="tabular font-semibold">{money(d.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-line bg-slate-50/60 p-4 md:col-span-2">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <ShoppingBag className="h-4 w-4 text-brand" aria-hidden="true" />
                {t("waiter.cart")}
              </h3>
              {cart.length === 0 ? (
                <EmptyState icon={UtensilsCrossed} title={t("waiter.emptyCart")} className="flex-1 py-8" />
              ) : (
                <ul className="flex-1 divide-y divide-line">
                  {cart.map((l) => (
                    <li key={l.key} className="flex items-start justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          <span className="tabular mr-1 text-muted">{l.quantity}×</span>
                          {pick(l, "name", lang)}
                        </div>
                        {l.modifiers.length > 0 && <div className="text-xs text-muted">{l.modifiers.map((m) => pick(m, "name", lang)).join(", ")}</div>}
                        {l.notes && <div className="text-xs italic text-amber-800">{l.notes}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="tabular text-sm font-semibold">{money(l.unitPrice * l.quantity)}</span>
                        <button
                          type="button"
                          onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}
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
              <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
                <span>{t("customer.total")}</span>
                <span className="tabular">{money(total)}</span>
              </div>
              <Button onClick={send} loading={busy} disabled={cart.length === 0} className="mt-3 w-full">
                <Send className="h-4 w-4" aria-hidden="true" />
                {busy ? t("waiter.sending") : t("waiter.send")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {sheet && (
        <DishSheet
          dish={sheet}
          lang={lang}
          onClose={() => setSheet(null)}
          onAdd={(line) => {
            setCart((c) => [...c, { ...line, key: Date.now() + Math.random() }]);
            setSheet(null);
          }}
        />
      )}
    </>
  );
}
