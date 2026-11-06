import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import ManagerNav from "../components/ManagerNav.jsx";
import { api } from "../lib/api";
import { money, pick } from "../lib/format";

const input = "h-12 w-full rounded-xl border border-line bg-white px-3";
const empty = {
  ingredientId: "",
  reason: "delivery",
  qty: "",
  unitCost: "",
  note: "",
};

export default function Stock() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [items, setItems] = useState([]);
  const [moves, setMoves] = useState([]);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/stock/ingredients"), api("/stock/movements")])
      .then(([a, b]) => {
        if (!cancelled) {
          setItems(a);
          setMoves(b);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const body = {
        ingredientId: Number(form.ingredientId),
        reason: form.reason,
        qty: Number(form.qty),
      };
      if (form.reason === "delivery" && form.unitCost !== "")
        body.unitCost = Number(form.unitCost);
      if (form.note) body.note = form.note;
      await api("/stock/movements", { method: "POST", body });
      setForm({ ...form, qty: "", unitCost: "", note: "" });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(
        t(`stock.err.${err.code}`, { defaultValue: t("stock.err.generic") }),
      );
    }
  }

  return (
    <Layout>
      <ManagerNav />
      <h1 className="mb-3 text-2xl font-bold">{t("stock.title")}</h1>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <select
          value={form.ingredientId}
          onChange={set("ingredientId")}
          required
          className={input}
          aria-label={t("stock.ingredient")}
        >
          <option value="">{t("stock.choose")}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {pick(i, "name", lang)} ({i.unit})
            </option>
          ))}
        </select>
        <select
          value={form.reason}
          onChange={set("reason")}
          className={input}
          aria-label={t("stock.reason")}
        >
          {["delivery", "waste", "adjustment"].map((r) => (
            <option key={r} value={r}>
              {t(`stock.${r}`)}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.001"
          required
          placeholder={t("stock.amount")}
          value={form.qty}
          onChange={set("qty")}
          className={input}
        />
        {form.reason === "delivery" && (
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={t("stock.unitCost")}
            value={form.unitCost}
            onChange={set("unitCost")}
            className={input}
          />
        )}
        <button
          type="submit"
          className="h-12 rounded-xl bg-brand font-semibold text-white"
        >
          {t("stock.submit")}
        </button>
      </form>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-line bg-white p-4">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-line text-sm text-slate-600">
              <th className="py-2">{t("stock.ingredient")}</th>
              <th>{t("stock.qty")}</th>
              <th>{t("stock.min")}</th>
              <th>{t("stock.cost")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr
                key={i.id}
                className={`border-b border-line ${i.low ? "bg-red-50" : ""}`}
              >
                <td className="py-2">{pick(i, "name", lang)}</td>
                <td>
                  {i.stock_qty} {i.unit}
                </td>
                <td>
                  {i.min_level} {i.unit}
                </td>
                <td>{money(i.cost_per_unit)}</td>
                <td>
                  {i.low && (
                    <span className="rounded-full bg-paying px-3 py-1 text-sm font-semibold text-white">
                      {t("stock.low")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-xl font-bold">{t("stock.movements")}</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {moves.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
          >
            <span>{new Date(m.created_at).toLocaleString()}</span>
            <span className="font-semibold">{pick(m, "name", lang)}</span>
            <span
              className={Number(m.change_qty) < 0 ? "text-paying" : "text-free"}
            >
              {Number(m.change_qty) > 0 ? "+" : ""}
              {Number(m.change_qty)} {m.unit}
            </span>
            <span>{t(`stock.${m.reason}`)}</span>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
