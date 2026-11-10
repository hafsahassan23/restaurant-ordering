import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { money } from "../lib/format";
import { Button } from "./ui.jsx";

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

  if (!bill) return null;

  const receiptNumber = bill.receipt_number || bill.id;
  const date = bill.updated_at
    ? new Date(bill.updated_at).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="receipt-overlay fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-[2px]">
      <div className="receipt-modal max-h-[94vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-100 p-4 shadow-pop">
        {bill.status === "paid" && (
          <p className="receipt-actions mx-auto mb-3 flex max-w-[340px] items-center justify-center gap-2 rounded-lg bg-green-50 py-2 text-sm font-semibold text-green-700 ring-1 ring-inset ring-green-200">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t("cashier.statusPaid")}
          </p>
        )}
        <div
          id="receipt"
          className="receipt-paper mx-auto max-w-[340px] bg-white px-6 py-7 font-mono text-xs text-slate-800 shadow-sm"
        >
          {/* Restaurant header */}
          <header className="text-center">
            <h2 className="text-xl font-black uppercase tracking-wide">
              {bill.restaurant_name}
            </h2>

            {bill.restaurant_city && (
              <p className="mt-1 text-slate-500">{bill.restaurant_city}</p>
            )}

            <div className="my-4 border-t-2 border-dashed border-slate-400" />

            <h3 className="text-sm font-black uppercase tracking-widest">
              {bi("cashier.receipt")}
            </h3>

            <p className="mt-2 text-slate-500">{bi("cashier.receiptNo")}: #{receiptNumber}</p>
          </header>

          {/* Order information */}
          <section className="my-4 space-y-1 border-y border-dashed border-slate-300 py-3">
            <div className="flex justify-between gap-2">
              <span>{bi("waiter.table")}</span>
              <strong>{bill.table_number}</strong>
            </div>

            <div className="flex justify-between gap-2">
              <span>{bi("cashier.date")}</span>
              <span className="text-right">{date}</span>
            </div>
          </section>

          {/* Items */}
          <section>
            <div className="mb-3 grid grid-cols-[1fr_auto] border-b border-slate-300 pb-2 font-bold uppercase">
              <span>{bi("cashier.items")}</span>
              <span>{bi("cashier.amount")}</span>
            </div>

            <div className="space-y-3">
              {(bill.lines || []).map((line) => (
                <div key={line.id}>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {line.dish_name_so} / {line.dish_name_en}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {line.quantity} ×{" "}
                        {money(
                          line.quantity
                            ? line.line_total / line.quantity
                            : line.line_total,
                        )}
                      </p>
                    </div>

                    <strong className="shrink-0">
                      {money(line.line_total)}
                    </strong>
                  </div>

                  {(line.modifiers || []).map((modifier) => (
                    <p
                      key={modifier.id}
                      className="mt-1 pl-3 text-[10px] text-slate-500"
                    >
                      + {modifier.name_so} / {modifier.name_en}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Totals */}
          <section className="mt-5 space-y-2 border-t border-dashed border-slate-400 pt-4">
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

            <div className="mt-3 flex justify-between border-t-2 border-double border-slate-700 pt-3 text-base font-black">
              <span>{bi("cashier.total")}</span>
              <span>{money(bill.total)}</span>
            </div>
          </section>

          {/* Payments */}
          <section className="mt-5 border-t border-dashed border-slate-400 pt-4">
            <h4 className="mb-3 text-center font-black uppercase tracking-wider">
              {bi("cashier.payment")}
            </h4>

            {(bill.payments || []).map((payment) => (
              <div key={payment.id} className="mb-3">
                <div className="flex justify-between gap-2">
                  <span>{bi(`cashier.${payment.method}`)}</span>
                  <strong>{money(payment.amount)}</strong>
                </div>

                {payment.change_given > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{bi("cashier.change")}</span>
                    <span>{money(payment.change_given)}</span>
                  </div>
                )}

                {payment.payer_masked && payment.payer_masked !== "QR" && (
                  <p className="mt-1 text-[10px] text-slate-500">{payment.payer_masked}</p>
                )}
                {payment.reference && (
                  <p className="mt-1 break-all text-[10px] text-slate-500">
                    {bi("cashier.reference")}: {payment.reference}
                  </p>
                )}
              </div>
            ))}
          </section>

          {/* Footer */}
          <footer className="mt-6 border-t border-dashed border-slate-400 pt-4 text-center">
            <p className="font-bold">{bi("cashier.thanks")}</p>
            <p className="mt-2 text-[10px] text-slate-500">
              {bi("cashier.keepReceipt")}
            </p>
            {(bill.payments || []).some((p) => p.method !== "cash") && (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">{bi("pay.receiptDemo")}</p>
            )}
          </footer>
        </div>

        {/* Actions - hidden when printing */}
        <div className="receipt-actions mx-auto mt-4 flex max-w-[340px] gap-2">
          <Button onClick={print} className="flex-1">
            <Printer className="h-4 w-4" aria-hidden="true" />
            {t("cashier.print")}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            <X className="h-4 w-4" aria-hidden="true" />
            {t("cashier.close")}
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }

          body.printing-receipt * {
            visibility: hidden !important;
          }

          body.printing-receipt #receipt,
          body.printing-receipt #receipt * {
            visibility: visible !important;
          }

          body.printing-receipt #receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            max-width: none !important;
            padding: 2mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            font-size: 10px !important;
          }

          body.printing-receipt .receipt-overlay,
          body.printing-receipt .receipt-modal {
            position: static !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }

          body.printing-receipt .receipt-actions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
