import { useState } from "react";
import { useTranslation } from "react-i18next";
import { money, pick } from "../lib/format";

/** Bottom sheet: choose modifiers, notes and quantity for one dish. Used by customers and waiters. */
export default function DishSheet({ dish, lang, onClose, onAdd }) {
  const { t } = useTranslation();
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
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute bottom-0 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
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
