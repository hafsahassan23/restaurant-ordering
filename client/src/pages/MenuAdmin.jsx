import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import { Alert, Badge, Button, Card, PageHeader } from "../components/ui.jsx";
import CategoryModal from "../components/menu/CategoryModal.jsx";
import DishModal from "../components/menu/DishModal.jsx";
import RecipeModal from "../components/menu/RecipeModal.jsx";
import ModifiersModal from "../components/menu/ModifiersModal.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { money, pick } from "../lib/format";

/** Manager: categories, dishes (create/edit/delete), Available switch, override, recipes and choices. */
export default function MenuAdmin() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [menu, setMenu] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { kind: 'category' | 'dish' | 'recipe' | 'options', data, categoryId }
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

  const reload = () => setVersion((v) => v + 1);
  const close = () => setModal(null);
  const saved = (message) => {
    close();
    setError("");
    setMsg(message || t("menuAdmin.saved"));
    reload();
  };

  async function run(fn, confirmFirst = false) {
    if (confirmFirst && !window.confirm(t("menuAdmin.confirmDelete"))) return;
    setError("");
    setMsg("");
    try {
      await fn();
      reload();
    } catch (err) {
      setError(errorText(t, "menuAdmin", err));
    }
  }

  const flag = (d, patch) =>
    run(() =>
      api(`/menu-admin/dishes/${d.id}`, { method: "PATCH", body: patch }),
    );
  const removeDish = (d) =>
    run(() => api(`/menu-admin/dishes/${d.id}`, { method: "DELETE" }), true);
  const removeCategory = (c) =>
    run(
      () => api(`/menu-admin/categories/${c.id}`, { method: "DELETE" }),
      true,
    );

  return (
    <Layout>
      <PageHeader
        title={t("menuAdmin.title")}
        subtitle={t("menuAdmin.subtitle")}
      >
        <Button
          variant="secondary"
          onClick={() => setModal({ kind: "category" })}
        >
          + {t("menuAdmin.addCategory")}
        </Button>
        <Button
          onClick={() => setModal({ kind: "dish" })}
          disabled={menu.length === 0}
        >
          + {t("menuAdmin.addDish")}
        </Button>
      </PageHeader>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert>{error}</Alert>}

      {menu.map((cat) => (
        <section key={cat.id} className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{pick(cat, "name", lang)}</h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setModal({ kind: "dish", categoryId: cat.id })}
              >
                + {t("menuAdmin.addDish")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setModal({ kind: "category", data: cat })}
              >
                {t("common.edit")}
              </Button>
              <Button variant="ghost" onClick={() => removeCategory(cat)}>
                {t("common.delete")}
              </Button>
            </div>
          </div>

          {cat.dishes.length === 0 && (
            <p className="text-slate-600">{t("menuAdmin.emptyCategory")}</p>
          )}
          <div className="space-y-3">
            {cat.dishes.map((d) => (
              <Card key={d.id} className="flex flex-wrap items-center gap-4">
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface text-3xl"
                    aria-hidden="true"
                  >
                    🍲
                  </div>
                )}
                <div className="min-w-48 flex-1">
                  <div className="text-lg font-semibold">
                    {pick(d, "name", lang)}
                  </div>
                  <div className="text-sm text-slate-600">
                    {money(d.price)} · ⏱ {d.prep_minutes}{" "}
                    {t("customer.minutes")}
                  </div>
                  <div className="mt-1">
                    <Badge tone={d.available ? "green" : "gray"}>
                      {d.available
                        ? t("menuAdmin.available")
                        : t(`menuAdmin.reasons.${d.unavailable_reason}`)}
                    </Badge>
                  </div>
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setModal({ kind: "recipe", data: d })}
                  >
                    {t("menuAdmin.recipe")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setModal({ kind: "options", data: d })}
                  >
                    {t("menuAdmin.options")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setModal({ kind: "dish", data: d })}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button variant="ghost" onClick={() => removeDish(d)}>
                    {t("common.delete")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {modal?.kind === "category" && (
        <CategoryModal
          category={modal.data}
          onClose={close}
          onSaved={() => saved()}
        />
      )}
      {modal?.kind === "dish" && (
        <DishModal
          dish={modal.data}
          categories={menu}
          defaultCategoryId={modal.categoryId}
          lang={lang}
          onClose={close}
          onSaved={saved}
        />
      )}
      {modal?.kind === "recipe" && (
        <RecipeModal
          dish={modal.data}
          ingredients={ingredients}
          lang={lang}
          onClose={close}
          onSaved={() => saved()}
        />
      )}
      {modal?.kind === "options" && (
        <ModifiersModal
          dish={modal.data}
          ingredients={ingredients}
          lang={lang}
          onClose={() => {
            close();
            reload();
          }}
        />
      )}
    </Layout>
  );
}
