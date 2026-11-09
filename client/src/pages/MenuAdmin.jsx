import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Pencil, Trash2, ScrollText, SlidersHorizontal, Clock, UtensilsCrossed, Search, FolderOpen,
} from "lucide-react";
import Layout from "../components/Layout.jsx";
import { Alert, Badge, Button, Card, EmptyState, IconButton, LoadingState, PageHeader, Switch, inputCls } from "../components/ui.jsx";
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
  const [menu, setMenu] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { kind: 'category' | 'dish' | 'recipe' | 'options', data, categoryId }
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [catId, setCatId] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/public/menu"), api("/stock/ingredients")])
      .then(([m, i]) => {
        if (!cancelled) {
          setMenu(m);
          setIngredients(i);
        }
      })
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

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

  const flag = (d, patch) => run(() => api(`/menu-admin/dishes/${d.id}`, { method: "PATCH", body: patch }));
  const removeDish = (d) => run(() => api(`/menu-admin/dishes/${d.id}`, { method: "DELETE" }), true);
  const removeCategory = (c) => run(() => api(`/menu-admin/categories/${c.id}`, { method: "DELETE" }), true);

  const categories = useMemo(() => menu || [], [menu]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => catId === "all" || c.id === catId)
      .map((c) => ({
        ...c,
        dishes: c.dishes.filter((d) => !q || `${d.name_so} ${d.name_en}`.toLowerCase().includes(q)),
      }));
  }, [categories, catId, query]);

  const allDishes = categories.flatMap((c) => c.dishes);
  const availableCount = allDishes.filter((d) => d.available).length;

  return (
    <Layout>
      <PageHeader title={t("menuAdmin.title")} subtitle={t("menuAdmin.subtitle")}>
        <Button variant="secondary" onClick={() => setModal({ kind: "category" })}>
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          {t("menuAdmin.addCategory")}
        </Button>
        <Button onClick={() => setModal({ kind: "dish", categoryId: catId === "all" ? undefined : catId })} disabled={categories.length === 0}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("menuAdmin.addDish")}
        </Button>
      </PageHeader>
      {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {error && <Alert onClose={() => setError("")}>{error}</Alert>}

      {!menu ? (
        <LoadingState />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Categories */}
          <Card className="p-2 lg:sticky lg:top-6">
            <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("menuAdmin.categories")}</p>
            <nav className="scroll-thin flex gap-1 overflow-x-auto lg:flex-col">
              {[{ id: "all", label: t("menuAdmin.allDishes"), count: allDishes.length }, ...categories.map((c) => ({ id: c.id, label: pick(c, "name", lang), count: c.dishes.length }))].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(c.id)}
                  className={`flex h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                    catId === c.id ? "bg-brand-50 text-brand-dark" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className={`tabular rounded-full px-2 text-xs ${catId === c.id ? "bg-white text-brand-dark" : "bg-slate-100 text-muted"}`}>
                    {c.count}
                  </span>
                </button>
              ))}
            </nav>
            <p className="mt-3 border-t border-line px-3 pt-3 text-xs text-muted">
              {availableCount} / {allDishes.length} {t("menuAdmin.availableNow")}
            </p>
          </Card>

          {/* Dishes */}
          <div className="min-w-0 space-y-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("menuAdmin.search")} aria-label={t("menuAdmin.search")} className={`${inputCls} pl-9`} />
            </div>

            {shown.map((cat) => (
              <section key={cat.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{pick(cat, "name", lang)}</h2>
                    <span className="text-sm text-muted">· {cat.dishes.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setModal({ kind: "dish", categoryId: cat.id })}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t("menuAdmin.addDish")}
                    </Button>
                    <IconButton label={t("common.edit")} onClick={() => setModal({ kind: "category", data: cat })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t("common.delete")} onClick={() => removeCategory(cat)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                {cat.dishes.length === 0 ? (
                  <Card className="border-dashed p-0 shadow-none">
                    <EmptyState icon={UtensilsCrossed} title={t("menuAdmin.emptyCategory")} className="py-8" />
                  </Card>
                ) : (
                  <Card className="divide-y divide-line p-0">
                    {cat.dishes.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center gap-4 p-4">
                        {d.photo_url ? (
                          <img src={d.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand" aria-hidden="true">
                            <UtensilsCrossed className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-44 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{pick(d, "name", lang)}</span>
                            <Badge tone={d.available ? "green" : d.unavailable_reason === "out_of_stock" ? "red" : "gray"}>
                              {d.available ? t("menuAdmin.available") : t(`menuAdmin.reasons.${d.unavailable_reason}`)}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-sm text-muted">
                            <span className="tabular font-semibold text-ink">{money(d.price)}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {d.prep_minutes} {t("customer.minutes")}
                            </span>
                            {d.modifier_groups.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                                {d.modifier_groups.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                          <Switch checked={d.is_available} onChange={(v) => flag(d, { is_available: v })} label={t("menuAdmin.available")} />
                          <Switch checked={d.force_unavailable} onChange={(v) => flag(d, { force_unavailable: v })} label={t("menuAdmin.force")} tone="red" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setModal({ kind: "recipe", data: d })}>
                            <ScrollText className="h-4 w-4" aria-hidden="true" />
                            {t("menuAdmin.recipe")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setModal({ kind: "options", data: d })}>
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                            {t("menuAdmin.options")}
                          </Button>
                          <IconButton label={t("common.edit")} onClick={() => setModal({ kind: "dish", data: d })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={t("common.delete")} onClick={() => removeDish(d)} className="hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {modal?.kind === "category" && <CategoryModal category={modal.data} onClose={close} onSaved={() => saved()} />}
      {modal?.kind === "dish" && (
        <DishModal dish={modal.data} categories={categories} defaultCategoryId={modal.categoryId} lang={lang} onClose={close} onSaved={saved} />
      )}
      {modal?.kind === "recipe" && (
        <RecipeModal dish={modal.data} ingredients={ingredients} lang={lang} onClose={close} onSaved={() => saved()} />
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
