import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, QrCode, CreditCard, FlaskConical, CheckCircle2, XCircle, AlertCircle, Loader2, Lock } from "lucide-react";
import { Button, Field, inputCls } from "../ui.jsx";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { PROVIDERS, MOBILE_METHODS, validatePhone, validateCard, cardBrand } from "../../lib/paymentValidation";

const METHOD_LIST = [
  ["evc_plus", Smartphone],
  ["edahab", Smartphone],
  ["zaad", Smartphone],
  ["waafi", Smartphone],
  ["qr", QrCode],
  ["card", CreditCard],
];

/** One key per payment attempt, so a double click or a network retry never pays twice. */
const newKey = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const formatCardNumber = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Demo payment panel for the cashier: EVC Plus, eDahab, ZAAD, WAAFI (phone), QR code and card.
 * Inputs are checked while typing; the server checks them again and is the only one that decides.
 * Props: bill, split (chosen split or null), needsSplit, onPaid(result), onBill(bill).
 */
export default function PaymentPanel({ bill, split, needsSplit, onPaid, onBill }) {
  const { t } = useTranslation();
  const [method, setMethod] = useState(() => (bill.pending_payment ? "qr" : "evc_plus"));
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [touched, setTouched] = useState({});
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { text, reference? }
  const keyRef = useRef(null);

  const pending = bill.pending_payment;
  const due = split ? split.amount : partial ? Number(partial) : bill.remaining;
  const amountOk = due > 0 && due <= bill.remaining + 0.005;
  const isMobile = MOBILE_METHODS.includes(method);

  const phoneCheck = useMemo(() => (isMobile ? validatePhone(method, phone) : null), [isMobile, method, phone]);
  const cardCheck = useMemo(() => (method === "card" ? validateCard(card) : null), [method, card]);
  const detailsOk = isMobile ? phoneCheck.ok : method === "card" ? cardCheck.ok : true;
  const canPay = !busy && !pending && !needsSplit && amountOk && detailsOk;

  const errorText = (e) => t(`pay.err.${e.code}`, { defaultValue: e.message || t("cashier.err.generic") });

  function choose(m) {
    setMethod(m);
    setError(null);
    setTouched({});
  }

  /** Server call with a stable key for this attempt; a new key is made after any final answer. */
  async function submit(path, body) {
    setBusy(true);
    setError(null);
    keyRef.current = keyRef.current || newKey();
    try {
      return await api(path, { method: "POST", body: { ...body, idempotencyKey: keyRef.current } });
    } catch (e) {
      setError({ text: errorText(e), reference: e.reference });
      if (e.code === "PAYMENT_PENDING" || e.code === "BILL_CHANGED") onBill(await api(`/bills/${bill.id}`).catch(() => bill));
      return null;
    } finally {
      keyRef.current = null;
      setBusy(false);
    }
  }

  const target = () => (split ? { splitId: split.id } : partial ? { amount: Number(partial) } : {});

  async function pay() {
    setTouched({ phone: true, number: true, expiry: true, cvv: true, name: true });
    if (!canPay) return;
    const body = { method, ...target() };
    if (isMobile) body.phone = phone;
    else body.card = { number: card.number, expiry: card.expiry, cvv: card.cvv, name: card.name.trim() };
    const res = await submit(`/bills/${bill.id}/payments`, body);
    if (!res) {
      if (method === "card") setCard((c) => ({ ...c, cvv: "" })); // never leave the CVV on screen after a failed attempt
      return;
    }
    setPhone("");
    setCard({ number: "", expiry: "", cvv: "", name: "" }); // card details are never kept
    setPartial("");
    setTouched({});
    onPaid(res);
  }

  async function startQr() {
    const view = await submit(`/bills/${bill.id}/qr`, target());
    if (view) onBill(view);
  }

  async function finishQr(outcome) {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/bills/qr/${pending.reference}/result`, { method: "POST", body: { outcome } });
      if (res.status === "SUCCESS") {
        setPartial("");
        onPaid({ ...res, payment: { amount: pending.amount, method: "qr", reference: pending.reference } });
      } else {
        onBill(res.bill);
        setError({ text: t("pay.qrFailed"), reference: pending.reference });
      }
    } catch (e) {
      setError({ text: errorText(e) });
      onBill(await api(`/bills/${bill.id}`).catch(() => bill));
    } finally {
      setBusy(false);
    }
  }

  // ---- field helpers
  const phoneError = touched.phone && phone && !phoneCheck?.ok ? phoneCheck : null;
  const cardFieldError = (field) => (touched[field] && cardCheck && !cardCheck.ok && cardCheck.field === field ? t(`pay.err.${cardCheck.code}`) : null);
  const brand = cardBrand(card.number.replace(/\s/g, ""));

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="bg-brand-900 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{t("cashier.amountDue")}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            {t("pay.demoBadge")}
          </span>
        </div>
        <p className="tabular mt-1 text-3xl font-bold">{money(pending ? pending.amount : due)}</p>
      </div>

      <div className="space-y-4 p-5">
        {/* Method */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t("cashier.method")}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("cashier.method")}>
            {METHOD_LIST.map(([m, Icon]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                disabled={!!pending && m !== "qr"}
                onClick={() => choose(m)}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  method === m ? "border-brand bg-brand-50 text-brand-dark ring-1 ring-brand" : "border-line text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(`pay.method.${m}`)}
              </button>
            ))}
          </div>
        </div>

        {!split && bill.splits.length === 0 && !pending && (
          <Field label={t("cashier.partialHint")}>
            <input type="number" min="0" step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)} placeholder={money(bill.remaining)} className={inputCls} />
          </Field>
        )}
        {partial && !amountOk && <p className="text-sm font-medium text-red-600">{t("pay.err.INVALID_AMOUNT")}</p>}

        {/* Mobile money */}
        {isMobile && (
          <div>
            <label htmlFor="pay-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("pay.phoneLabel", { provider: PROVIDERS[method].name })}
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line bg-slate-50 px-3 text-sm font-semibold text-slate-600">+252</span>
              <input
                id="pay-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched((x) => ({ ...x, phone: true }))}
                placeholder={method === "edahab" ? "62 901 1723" : method === "zaad" ? "63 456 7891" : "61 901 1723"}
                aria-invalid={!!phoneError}
                className={`${inputCls} rounded-l-none ${phoneError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : phoneCheck?.ok ? "border-green-500" : ""}`}
              />
            </div>
            {phoneError ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs font-medium text-red-600">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t(`pay.err.${phoneError.code}`, { provider: PROVIDERS[method].name, prefixes: PROVIDERS[method].prefixes.join(", ") })}
                {phoneError.suggestion && (
                  <button type="button" onClick={() => choose(phoneError.suggestion)} className="font-semibold text-brand underline">
                    {t("pay.switchTo", { provider: PROVIDERS[phoneError.suggestion].name })}
                  </button>
                )}
              </p>
            ) : phoneCheck?.ok ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("pay.phoneOk", { provider: PROVIDERS[method].name, network: PROVIDERS[method].network })}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted">{t("pay.phoneHint", { prefixes: PROVIDERS[method].prefixes.join(", ") })}</p>
            )}
          </div>
        )}

        {/* Card */}
        {method === "card" && (
          <div className="space-y-3">
            <Field label={t("pay.cardName")} error={cardFieldError("name")}>
              <input
                value={card.name}
                autoComplete="off"
                onChange={(e) => setCard({ ...card, name: e.target.value })}
                onBlur={() => setTouched((x) => ({ ...x, name: true }))}
                className={inputCls}
              />
            </Field>
            <Field label={t("pay.cardNumber")} error={cardFieldError("number")}>
              <div className="relative">
                <input
                  value={card.number}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                  onBlur={() => setTouched((x) => ({ ...x, number: true }))}
                  placeholder="4242 4242 4242 4242"
                  className={`${inputCls} tabular pr-24`}
                />
                {card.number.length > 1 && brand !== "CARD" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">{brand}</span>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("pay.cardExpiry")} error={cardFieldError("expiry")}>
                <input
                  value={card.expiry}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  onBlur={() => setTouched((x) => ({ ...x, expiry: true }))}
                  placeholder="MM/YY"
                  className={`${inputCls} tabular`}
                />
              </Field>
              <Field label="CVV" error={cardFieldError("cvv")}>
                <input
                  value={card.cvv}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  onBlur={() => setTouched((x) => ({ ...x, cvv: true }))}
                  placeholder="123"
                  className={`${inputCls} tabular`}
                />
              </Field>
            </div>
            <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("pay.cardDemoNote")}
            </p>
          </div>
        )}

        {/* QR */}
        {method === "qr" &&
          (pending ? (
            <div className="rounded-xl border border-line p-4 text-center">
              <div className="mx-auto w-fit rounded-lg bg-white p-2 shadow-sm ring-1 ring-line">
                <QRCodeSVG value={pending.payload} size={176} />
              </div>
              <p className="tabular mt-3 text-2xl font-bold">{money(pending.amount)}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t("pay.reference")}: <span className="font-mono font-semibold text-ink">{pending.reference}</span>
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {t("pay.qrWaiting")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => finishQr("failed")} className="text-red-600">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  {t("pay.qrSimFail")}
                </Button>
                <Button disabled={busy} onClick={() => finishQr("success")}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {t("pay.qrSimPaid")}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted">{t("pay.qrNote")}</p>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">{t("pay.qrIntro")}</p>
          ))}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <p className="flex items-start gap-2 font-medium">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error.text}
            </p>
            {error.reference && (
              <p className="mt-1 pl-6 text-xs text-red-700">
                {t("pay.reference")}: <span className="font-mono">{error.reference}</span> · FAILED
              </p>
            )}
          </div>
        )}

        {needsSplit && <p className="text-sm font-medium text-amber-700">{t("cashier.selectSplit")}</p>}

        {method === "qr" ? (
          !pending && (
            <Button size="lg" disabled={busy || needsSplit || !amountOk} loading={busy} onClick={startQr} className="w-full">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              {t("pay.qrShow", { amount: money(due) })}
            </Button>
          )
        ) : (
          <Button size="lg" disabled={!canPay} loading={busy} onClick={pay} className="w-full">
            {busy ? t("cashier.paying") : t("pay.payWith", { amount: money(due), method: t(`pay.method.${method}`) })}
          </Button>
        )}
        {pending && method !== "qr" && <p className="text-sm font-medium text-amber-700">{t("pay.err.PAYMENT_PENDING")}</p>}
      </div>
    </div>
  );
}
