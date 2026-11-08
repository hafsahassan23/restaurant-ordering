import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Modal } from "../ui.jsx";
import IngredientRows from "./IngredientRows.jsx";
import { toIngredientPayload } from "../../lib/ingredients";
import { api } from "../../lib/api";
import { errorText } from "../../lib/errors";
import { pick } from "../../lib/format";

/** Edit the recipe of a dish (ingredients and quantity per portion). Old orders keep their own snapshot. */
export default function RecipeModal({
  dish,
  ingredients,
  lang,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/menu-admin/dishes/${dish.id}/recipe`)
      .then((r) => {
        if (!cancelled)
          setRows(
            r.map((x) => ({
              ingredientId: String(x.ingredient_id),
              qty: String(Number(x.qty_per_portion)),
            })),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dish.id]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/menu-admin/dishes/${dish.id}/recipe`, {
        method: "PUT",
        body: { items: toIngredientPayload(rows) },
      });
      onSaved();
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${t("menuAdmin.recipe")}: ${pick(dish, "name", lang)}`}
      onClose={onClose}
    >
      {error && <Alert>{error}</Alert>}
      <IngredientRows
        rows={rows}
        setRows={setRows}
        ingredients={ingredients}
        lang={lang}
      />
      <Button onClick={save} disabled={busy} className="mt-4 w-full">
        {t("menuAdmin.saveRecipe")}
      </Button>
    </Modal>
  );
}
