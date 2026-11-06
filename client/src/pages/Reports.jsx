import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "../components/Layout.jsx";
import ManagerNav from "../components/ManagerNav.jsx";
import { api } from "../lib/api";
import { money, pick } from "../lib/format";

const COLORS = [
  "#0f766e",
  "#2563eb",
  "#f59e0b",
  "#7c3aed",
  "#dc2626",
  "#16a34a",
];
const card = "rounded-2xl border border-line bg-white p-4";

export default function Reports() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams(
      Object.entries(range).filter(([, v]) => v),
    ).toString();
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

  if (error)
    return (
      <Layout>
        <ManagerNav />
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {t("reports.error")}
        </p>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <ManagerNav />
        <p>{t("common.loading")}</p>
      </Layout>
    );

  const byDish = data.by_dish.map((d) => ({
    name: pick(d, "name", lang),
    revenue: d.revenue,
  }));
  const byCategory = data.by_category.map((c) => ({
    name: pick(c, "name", lang),
    value: c.revenue,
  }));
  const prep =
    data.totals.avg_prep_seconds == null
      ? "—"
      : (data.totals.avg_prep_seconds / 60).toFixed(1);

  return (
    <Layout>
      <ManagerNav />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t("reports.title")}</h1>
        <label className="text-sm font-medium">
          {t("reports.from")}
          <input
            type="date"
            value={draft.from || data.range.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="ml-2 h-11 rounded-xl border border-line px-3"
          />
        </label>
        <label className="text-sm font-medium">
          {t("reports.to")}
          <input
            type="date"
            value={draft.to || data.range.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="ml-2 h-11 rounded-xl border border-line px-3"
          />
        </label>
        <button
          type="button"
          onClick={() => setRange(draft)}
          className="h-11 rounded-xl bg-brand px-5 font-semibold text-white"
        >
          {t("reports.apply")}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className={card}>
          <div className="text-sm text-slate-600">{t("reports.sales")}</div>
          <div className="text-3xl font-bold">{money(data.totals.sales)}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-600">{t("reports.bills")}</div>
          <div className="text-3xl font-bold">{data.totals.bills}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-600">{t("reports.avgPrep")}</div>
          <div className="text-3xl font-bold">
            {prep} <span className="text-base">{t("reports.minutes")}</span>
          </div>
        </div>
      </div>

      {data.daily.length === 0 && (
        <p className="mb-4 rounded-xl border border-dashed border-line bg-white p-4 text-slate-600">
          {t("reports.empty")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h2 className="mb-2 font-bold">{t("reports.daily")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(v) => money(v)} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0f766e"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={card}>
          <h2 className="mb-2 font-bold">{t("reports.byCategory")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${card} lg:col-span-2`}>
          <h2 className="mb-2 font-bold">{t("reports.byDish")}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDish}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="revenue" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={`${card} mt-4 overflow-x-auto`}>
        <h2 className="mb-2 font-bold">{t("reports.foodCost")}</h2>
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="border-b border-line text-sm text-slate-600">
              <th className="py-2">{t("reports.dish")}</th>
              <th>{t("reports.price")}</th>
              <th>{t("reports.cost")}</th>
              <th>{t("reports.pct")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.food_cost.map((d) => (
              <tr
                key={d.dish_id}
                className={`border-b border-line ${d.high ? "bg-red-50 font-semibold text-red-800" : ""}`}
              >
                <td className="py-2">{pick(d, "name", lang)}</td>
                <td>{money(d.price)}</td>
                <td>{money(d.cost)}</td>
                <td>{d.pct}%</td>
                <td>{d.high ? `⚠ ${t("reports.high")}` : t("reports.ok")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
