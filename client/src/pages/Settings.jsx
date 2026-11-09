import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Percent, MessageSquare, ShieldCheck, Smartphone } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, inputCls } from "../components/ui.jsx";
import { Tabs } from "../components/Tabs.jsx";
import { api } from "../lib/api";

const actionTone = (action) =>
  /FAILED|CANCEL|REJECT|DELETE/.test(action) ? "red" : /PAYMENT|BILL/.test(action) ? "green" : /STOCK|RECIPE/.test(action) ? "amber" : "gray";

/** Manager: service charge, simulated SMS outbox and the audit log. */
export default function Settings() {
  const { t } = useTranslation();
  const [pct, setPct] = useState("");
  const [sms, setSms] = useState([]);
  const [audit, setAudit] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("sms");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/bills/service-charge"), api("/sms-outbox"), api("/audit-logs")])
      .then(([sc, s, a]) => {
        if (!cancelled) {
          setPct(String(sc.pct));
          setSms(s);
          setAudit(a);
        }
      })
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    setBusy(true);
    try {
      await api("/bills/service-charge", { method: "PUT", body: { pct: Number(pct) } });
      setMsg(t("settings.saved"));
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader title={t("settings.serviceCharge")} subtitle={t("settings.serviceHint")} icon={Percent} />
          {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
          {error && <Alert onClose={() => setError("")}>{error}</Alert>}
          <form onSubmit={save} className="flex items-end gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                aria-label={t("settings.serviceCharge")}
                className={`${inputCls} pr-9 text-lg font-semibold`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
            </div>
            <Button type="submit" loading={busy}>
              {t("settings.save")}
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="px-5 pt-5">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "sms", label: t("settings.sms"), icon: MessageSquare },
                { id: "audit", label: t("settings.audit"), icon: ShieldCheck },
              ]}
            />
          </div>

          {tab === "sms" &&
            (sms.length === 0 ? (
              <EmptyState icon={MessageSquare} title={t("settings.noSms")} />
            ) : (
              <ul className="max-h-[560px] divide-y divide-line overflow-auto border-t border-line">
                {sms.map((m) => (
                  <li key={m.id} className="flex gap-3 px-5 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                      <Smartphone className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="tabular font-semibold">{m.to_phone}</span>
                        <span className="text-xs text-muted">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 rounded-lg rounded-tl-none bg-slate-50 px-3 py-2 text-sm text-slate-700">{m.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "audit" && (
            <div className="max-h-[560px] overflow-auto border-t border-line">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>{t("settings.when")}</th>
                    <th>{t("settings.who")}</th>
                    <th>{t("settings.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-muted">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="font-medium">{a.username || "—"}</td>
                      <td>
                        <Badge tone={actionTone(a.action)}>{a.action}</Badge>
                        {a.entity && (
                          <span className="ml-2 text-xs text-muted">
                            {a.entity}
                            {a.entity_id ? ` #${a.entity_id}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
