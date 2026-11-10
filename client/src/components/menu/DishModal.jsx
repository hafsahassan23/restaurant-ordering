import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2, UtensilsCrossed } from "lucide-react";
import { Alert, Button, Field, Modal, Spinner, inputCls, selectCls } from "../ui.jsx";
import { api, photoSrc } from "../../lib/api";
import { errorText } from "../../lib/errors";
import { pick } from "../../lib/format";
import { shrinkImage } from "../../lib/photo";

/** Upload a data URL (after shrinking it) and return the stored photo address. */
async function uploadPhoto(dataUrl) {
  const small = await shrinkImage(dataUrl);
  const { url } = await api("/menu-admin/photos", { method: "POST", body: { dataUrl: small } });
  return url;
}

/** Create or edit a dish. A new dish starts unavailable until it has a recipe. */
export default function DishModal({ dish, categories, defaultCategoryId, lang, onClose, onSaved }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    category_id: dish?.category_id || defaultCategoryId || categories[0]?.id || "",
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
  const [uploading, setUploading] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  /** Turn any API error into a message; a bad photo gets its own message instead of the generic one. */
  const describe = (err) => {
    if (err.code === "VALIDATION" && err.details?.some((d) => d.field === "photo_url")) return t("menuAdmin.photoInvalid");
    if (err.code === "VALIDATION" && err.details?.some((d) => d.field === "price")) return t("menuAdmin.err.VALIDATION");
    if (err.code === "VALIDATION") return t("common.checkForm");
    if (err.code === "PHOTO_INVALID") return t("menuAdmin.photoInvalid");
    if (err.code === "PHOTO_TOO_BIG") return t("menuAdmin.photoTooBig");
    if (!err.status) return t("auth.network");
    return errorText(t, "menuAdmin", err);
  };

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("menuAdmin.photoInvalid"));
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (err) {
      setError(err.message === "not an image" ? t("menuAdmin.photoInvalid") : describe(err));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let photo = form.photo_url.trim();
      // A pasted "data:image/..." picture is uploaded first, then saved as a short address
      if (photo.startsWith("data:image/")) {
        photo = await uploadPhoto(photo);
        setForm((f) => ({ ...f, photo_url: photo }));
      } else if (photo && !/^(https?:\/\/|\/)/.test(photo)) {
        throw Object.assign(new Error("bad photo"), { code: "PHOTO_INVALID", status: 400 });
      }
      const body = {
        ...form,
        photo_url: photo,
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
      setError(err.message === "not an image" ? t("menuAdmin.photoInvalid") : describe(err));
    } finally {
      setBusy(false);
    }
  }

  const preview = form.photo_url.trim();

  return (
    <Modal title={dish ? t("menuAdmin.editDish") : t("menuAdmin.addDish")} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert onClose={() => setError("")}>{error}</Alert>}

        {/* Photo */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-slate-50/60 p-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-50 text-brand">
            {uploading ? (
              <Spinner className="h-6 w-6" />
            ) : preview && /^(https?:\/\/|\/|data:image\/)/.test(preview) ? (
              <img src={photoSrc(preview)} alt="" className="h-full w-full object-cover" />
            ) : (
              <UtensilsCrossed className="h-8 w-8 opacity-70" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-48 flex-1 space-y-2">
            <p className="text-sm font-medium text-slate-700">{t("menuAdmin.photoTitle")}</p>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} className="sr-only" tabIndex={-1} />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {preview ? t("menuAdmin.changePhoto") : t("menuAdmin.uploadPhoto")}
              </Button>
              {preview && (
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setForm({ ...form, photo_url: "" })}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("menuAdmin.removePhoto")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">{t("menuAdmin.photoUploadHint")}</p>
          </div>
        </div>

        <Field label={t("menuAdmin.category")}>
          <select required value={form.category_id} onChange={set("category_id")} className={selectCls}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c, "name", lang)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("menuAdmin.nameSo")}>
            <input required minLength={2} value={form.name_so} onChange={set("name_so")} className={inputCls} />
          </Field>
          <Field label={t("menuAdmin.nameEn")}>
            <input required minLength={2} value={form.name_en} onChange={set("name_en")} className={inputCls} />
          </Field>
          <Field label={t("menuAdmin.descSo")}>
            <input maxLength={500} value={form.description_so} onChange={set("description_so")} className={inputCls} />
          </Field>
          <Field label={t("menuAdmin.descEn")}>
            <input maxLength={500} value={form.description_en} onChange={set("description_en")} className={inputCls} />
          </Field>
          <Field label={t("menuAdmin.price")}>
            <input required type="number" step="0.01" min="0.01" value={form.price} onChange={set("price")} className={inputCls} />
          </Field>
          <Field label={t("menuAdmin.prep")}>
            <input required type="number" min="1" max="240" value={form.prep_minutes} onChange={set("prep_minutes")} className={inputCls} />
          </Field>
        </div>
        <Field label={t("menuAdmin.photoLink")} hint={t("menuAdmin.photoHint")}>
          <input
            value={form.photo_url.startsWith("data:") ? t("menuAdmin.photoPasted") : form.photo_url}
            onChange={set("photo_url")}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text.startsWith("data:image/")) {
                e.preventDefault();
                setForm((f) => ({ ...f, photo_url: text }));
              }
            }}
            placeholder="https://"
            className={inputCls}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={uploading}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
