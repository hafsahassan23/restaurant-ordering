import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { money } from "../lib/format";

/** Receipt shown after payment. Labels are always printed in Somali and English. */
export default function Receipt({ bill, onClose }) {
  const { t, i18n } = useTranslation();
  const so = i18n.getFixedT("so");
  const en = i18n.getFixedT("en");
  const bi = (key) => `${so(key)} / ${en(key)}`;

  useEffect(() => {
    const done = () => document.body.classList.remove("printing-receipt");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  const print = () => {
    document.body.classList.add("printing-receipt");
    window.print();
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div id="receipt" className="font-mono text-sm">
          <h2 className="text-center text-lg font-bold">
            {bill.restaurant_name}
          </h2>
          <p className="text-center font-semibold">{bi("cashier.receipt")}</p>
          <p className="text-center">
            {bi("waiter.table")} {bill.table_number} ·{" "}
            {new Date(bill.updated_at).toLocaleString()}
          </p>

          <ul className="my-3 space-y-2 border-y border-dashed border-slate-400 py-3">
            {bill.lines.map((l) => (
              <li key={l.id}>
                <div className="flex justify-between gap-2">
                  <span>
                    {l.quantity} × {l.dish_name_so} / {l.dish_name_en}
                  </span>
                  <span>{money(l.line_total)}</span>
                </div>
                {l.modifiers.map((m) => (
                  <div key={m.id} className="pl-4 text-xs">
                    + {m.name_so} / {m.name_en}
                  </div>
                ))}
              </li>
            ))}
          </ul>

          <div className="flex justify-between">
            <span>{bi("cashier.subtotal")}</span>
            <span>{money(bill.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              {bi("cashier.service")} ({bill.service_charge_pct}%)
            </span>
            <span>{money(bill.service_charge)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>{bi("cashier.total")}</span>
            <span>{money(bill.total)}</span>
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-3">
            {bill.payments.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between">
                  <span>{bi(`cashier.${p.method}`)}</span>
                  <span>{money(p.amount)}</span>
                </div>
                {p.change_given > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>{bi("cashier.change")}</span>
                    <span>{money(p.change_given)}</span>
                  </div>
                )}
                {p.reference && (
                  <div className="text-xs">Ref: {p.reference}</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center">{bi("cashier.thanks")}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={print}
            className="h-12 flex-1 rounded-xl bg-brand font-semibold text-white"
          >
            {t("cashier.print")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-line font-semibold"
          >
            {t("cashier.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
