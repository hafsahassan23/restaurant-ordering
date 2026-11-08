import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import Receipt from "../components/Receipt.jsx";
import { RouteTabs, Tabs } from "../components/Tabs.jsx";
import { Alert, Badge, Button, Card } from "../components/ui.jsx";
import { api } from "../lib/api";
import { money } from "../lib/format";

/** Cashier: recent bills; open any bill to see (and print) its receipt again. */
export default function BillHistory() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("paid");
  const [bills, setBills] = useState([]);
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
      .catch(() => {
        if (!cancelled) setError(true);
      });
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

  return (
    <Layout>
      <RouteTabs
        items={[
          { to: "/cashier", label: t("cashier.tabBills"), end: true },
          { to: "/cashier/bills", label: t("cashier.tabHistory") },
        ]}
      />
      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
      <h1 className="mb-3 text-2xl font-bold">{t("cashier.historyTitle")}</h1>
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "paid", label: t("cashier.statusPaid") },
          { id: "open", label: t("cashier.statusOpen") },
          { id: "", label: t("cashier.statusAll") },
        ]}
      />
      {error && <Alert>{t("common.error")}</Alert>}
      {bills.length === 0 && !error && (
        <p className="text-slate-600">{t("cashier.noBills")}</p>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-130 text-left">
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">
                  {t("cashier.billNo")} #{b.id}
                </td>
                <td className="px-4 py-3">
                  {t("waiter.table")} {b.table_number}
                </td>
                <td className="px-4 py-3">
                  {new Date(b.updated_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-bold">{money(b.total)}</td>
                <td className="px-4 py-3">
                  <Badge tone={b.status === "paid" ? "green" : "amber"}>
                    {b.status === "paid"
                      ? t("cashier.statusPaid")
                      : t("cashier.statusOpen")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button variant="secondary" onClick={() => show(b.id)}>
                    {t("cashier.viewReceipt")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Layout>
  );
}
