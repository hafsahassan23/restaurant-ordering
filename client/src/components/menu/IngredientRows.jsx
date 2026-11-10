
import { Plus, Trash2 } from "lucide-react";

import { useTranslation } from 'react-i18next';
import { Button, inputCls, selectCls } from '../ui.jsx';
import { pick } from '../../lib/format';

/** Editable rows of ingredient + quantity (used by recipes and by modifier choices). */

export default function IngredientRows({ rows, setRows, ingredients, lang }) {
  const { t } = useTranslation();
  const set = (i, patch) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <select
            value={r.ingredientId}
            onChange={(e) => set(i, { ingredientId: e.target.value })}
            aria-label={t("menuAdmin.ingredient")}
            className={`${selectCls} min-w-48 flex-1`}
          >
            <option value="" />
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {pick(ing, "name", lang)} ({ing.unit})
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.001"
            min="0"
            value={r.qty}
            onChange={(e) => set(i, { qty: e.target.value })}
            placeholder={t("menuAdmin.qtyPerPortion")}
            className={`${inputCls} w-40`}
          />
          <Button
            variant="secondary"
            className="w-11 px-0"
            aria-label={t("common.delete")}
            onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setRows((rs) => [...rs, { ingredientId: "", qty: "" }])}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("menuAdmin.addIngredient")}
      </Button>
    </div>
  );
}
