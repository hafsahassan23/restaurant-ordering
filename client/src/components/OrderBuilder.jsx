import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Modal } from "./ui.jsx";
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
      .then((m) => {
        if (!cancelled) setMenu(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
          items: cart.map((l) => ({
            dishId: l.dishId,
            quantity: l.quantity,
            notes: l.notes || undefined,
            modifierIds: l.modifierIds,
          })),
        },
      });
      onDone();
    } catch (e) {
      setError(errorText(t, "waiter", e));
      api("/public/menu")
        .then(setMenu)
        .catch(() => {}); // a dish may have just run out
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title={`${t("waiter.newOrder")} · ${t("waiter.table")} ${table.number}`}
        onClose={onClose}
        wide
      >
        {error && <Alert>{error}</Alert>}
        {!menu && <p>{t("common.loading")}</p>}
        {menu && (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-3">
              <div className="mb-3 flex gap-2 overflow-x-auto">
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
              </div>
              <div className="space-y-2">
                {active.dishes.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!d.available}
                    onClick={() => setSheet(d)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line p-3 text-left ${d.available ? "bg-white hover:bg-slate-50" : "bg-slate-100 text-slate-500"}`}
                  >
                    <span>
                      <span className="block font-semibold">
                        {pick(d, "name", lang)}
                      </span>
                      {!d.available && (
                        <span className="text-sm">
                          {t("customer.unavailable")}
                        </span>
                      )}
                    </span>
                    <span className="font-bold">{money(d.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <h3 className="mb-2 font-bold">{t("waiter.cart")}</h3>
              {cart.length === 0 && (
                <p className="text-slate-600">{t("waiter.emptyCart")}</p>
              )}
              <ul className="divide-y divide-line">
                {cart.map((l) => (
                  <li
                    key={l.key}
                    className="flex items-start justify-between gap-2 py-2"
                  >
                    <div>
                      <div className="font-semibold">
                        {l.quantity} × {pick(l, "name", lang)}
                      </div>
                      {l.modifiers.length > 0 && (
                        <div className="text-sm text-slate-600">
                          {l.modifiers
                            .map((m) => pick(m, "name", lang))
                            .join(", ")}
                        </div>
                      )}
                      {l.notes && (
                        <div className="text-sm italic">{l.notes}</div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) => c.filter((x) => x.key !== l.key))
                        }
                        className="text-sm text-paying"
                      >
                        {t("customer.remove")}
                      </button>
                    </div>
                    <div className="font-semibold">
                      {money(l.unitPrice * l.quantity)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between text-lg font-bold">
                <span>{t("customer.total")}</span>
                <span>{money(total)}</span>
              </div>
              <Button
                onClick={send}
                disabled={busy || cart.length === 0}
                className="mt-3 w-full"
              >
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
            setCart((c) => [
              ...c,
              { ...line, key: Date.now() + Math.random() },
            ]);
            setSheet(null);
          }}
        />
      )}
    </>
  );
}
