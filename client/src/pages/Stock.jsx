import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, AlertTriangle, Wallet, Search, ArrowDownLeft, ArrowUpRight, PackagePlus, History } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, LoadingState, PageHeader, StatCard, inputCls, selectCls } from "../components/ui.jsx";
import { api } from "../lib/api";
import { money, pick } from "../lib/format";

const empty = { ingredientId: "", reason: "delivery", qty: "", unitCost: "", note: "" };
const REASON_TONE = { sale: "blue", delivery: "green", waste: "red", adjustment: "gray" };

/** Manager: stock levels with low-stock flags, record deliveries/waste/adjustments, movement log. */
export default function Stock() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [items, setItems] = useState(null);
  const [moves, setMoves] = useState([]);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/stock/ingredients"), api("/stock/movements")])
      .then(([a, b]) => {
        if (!cancelled) {
          setItems(a);
          setMoves(b);
        }
      })
      .catch(() => !cancelled && setError(t("stock.err.generic")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      const body = { ingredientId: Number(form.ingredientId), reason: form.reason, qty: Number(form.qty) };
      if (form.reason === "delivery" && form.unitCost !== "") body.unitCost = Number(form.unitCost);
      if (form.note) body.note = form.note;
      await api("/stock/movements", { method: "POST", body });
      setForm({ ...form, qty: "", unitCost: "", note: "" });
      setSaved(true);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(t(`stock.err.${err.code}`, { defaultValue: t("stock.err.generic") }));
    } finally {
      setBusy(false);
    }
  }

  const list = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !lowOnly || i.low)
      .filter((i) => !q || `${i.name_so} ${i.name_en}`.toLowerCase().includes(q));
  }, [items, query, lowOnly]);

  if (!items) {
    return (
      <Layout>
        <PageHeader title={t("stock.title")} subtitle={t("stock.subtitle")} />
        {error ? <Alert>{error}</Alert> : <LoadingState />}
      </Layout>
    );
  }

  const lowCount = items.filter((i) => i.low).length;
  const value = items.reduce((s, i) => s + i.stock_qty * i.cost_per_unit, 0);
  const selected = items.find((i) => String(i.id) === String(form.ingredientId));

  return (
    <Layout>
      <PageHeader title={t("stock.title")} subtitle={t("stock.subtitle")} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <StatCard label={t("stock.ingredients")} value={items.length} icon={Package} tone="brand" />
        <StatCard
          label={t("stock.lowCount")}
          value={lowCount}
          icon={AlertTriangle}
          tone={lowCount ? "red" : "green"}
          hint={lowCount ? t("stock.lowHint") : t("stock.allGood")}
        />
        <StatCard label={t("stock.value")} value={money(value)} icon={Wallet} tone="violet" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Stock levels */}
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("stock.search")}
                aria-label={t("stock.search")}
                className={`${inputCls} h-10 pl-9`}
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 accent-brand" />
              {t("stock.lowOnly")}
            </label>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={Package} title={t("stock.noMatch")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>{t("stock.ingredient")}</th>
                    <th className="w-[34%]">{t("stock.qty")}</th>
                    <th className="text-right">{t("stock.min")}</th>
                    <th className="text-right">{t("stock.cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const ratio = i.min_level > 0 ? i.stock_qty / (i.min_level * 3) : 1;
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pick(i, "name", lang)}</span>
                            {i.low && <Badge tone="red">{t("stock.low")}</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="tabular w-24 font-semibold">
                              {i.stock_qty} <span className="font-normal text-muted">{i.unit}</span>
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${i.low ? "bg-paying" : ratio < 0.6 ? "bg-waiting" : "bg-free"}`}
                                style={{ width: `${Math.max(3, Math.min(100, ratio * 100))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-muted">
                          {i.min_level} {i.unit}
                        </td>
                        <td className="text-right">{money(i.cost_per_unit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Record a movement */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader title={t("stock.record")} subtitle={t("stock.recordHint")} icon={PackagePlus} />
          {error && <Alert onClose={() => setError("")}>{error}</Alert>}
          {saved && <Alert tone="success" onClose={() => setSaved(false)}>{t("stock.saved")}</Alert>}
          <form onSubmit={submit} className="space-y-4">
            <Field label={t("stock.ingredient")}>
              <select value={form.ingredientId} onChange={set("ingredientId")} required className={selectCls}>
                <option value="">{t("stock.choose")}</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {pick(i, "name", lang)} ({i.unit})
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("stock.reason")}</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {["delivery", "waste", "adjustment"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, reason: r })}
                    aria-pressed={form.reason === r}
                    className={`h-9 rounded-md text-xs font-semibold transition ${
                      form.reason === r ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    {t(`stock.${r}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t("stock.amount")}${selected ? ` (${selected.unit})` : ""}`}>
                <input type="number" step="0.001" required value={form.qty} onChange={set("qty")} className={inputCls} />
              </Field>
              {form.reason === "delivery" && (
                <Field label={t("stock.unitCost")}>
                  <input type="number" step="0.01" min="0" value={form.unitCost} onChange={set("unitCost")} className={inputCls} />
                </Field>
              )}
            </div>
            <Field label={t("stock.note")}>
              <input value={form.note} onChange={set("note")} maxLength={255} className={inputCls} />
            </Field>
            <Button type="submit" loading={busy} className="w-full">
              {t("stock.submit")}
            </Button>
          </form>
        </Card>
      </div>

      {/* Movement log */}
      <Card className="mt-6 overflow-hidden p-0">
        <div className="p-5 pb-0">
          <CardHeader title={t("stock.movements")} icon={History} />
        </div>
        {moves.length === 0 ? (
          <EmptyState title={t("stock.noMoves")} />
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th>{t("stock.when")}</th>
                  <th>{t("stock.ingredient")}</th>
                  <th>{t("stock.reason")}</th>
                  <th className="text-right">{t("stock.change")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => {
                  const out = Number(m.change_qty) < 0;
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-muted">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="font-medium">{pick(m, "name", lang)}</td>
                      <td>
                        <Badge tone={REASON_TONE[m.reason]}>{t(`stock.${m.reason}`)}</Badge>
                      </td>
                      <td className={`text-right font-semibold ${out ? "text-red-600" : "text-green-700"}`}>
                        <span className="inline-flex items-center gap-1">
                          {out ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          {out ? "" : "+"}
                          {Number(m.change_qty)} {m.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
}
