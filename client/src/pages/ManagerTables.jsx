import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import ManagerNav from "../components/ManagerNav.jsx";
import { api } from "../lib/api";

export default function ManagerTables() {
  const { t } = useTranslation();
  const [tables, setTables] = useState([]);
  const [base, setBase] = useState(window.location.origin);

  useEffect(() => {
    api("/tables").then(setTables);
  }, []);

  return (
    <Layout>
      <ManagerNav />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t("manager.tables")}</h1>
        <label className="text-sm font-medium print:hidden">
          {t("manager.baseUrl")}
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="ml-2 h-11 w-64 rounded-xl border border-line px-3"
          />
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 rounded-xl bg-brand px-5 font-semibold text-white print:hidden"
        >
          {t("manager.print")}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((tb) => {
          const url = `${base}/t/${tb.token}`;
          return (
            <div
              key={tb.id}
              className="break-inside-avoid rounded-2xl border border-line bg-white p-4 text-center"
            >
              <div className="text-2xl font-bold">
                {t("waiter.table")} {tb.number}
              </div>
              <div className="mb-2 text-sm text-slate-600">
                {tb.area} · {tb.seats} {t("waiter.seats")}
              </div>
              <QRCodeSVG value={url} size={150} className="mx-auto" />
              <p className="mt-2 text-sm">{t("manager.scan")}</p>
              <div className="mt-2 print:hidden">
                <StatusChip kind="table" status={tb.status} />
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm text-brand underline print:hidden"
              >
                {t("customer.table")} {tb.number} →
              </a>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
