import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Modal, inputCls, selectCls } from "../ui.jsx";
import { api } from "../../lib/api";
import { errorText } from "../../lib/errors";
import { pick } from "../../lib/format";

/** Create or edit a dish. A new dish starts unavailable until it has a recipe. */
export default function DishModal({
  dish,
  categories,
  defaultCategoryId,
  lang,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    category_id:
      dish?.category_id || defaultCategoryId || categories[0]?.id || "",
    name_so: dish?.name_so || "",
    name_en: dish?.name_en || "",
    description_so: dish?.description_so || "",
    description_en: dish?.description_en || "",
    price: dish?.price ?? "",
    prep_minutes: dish?.prep_minutes ?? 10,
    photo_url: dish?.photo_url || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        category_id: Number(form.category_id),
        price: Number(form.price),
        prep_minutes: Number(form.prep_minutes),
      };
      if (dish) {
        await api(`/menu-admin/dishes/${dish.id}`, { method: "PUT", body });
        onSaved(t("menuAdmin.saved"));
      } else {
        await api("/menu-admin/dishes", { method: "POST", body });
        onSaved(t("menuAdmin.newDishHint"));
      }
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={dish ? t("menuAdmin.editDish") : t("menuAdmin.addDish")}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={t("menuAdmin.category")}>
          <select
            required
            value={form.category_id}
            onChange={set("category_id")}
            className={selectCls}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c, "name", lang)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("menuAdmin.nameSo")}>
            <input
              required
              minLength={2}
              value={form.name_so}
              onChange={set("name_so")}
              className={inputCls}
            />
          </Field>
          <Field label={t("menuAdmin.nameEn")}>
            <input
              required
              minLength={2}
              value={form.name_en}
              onChange={set("name_en")}
              className={inputCls}
            />
          </Field>
          <Field label={t("menuAdmin.descSo")}>
            <input
              maxLength={500}
              value={form.description_so}
              onChange={set("description_so")}
              className={inputCls}
            />
          </Field>
          <Field label={t("menuAdmin.descEn")}>
            <input
              maxLength={500}
              value={form.description_en}
              onChange={set("description_en")}
              className={inputCls}
            />
          </Field>
          <Field label={t("menuAdmin.price")}>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={set("price")}
              className={inputCls}
            />
          </Field>
          <Field label={t("menuAdmin.prep")}>
            <input
              required
              type="number"
              min="1"
              max="240"
              value={form.prep_minutes}
              onChange={set("prep_minutes")}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label={t("menuAdmin.photo")} hint={t("menuAdmin.photoHint")}>
          <input
            value={form.photo_url}
            onChange={set("photo_url")}
            placeholder="https://"
            className={inputCls}
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {t("common.save")}
        </Button>
      </form>
    </Modal>
  );
}
