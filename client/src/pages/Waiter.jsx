import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";
import { beep } from "../lib/beep";

export default function Waiter() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [pending, setPending] = useState([]);
  const [ready, setReady] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [tb, pd, kitchen] = await Promise.all([
        api("/tables"),
        api("/orders/pending"),
        api("/kitchen/orders"),
      ]);
      setTables(tb);
      setPending(pd);
      setReady(
        kitchen.flatMap((o) =>
          o.items
            .filter((i) => i.status === "ready")
            .map((i) => ({
              ...i,
              table_id: o.table_id,
              table_number: o.table_number,
            })),
        ),
      );
    } catch {
      setError(t("common.error"));
    }
  }, [t]);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    socket.on("connect", load); // first load happens on connect, and again after every reconnect
    [
      "order:confirmed",
      "order:rejected",
      "item:updated",
      "table:updated",
    ].forEach((e) => socket.on(e, load));
    socket.on("order:pending", () => {
      beep();
      load();
    });
    socket.on("item:ready", () => {
      beep();
      load();
    });
    return () => socket.disconnect();
  }, [load]);

  const isMine = (tableId) => {
    const tb = tables.find((x) => x.id === tableId);
    return (
      Boolean(tb) &&
      (user.role === "manager" || tb.assigned_waiter_id === user.id)
    );
  };

  async function act(fn) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e.code === "INSUFFICIENT_STOCK" ? t("waiter.noStock") : e.message,
      );
    }
    load();
  }

  const confirm = (o) =>
    act(() => api(`/orders/${o.id}/confirm`, { method: "POST" }));
  const reject = (o) =>
    act(() => api(`/orders/${o.id}/reject`, { method: "POST", body: {} }));
  const serve = (i) =>
    act(() =>
      api(`/items/${i.id}/status`, {
        method: "PATCH",
        body: { status: "served" },
      }),
    );

  const btn = "h-12 rounded-xl px-5 font-semibold disabled:opacity-40";

  return (
    <Layout>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      <h2 className="mb-2 text-xl font-bold">{t("waiter.ready")}</h2>
      {ready.length === 0 && (
        <p className="mb-6 text-slate-600">{t("waiter.noReady")}</p>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {ready.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-3 rounded-xl border-2 border-free bg-green-50 p-4"
          >
            <div>
              <div className="font-bold">
                {t("waiter.table")} {i.table_number}
              </div>
              <div>
                {i.quantity} × {pick(i, "dish_name", lang)}
              </div>
            </div>
            <button
              type="button"
              disabled={!isMine(i.table_id)}
              onClick={() => serve(i)}
              className={`${btn} bg-free text-white`}
            >
              {t("waiter.serve")}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-xl font-bold">{t("waiter.pending")}</h2>
      {pending.length === 0 && (
        <p className="mb-6 text-slate-600">{t("waiter.noPending")}</p>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {pending.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border border-line bg-white p-4"
          >
            <div className="text-lg font-bold">
              {t("waiter.table")} {o.table_number}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span className="font-semibold">
                    {i.quantity} × {pick(i, "dish_name", lang)}
                  </span>
                  {i.modifiers.length > 0 && (
                    <span>
                      {" "}
                      (
                      {i.modifiers.map((m) => pick(m, "name", lang)).join(", ")}
                      )
                    </span>
                  )}
                  {i.notes && (
                    <div className="rounded bg-yellow-100 px-2 py-1">
                      {i.notes}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!isMine(o.table_id)}
                onClick={() => confirm(o)}
                className={`${btn} flex-1 bg-brand text-white`}
              >
                {t("waiter.confirm")}
              </button>
              <button
                type="button"
                disabled={!isMine(o.table_id)}
                onClick={() => reject(o)}
                className={`${btn} border border-line bg-white`}
              >
                {t("waiter.reject")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-xl font-bold">{t("waiter.tables")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((tb) => {
          const mine = isMine(tb.id);
          return (
            <div
              key={tb.id}
              className={`rounded-xl border-2 bg-white p-4 ${mine ? "border-brand" : "border-line opacity-80"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{tb.number}</span>
                <span aria-hidden="true">{mine ? "" : "🔒"}</span>
              </div>
              <div className="text-sm text-slate-600">
                {tb.area} · {tb.seats} {t("waiter.seats")}
              </div>
              <div className="mt-2">
                <StatusChip kind="table" status={tb.status} />
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {mine ? t("waiter.mine") : t("waiter.others")}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
