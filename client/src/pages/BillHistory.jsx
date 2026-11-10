import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReceiptText, History } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Receipt from "../components/Receipt.jsx";
import { Tabs } from "../components/Tabs.jsx";
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader } from "../components/ui.jsx";
import { api } from "../lib/api";
import { money } from "../lib/format";

/** Cashier: recent bills; open any bill to see (and print) its receipt again. */
export default function BillHistory() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("paid");
  const [bills, setBills] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const status = filter ? `status=${filter}&` : "";
    api(`/bills?${status}limit=100`)
      .then((d) => {
        if (!cancelled) {
          setBills(d);
          setError(false);
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  async function show(id) {
    try {
      setReceipt(await api(`/bills/${id}`));
    } catch {
      setError(true);
    }
  }

  const total = (bills || []).filter((b) => b.status === "paid").reduce((s, b) => s + b.total, 0);

  return (
    <Layout>
      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
      <PageHeader title={t("cashier.historyTitle")} subtitle={t("cashier.historySubtitle")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "paid", label: t("cashier.statusPaid") },
            { id: "open", label: t("cashier.statusOpen") },
            { id: "", label: t("cashier.statusAll") },
          ]}
        />
        {bills && bills.length > 0 && filter !== "open" && (
          <p className="mb-5 text-sm text-muted">
            {t("cashier.paidTotal")}: <span className="tabular font-bold text-ink">{money(total)}</span>
          </p>
        )}
      </div>
      {error && <Alert>{t("common.error")}</Alert>}

      <Card className="overflow-hidden p-0">
        {!bills ? (
          <LoadingState />
        ) : bills.length === 0 ? (
          <EmptyState icon={History} title={t("cashier.noBills")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[620px]">
              <thead>
                <tr>
                  <th>{t("cashier.billNo")}</th>
                  <th>{t("waiter.table")}</th>
                  <th>{t("stock.when")}</th>
                  <th>{t("staff.status")}</th>
                  <th className="text-right">{t("cashier.total")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">#{b.id}</td>
                    <td>
                      <span className="inline-grid h-7 min-w-7 place-items-center rounded-md bg-slate-100 px-1.5 text-xs font-bold">{b.table_number}</span>
                    </td>
                    <td className="whitespace-nowrap text-muted">{new Date(b.updated_at).toLocaleString()}</td>
                    <td>
                      <Badge tone={b.status === "paid" ? "green" : "amber"}>
                        {b.status === "paid" ? t("cashier.statusPaid") : t("cashier.statusOpen")}
                      </Badge>
                    </td>
                    <td className="text-right font-bold">{money(b.total)}</td>
                    <td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => show(b.id)}>
                        <ReceiptText className="h-4 w-4" aria-hidden="true" />
                        {t("cashier.viewReceipt")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
}
