import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Minus, Plus, X, Clock, UtensilsCrossed } from "lucide-react";
import { money, pick } from "../lib/format";
import { photoSrc } from "../lib/api";
import { inputCls } from "./ui.jsx";

/** Bottom sheet: choose modifiers, notes and quantity for one dish. Used by customers and waiters. */
export default function DishSheet({ dish, lang, onClose, onAdd }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState({}); // groupId -> [modifier ids]

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (group, id) =>
    setPicked((p) => {
      const cur = p[group.id] || [];
      if (group.max_select === 1) return { ...p, [group.id]: [id] };
      if (cur.includes(id)) return { ...p, [group.id]: cur.filter((x) => x !== id) };
      if (cur.length >= group.max_select) return p;
      return { ...p, [group.id]: [...cur, id] };
    });

  const chosen = dish.modifier_groups.flatMap((g) => g.modifiers.filter((m) => (picked[g.id] || []).includes(m.id)));
  const missing = dish.modifier_groups.filter((g) => g.is_required && (picked[g.id] || []).length < Math.max(1, g.min_select));
  const valid = missing.length === 0;
  const unit = dish.price + chosen.reduce((s, m) => s + m.price_delta, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={pick(dish, "name", lang)}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {dish.photo_url ? (
          <div className="relative h-44 shrink-0 bg-slate-100">
            <img src={photoSrc(dish.photo_url)} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white sm:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{pick(dish, "name", lang)}</h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted">
                <span className="tabular font-semibold text-brand">{money(dish.price)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {dish.prep_minutes} {t("customer.minutes")}
                </span>
              </div>
              {pick(dish, "description", lang) && <p className="mt-2 text-sm text-slate-600">{pick(dish, "description", lang)}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 sm:grid"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {dish.modifier_groups.map((g) => {
            const need = g.is_required && (picked[g.id] || []).length < Math.max(1, g.min_select);
            return (
              <fieldset key={g.id} className="mt-5">
                <legend className="mb-2 flex w-full items-center justify-between gap-2">
                  <span className="font-semibold">{pick(g, "name", lang)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      g.is_required ? (need ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700") : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {g.is_required ? t("customer.required") : t("customer.optional")} ·{" "}
                    {g.max_select === 1 ? t("customer.chooseOne") : t("customer.chooseUpTo", { n: g.max_select })}
                  </span>
                </legend>
                <div className="grid gap-2">
                  {g.modifiers.map((m) => {
                    const on = (picked[g.id] || []).includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 transition ${
                          !m.available ? "cursor-not-allowed opacity-50" : on ? "border-brand bg-brand-50 ring-1 ring-brand" : "border-line hover:border-slate-300"
                        }`}
                      >
                        <input
                          type={g.max_select === 1 ? "radio" : "checkbox"}
                          name={`g${g.id}`}
                          disabled={!m.available}
                          checked={on}
                          onChange={() => toggle(g, m.id)}
                          className="sr-only"
                        />
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center border ${g.max_select === 1 ? "rounded-full" : "rounded"} ${
                            on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {pick(m, "name", lang)}
                          {!m.available && <span className="ml-1 text-xs font-normal text-muted">· {t("customer.unavailable")}</span>}
                        </span>
                        {m.price_delta > 0 && <span className="tabular text-sm text-muted">+{money(m.price_delta)}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label htmlFor="notes" className="mb-1.5 mt-5 block font-semibold">
            {t("customer.notes")}
          </label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} placeholder={t("customer.notesHint")} className={inputCls} />
        </div>

        {/* Sticky footer: quantity + add */}
        <div className="flex items-center gap-3 border-t border-line bg-white px-5 py-4">
          <div className="flex items-center rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="−"
              className="grid h-12 w-11 place-items-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              disabled={qty <= 1}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="tabular w-8 text-center text-lg font-bold" aria-label={t("customer.quantity")}>
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              aria-label="+"
              className="grid h-12 w-11 place-items-center text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
            </button>
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
            className="flex h-12 flex-1 items-center justify-between gap-2 rounded-lg bg-brand px-4 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="truncate">{valid ? t("customer.add") : `${t("customer.required")}: ${pick(missing[0], "name", lang)}`}</span>
            <span className="tabular">{money(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Placeholder tile for dishes without a photo. */
export function DishImage({ dish, lang, className = "" }) {
  return dish.photo_url ? (
    <img src={photoSrc(dish.photo_url)} alt={pick(dish, "name", lang)} className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand ${className}`} aria-hidden="true">
      <UtensilsCrossed className="h-8 w-8 opacity-70" />
    </div>
  );
}
