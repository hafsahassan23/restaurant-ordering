import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { pick, minutesSince, mmss } from "../lib/format";
import { beep } from "../lib/beep";
import { useNow } from "../lib/useNow";

const NEXT = { ordered: "cooking", cooking: "ready" };
const VISIBLE = ["ordered", "cooking", "ready"];
// green under 10 min, orange 10-20, red over 20
const ageColor = (m) =>
  m < 10
    ? "bg-free text-white"
    : m <= 20
      ? "bg-waiting text-slate-900"
      : "bg-paying text-white";

export default function Kitchen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [orders, setOrders] = useState([]);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const now = useNow();

  const load = useCallback(() => {
    api("/kitchen/orders")
      .then(setOrders)
      .catch(() => setError(true));
  }, []);

 useEffect(() => {
   const socket = staffSocket(localStorage.getItem("token"));
   socket.on("connect", () => {
     setOnline(true);
     load();
   }); // reload everything after a reconnect
   socket.on("disconnect", () => setOnline(false));
   socket.on("order:confirmed", () => {
     beep();
     load();
   });
   socket.on("item:updated", load);
   return () => socket.disconnect();
 }, [load]);

  async function advance(item) {
    setError(false);
    try {
      await api(`/items/${item.id}/status`, {
        method: "PATCH",
        body: { status: NEXT[item.status] },
      });
    } catch {
      setError(true);
    }
  }

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("kitchen.title")}</h1>
        <span
          className={`font-semibold ${online ? "text-free" : "text-paying"}`}
        >
          {online
            ? `● ${t("kitchen.online")}`
            : `○ ${t("kitchen.reconnecting")}`}
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-3 text-red-800"
        >
          {t("common.error")}
        </div>
      )}
      {orders.length === 0 && (
        <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-lg text-slate-600">
          {t("kitchen.empty")}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => {
          const mins = minutesSince(o.confirmed_at, now);
          return (
            <article
              key={o.id}
              className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
            >
              <header
                className={`flex items-center justify-between px-4 py-3 ${ageColor(mins)}`}
              >
                <span className="text-2xl font-bold">
                  {t("kitchen.table")} {o.table_number}
                </span>
                <span className="text-right font-semibold">
                  <span className="block text-xl">
                    {mmss(o.confirmed_at, now)}
                  </span>
                  <span className="text-sm">
                    {mins} {t("kitchen.min")}
                  </span>
                </span>
              </header>
              <ul className="divide-y divide-line">
                {o.items
                  .filter((i) => VISIBLE.includes(i.status))
                  .map((i) => (
                    <li key={i.id} className="p-4">
                      <div className="text-lg font-semibold">
                        {i.quantity} × {pick(i, "dish_name", lang)}
                      </div>
                      {i.modifiers.length > 0 && (
                        <div className="text-slate-700">
                          {i.modifiers
                            .map((m) => pick(m, "name", lang))
                            .join(", ")}
                        </div>
                      )}
                      {i.notes && (
                        <div className="mt-1 rounded bg-yellow-100 px-2 py-1 font-medium">
                          {i.notes}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusChip kind="item" status={i.status} />
                        {NEXT[i.status] ? (
                          <button
                            type="button"
                            onClick={() => advance(i)}
                            className="h-12 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
                          >
                            {i.status === "ordered"
                              ? t("kitchen.start")
                              : t("kitchen.ready")}
                          </button>
                        ) : (
                          <span className="text-sm text-slate-600">
                            {t("kitchen.waitingWaiter")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </article>
          );
        })}
      </div>
    </Layout>
  );
}
