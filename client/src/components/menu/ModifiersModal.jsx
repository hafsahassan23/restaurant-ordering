import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Button, Field, Modal, inputCls } from "../ui.jsx";
import IngredientRows from "./IngredientRows.jsx";
import { toIngredientPayload } from "../../lib/ingredients";
import { api } from "../../lib/api";
import { errorText } from "../../lib/errors";
import { money, pick } from "../../lib/format";

function GroupForm({ dishId, group, onDone, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name_so: group?.name_so || "",
    name_en: group?.name_en || "",
    is_required: group?.is_required || false,
    min_select: group?.min_select ?? 0,
    max_select: group?.max_select ?? 1,
  });
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...form,
      min_select: Number(form.min_select),
      max_select: Number(form.max_select),
    };
    try {
      if (group)
        await api(`/menu-admin/groups/${group.id}`, { method: "PUT", body });
      else
        await api(`/menu-admin/dishes/${dishId}/groups`, {
          method: "POST",
          body,
        });
      onDone();
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
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
        <Field label={t("menuAdmin.minSelect")}>
          <input
            type="number"
            min="0"
            max="20"
            value={form.min_select}
            onChange={set("min_select")}
            className={inputCls}
          />
        </Field>
        <Field label={t("menuAdmin.maxSelect")}>
          <input
            type="number"
            min="1"
            max="20"
            value={form.max_select}
            onChange={set("max_select")}
            className={inputCls}
          />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={form.is_required}
          onChange={(e) =>
            setForm({
              ...form,
              is_required: e.target.checked,
              min_select: e.target.checked
                ? Math.max(1, Number(form.min_select))
                : form.min_select,
            })
          }
        />
        {t("menuAdmin.required")}
      </label>
      <div className="flex gap-2">
        <Button type="submit">{t("common.save")}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function ModifierForm({
  groupId,
  modifier,
  ingredients,
  lang,
  onDone,
  onCancel,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name_so: modifier?.name_so || "",
    name_en: modifier?.name_en || "",
    price_delta: modifier?.price_delta ?? 0,
  });
  const [rows, setRows] = useState(
    (modifier?.ingredients || []).map((i) => ({
      ingredientId: String(i.ingredient_id),
      qty: String(i.qty),
    })),
  );
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...form,
      price_delta: Number(form.price_delta),
      ingredients: toIngredientPayload(rows),
    };
    try {
      if (modifier)
        await api(`/menu-admin/modifiers/${modifier.id}`, {
          method: "PUT",
          body,
        });
      else
        await api(`/menu-admin/groups/${groupId}/modifiers`, {
          method: "POST",
          body,
        });
      onDone();
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
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
        <Field label={t("menuAdmin.priceDelta")}>
          <input
            type="number"
            step="0.01"
            value={form.price_delta}
            onChange={set("price_delta")}
            className={inputCls}
          />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold">
          {t("menuAdmin.choiceIngredients")}
        </div>
        <IngredientRows
          rows={rows}
          setRows={setRows}
          ingredients={ingredients}
          lang={lang}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">{t("common.save")}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Manage the choice groups of a dish and the choices inside each group. */
export default function ModifiersModal({ dish, ingredients, lang, onClose }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState(null); // { kind: 'group', group? } | { kind: 'modifier', groupId, modifier? }
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api(`/menu-admin/dishes/${dish.id}/detail`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dish.id, version]);

  const done = () => {
    setPanel(null);
    setVersion((v) => v + 1);
  };

  async function remove(path) {
    if (!window.confirm(t("menuAdmin.confirmDelete"))) return;
    setError("");
    try {
      await api(path, { method: "DELETE" });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    }
  }

  return (
    <Modal
      title={`${t("menuAdmin.options")}: ${pick(dish, "name", lang)}`}
      onClose={onClose}
      wide
    >
      {error && <Alert>{error}</Alert>}

      {panel?.kind === "group" && (
        <GroupForm
          dishId={dish.id}
          group={panel.group}
          onDone={done}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.kind === "modifier" && (
        <ModifierForm
          groupId={panel.groupId}
          modifier={panel.modifier}
          ingredients={ingredients}
          lang={lang}
          onDone={done}
          onCancel={() => setPanel(null)}
        />
      )}

      {!panel && detail && (
        <div className="space-y-4">
          {detail.groups.length === 0 && (
            <p className="text-slate-600">{t("menuAdmin.noGroups")}</p>
          )}
          {detail.groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">
                  {pick(g, "name", lang)}{" "}
                  {g.is_required && (
                    <Badge tone="amber">{t("menuAdmin.required")}</Badge>
                  )}{" "}
                  <span className="text-sm font-normal text-slate-600">
                    {g.min_select}–{g.max_select}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPanel({ kind: "group", group: g })}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => remove(`/menu-admin/groups/${g.id}`)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {g.modifiers.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      {pick(m, "name", lang)}{" "}
                      {m.price_delta !== 0 && (
                        <span className="text-slate-600">
                          ({m.price_delta > 0 ? "+" : ""}
                          {money(m.price_delta)})
                        </span>
                      )}
                    </span>
                    <span className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setPanel({
                            kind: "modifier",
                            groupId: g.id,
                            modifier: m,
                          })
                        }
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => remove(`/menu-admin/modifiers/${m.id}`)}
                      >
                        {t("common.delete")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => setPanel({ kind: "modifier", groupId: g.id })}
              >
                + {t("menuAdmin.addChoice")}
              </Button>
            </div>
          ))}
          <Button onClick={() => setPanel({ kind: "group" })}>
            + {t("menuAdmin.addGroup")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
