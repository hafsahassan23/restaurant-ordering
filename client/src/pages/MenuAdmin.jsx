import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import ManagerNav from "../components/ManagerNav.jsx";
import { api } from "../lib/api";
import { money, pick } from "../lib/format";

const input = "h-11 rounded-xl border border-line bg-white px-3";

export default function MenuAdmin() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [menu, setMenu] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/public/menu"), api("/stock/ingredients")])
      .then(([m, i]) => {
        if (!cancelled) {
          setMenu(m);
          setIngredients(i);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const fail = (e) =>
    setError(
      t(`menuAdmin.err.${e.code}`, {
        defaultValue: t("menuAdmin.err.generic"),
      }),
    );

  async function flag(dish, patch) {
    setError("");
    setMsg("");
    try {
      await api(`/menu-admin/dishes/${dish.id}`, {
        method: "PATCH",
        body: patch,
      });
      setVersion((v) => v + 1);
    } catch (e) {
      fail(e);
    }
  }

  async function openRecipe(dish) {
    setError("");
    setMsg("");
    const recipe = await api(`/menu-admin/dishes/${dish.id}/recipe`);
    setRows(
      recipe.map((r) => ({
        ingredientId: String(r.ingredient_id),
        qty: String(Number(r.qty_per_portion)),
      })),
    );
    setOpenId(dish.id);
  }

  async function saveRecipe() {
    setError("");
    try {
      const items = rows
        .filter((r) => r.ingredientId && Number(r.qty) > 0)
        .map((r) => ({
          ingredientId: Number(r.ingredientId),
          qty: Number(r.qty),
        }));
      await api(`/menu-admin/dishes/${openId}/recipe`, {
        method: "PUT",
        body: { items },
      });
      setMsg(t("menuAdmin.saved"));
      setVersion((v) => v + 1);
    } catch (e) {
      fail(e);
    }
  }

  const setRow = (i, patch) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <Layout>
      <ManagerNav />
      <h1 className="mb-3 text-2xl font-bold">{t("menuAdmin.title")}</h1>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-3 rounded-xl bg-green-50 p-3 text-green-900">
          {msg}
        </div>
      )}

      {menu.map((cat) => (
        <section key={cat.id} className="mb-6">
          <h2 className="mb-2 text-xl font-bold">{pick(cat, "name", lang)}</h2>
          <div className="space-y-2">
            {cat.dishes.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-line bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">
                      {pick(d, "name", lang)} · {money(d.price)}
                    </div>
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${d.available ? "bg-free text-white" : "bg-slate-300 text-slate-900"}`}
                    >
                      {d.available
                        ? t("menuAdmin.available")
                        : t(`menuAdmin.reasons.${d.unavailable_reason}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={d.is_available}
                        onChange={(e) =>
                          flag(d, { is_available: e.target.checked })
                        }
                      />
                      {t("menuAdmin.available")}
                    </label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={d.force_unavailable}
                        onChange={(e) =>
                          flag(d, { force_unavailable: e.target.checked })
                        }
                      />
                      {t("menuAdmin.force")}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        openId === d.id ? setOpenId(null) : openRecipe(d)
                      }
                      className="h-11 rounded-xl border border-line px-4 font-semibold"
                    >
                      {openId === d.id
                        ? t("menuAdmin.hide")
                        : t("menuAdmin.recipe")}
                    </button>
                  </div>
                </div>

                {openId === d.id && (
                  <div className="mt-4 space-y-2 border-t border-line pt-4">
                    {rows.map((r, i) => (
                      <div key={i} className="flex flex-wrap gap-2">
                        <select
                          value={r.ingredientId}
                          onChange={(e) =>
                            setRow(i, { ingredientId: e.target.value })
                          }
                          className={`${input} min-w-48 flex-1`}
                          aria-label={t("menuAdmin.ingredient")}
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
                          onChange={(e) => setRow(i, { qty: e.target.value })}
                          placeholder={t("menuAdmin.qtyPerPortion")}
                          className={`${input} w-40`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setRows((rs) => rs.filter((_, k) => k !== i))
                          }
                          className="h-11 w-11 rounded-xl border border-line"
                          aria-label={t("common.delete")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRows((rs) => [
                            ...rs,
                            { ingredientId: "", qty: "" },
                          ])
                        }
                        className="h-11 rounded-xl border border-line px-4 font-semibold"
                      >
                        + {t("menuAdmin.addIngredient")}
                      </button>
                      <button
                        type="button"
                        onClick={saveRecipe}
                        className="h-11 rounded-xl bg-brand px-5 font-semibold text-white"
                      >
                        {t("menuAdmin.saveRecipe")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </Layout>
  );
}
