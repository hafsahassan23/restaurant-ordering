import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Modal, inputCls } from "../ui.jsx";
import { api } from "../../lib/api";
import { errorText } from "../../lib/errors";

/** Create or rename a menu category. */
export default function CategoryModal({ category, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name_so: category?.name_so || "",
    name_en: category?.name_en || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (category)
        await api(`/menu-admin/categories/${category.id}`, {
          method: "PATCH",
          body: form,
        });
      else await api("/menu-admin/categories", { method: "POST", body: form });
      onSaved();
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        category ? t("menuAdmin.editCategory") : t("menuAdmin.addCategory")
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={t("menuAdmin.nameSo")}>
          <input
            required
            minLength={2}
            value={form.name_so}
            onChange={(e) => setForm({ ...form, name_so: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t("menuAdmin.nameEn")}>
          <input
            required
            minLength={2}
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
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
