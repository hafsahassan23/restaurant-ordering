import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import ManagerNav from "../components/ManagerNav.jsx";
import { api } from "../lib/api";

export default function Settings() {
  const { t } = useTranslation();
  const [pct, setPct] = useState("");
  const [sms, setSms] = useState([]);
  const [audit, setAudit] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api("/bills/service-charge"),
      api("/sms-outbox"),
      api("/audit-logs"),
    ])
      .then(([sc, s, a]) => {
        if (!cancelled) {
          setPct(String(sc.pct));
          setSms(s);
          setAudit(a);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      await api("/bills/service-charge", {
        method: "PUT",
        body: { pct: Number(pct) },
      });
      setMsg(t("settings.saved"));
    } catch {
      setError(t("common.error"));
    }
  }

  return (
    <Layout>
      <ManagerNav />
      <h1 className="mb-3 text-2xl font-bold">{t("settings.title")}</h1>

      <form
        onSubmit={save}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4"
      >
        <label className="font-medium">
          {t("settings.serviceCharge")}
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="mt-1 block h-12 w-40 rounded-xl border border-line px-3"
          />
        </label>
        <button
          type="submit"
          className="h-12 rounded-xl bg-brand px-6 font-semibold text-white"
        >
          {t("settings.save")}
        </button>
        {msg && <span className="text-free">{msg}</span>}
        {error && (
          <span role="alert" className="text-paying">
            {error}
          </span>
        )}
      </form>

      <h2 className="mb-2 text-xl font-bold">{t("settings.sms")}</h2>
      {sms.length === 0 && (
        <p className="mb-6 text-slate-600">{t("settings.noSms")}</p>
      )}
      <ul className="mb-6 space-y-2">
        {sms.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-line bg-white p-3 text-sm"
          >
            <div className="font-semibold">
              {m.to_phone} · {new Date(m.created_at).toLocaleString()}
            </div>
            <div>{m.message}</div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-xl font-bold">{t("settings.audit")}</h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-4">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-slate-600">
              <th className="py-2">{t("settings.when")}</th>
              <th>{t("settings.who")}</th>
              <th>{t("settings.action")}</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} className="border-b border-line">
                <td className="py-2">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td>{a.username || "-"}</td>
                <td>
                  {a.action}
                  {a.entity
                    ? ` · ${a.entity}${a.entity_id ? ` #${a.entity_id}` : ""}`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
