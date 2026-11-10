import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DollarSign, Receipt, Timer, TrendingUp, AlertTriangle, CalendarRange, BarChart3 } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { Alert, Button, Card, CardHeader, EmptyState, LoadingState, PageHeader, StatCard, inputCls } from "../components/ui.jsx";
import { api } from "../lib/api";
import { money, pick } from "../lib/format";

const COLORS = ["#0e7c6b", "#2563eb", "#f59e0b", "#7c3aed", "#dc2626", "#16a34a"];
const axis = { fontSize: 12, fill: "#64748b" };
const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: "1px solid #e6e8ec", boxShadow: "0 8px 24px -12px rgb(15 23 42 / .25)", fontSize: 13 },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
};

/** Manager dashboard: sales, categories, dishes, preparation time and food cost (all from the database). */
export default function Reports() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
    api(`/reports/summary${qs ? `?${qs}` : ""}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const header = (
    <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")}>
      {data && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-muted">
            {t("reports.from")}
            <input
              type="date"
              value={draft.from || data.range.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className={`${inputCls} mt-1 h-10 w-40`}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            {t("reports.to")}
            <input
              type="date"
              value={draft.to || data.range.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className={`${inputCls} mt-1 h-10 w-40`}
            />
          </label>
          <Button onClick={() => setRange(draft)} className="h-10">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            {t("reports.apply")}
          </Button>
        </div>
      )}
    </PageHeader>
  );

  if (error)
    return (
      <Layout>
        {header}
        <Alert>{t("reports.error")}</Alert>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        {header}
        <LoadingState />
      </Layout>
    );

  const byDish = data.by_dish.slice(0, 8).map((d) => ({ name: pick(d, "name", lang), revenue: d.revenue }));
  const byCategory = data.by_category.map((c) => ({ name: pick(c, "name", lang), value: c.revenue }));
  const categoryTotal = byCategory.reduce((s, c) => s + c.value, 0);
  const prep = data.totals.avg_prep_seconds == null ? "—" : (data.totals.avg_prep_seconds / 60).toFixed(1);
  const avgTicket = data.totals.bills > 0 ? data.totals.sales / data.totals.bills : 0;
  const highCount = data.food_cost.filter((d) => d.high).length;
  const empty = data.daily.length === 0;

  return (
    <Layout>
      {header}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label={t("reports.sales")} value={money(data.totals.sales)} icon={DollarSign} tone="brand" />
        <StatCard label={t("reports.bills")} value={data.totals.bills} icon={Receipt} tone="blue" />
        <StatCard label={t("reports.avgTicket")} value={money(avgTicket)} icon={TrendingUp} tone="violet" />
        <StatCard
          label={t("reports.avgPrep")}
          value={<>{prep} <span className="text-sm font-medium text-muted">{t("reports.minutes")}</span></>}
          icon={Timer}
          tone="amber"
        />
      </div>

      {empty ? (
        <Card className="mb-6">
          <EmptyState icon={BarChart3} title={t("reports.emptyTitle")} text={t("reports.empty")} />
        </Card>
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={t("reports.daily")} subtitle={`${data.range.from} → ${data.range.to}`} />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ left: -12, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0e7c6b" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0e7c6b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => money(v)} {...tooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="#0e7c6b" strokeWidth={2.5} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("reports.byCategory")} />
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {byCategory.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate text-slate-700">{c.name}</span>
                  <span className="tabular font-semibold">{money(c.value)}</span>
                  <span className="tabular w-10 text-right text-xs text-muted">
                    {categoryTotal ? Math.round((c.value / categoryTotal) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title={t("reports.byDish")} />
            <div style={{ height: Math.max(180, byDish.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDish} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="#eef0f3" horizontal={false} />
                  <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={140} tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: "#f5f6f8" }} {...tooltipStyle} />
                  <Bar dataKey="revenue" fill="#0e7c6b" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="p-5 pb-0">
          <CardHeader title={t("reports.foodCost")} subtitle={t("reports.foodCostHint")}>
            {highCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {highCount} {t("reports.high")}
              </span>
            )}
          </CardHeader>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead>
              <tr>
                <th>{t("reports.dish")}</th>
                <th className="text-right">{t("reports.price")}</th>
                <th className="text-right">{t("reports.cost")}</th>
                <th className="w-[40%]">{t("reports.pct")}</th>
              </tr>
            </thead>
            <tbody>
              {data.food_cost.map((d) => (
                <tr key={d.dish_id}>
                  <td className="font-medium">{pick(d, "name", lang)}</td>
                  <td className="text-right">{money(d.price)}</td>
                  <td className="text-right text-muted">{money(d.cost)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${d.high ? "bg-paying" : d.pct > 30 ? "bg-waiting" : "bg-free"}`}
                          style={{ width: `${Math.min(100, d.pct)}%` }}
                        />
                      </div>
                      <span className={`tabular w-14 text-right font-semibold ${d.high ? "text-red-700" : ""}`}>{d.pct}%</span>
                      {d.high && <AlertTriangle className="h-4 w-4 text-paying" aria-label={t("reports.high")} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
