import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import TableModal from "../components/TableModal.jsx";
import { Tabs } from "../components/Tabs.jsx";
import { Alert, Button, Card } from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";
import { beep } from "../lib/beep";

const BORDER = {
  free: "border-free",
  ordering: "border-ordering",
  waiting_food: "border-waiting",
  eating: "border-eating",
  paying: "border-paying",
};

/** Waiter: floor map by area, orders waiting for confirmation, and "Ready" alerts from the kitchen. */
export default function Waiter() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [pending, setPending] = useState([]);
  const [ready, setReady] = useState([]);
  const [tab, setTab] = useState("tables");
  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api("/tables"),
      api("/orders/pending"),
      api("/kitchen/orders"),
    ])
      .then(([tb, pd, kitchen]) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        if (!cancelled) setError(t("common.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    const bump = () => setVersion((v) => v + 1);
    [
      "connect",
      "order:confirmed",
      "order:rejected",
      "order:moved",
      "item:updated",
      "table:updated",
    ].forEach((e) => socket.on(e, bump));
    socket.on("order:pending", () => {
      beep();
      bump();
    });
    socket.on("item:ready", () => {
      beep();
      bump();
    });
    return () => socket.disconnect();
  }, []);

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
      setError(errorText(t, "waiter", e));
    }
    setVersion((v) => v + 1);
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

  const areas = useMemo(() => {
    const map = new Map();
    tables.forEach((tb) => {
      if (!map.has(tb.area)) map.set(tb.area, []);
      map.get(tb.area).push(tb);
    });
    return [...map.entries()];
  }, [tables]);

  const selected = tables.find((x) => x.id === selectedId) || null;

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "tables", label: t("waiter.tabTables") },
          {
            id: "pending",
            label: t("waiter.tabPending"),
            count: pending.filter((o) => isMine(o.table_id)).length,
          },
          {
            id: "ready",
            label: t("waiter.tabReady"),
            count: ready.filter((i) => isMine(i.table_id)).length,
          },
        ]}
      />
      {error && <Alert>{error}</Alert>}

      {tab === "tables" &&
        areas.map(([area, list]) => (
          <section key={area} className="mb-6">
            <h2 className="mb-2 text-lg font-bold text-slate-700">{area}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((tb) => {
                const mine = isMine(tb.id);
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setSelectedId(tb.id)}
                    className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:shadow ${BORDER[tb.status]} ${mine ? "" : "opacity-75"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{tb.number}</span>
                      <span aria-hidden="true">{mine ? "" : "🔒"}</span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {tb.seats} {t("waiter.seats")}
                    </div>
                    <div className="mt-2">
                      <StatusChip kind="table" status={tb.status} />
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-600">
                      {mine
                        ? t("waiter.mine")
                        : tb.waiter_name || t("waiter.others")}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

      {tab === "pending" && (
        <>
          {pending.length === 0 && (
            <p className="text-slate-600">{t("waiter.noPending")}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((o) => (
              <Card key={o.id}>
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
                          {i.modifiers
                            .map((m) => pick(m, "name", lang))
                            .join(", ")}
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
                  <Button
                    disabled={!isMine(o.table_id)}
                    onClick={() => confirm(o)}
                    className="flex-1"
                  >
                    {t("waiter.confirm")}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isMine(o.table_id)}
                    onClick={() => reject(o)}
                  >
                    {t("waiter.reject")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "ready" && (
        <>
          {ready.length === 0 && (
            <p className="text-slate-600">{t("waiter.noReady")}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {ready.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-free bg-green-50 p-4"
              >
                <div>
                  <div className="font-bold">
                    {t("waiter.table")} {i.table_number}
                  </div>
                  <div>
                    {i.quantity} × {pick(i, "dish_name", lang)}
                  </div>
                </div>
                <Button disabled={!isMine(i.table_id)} onClick={() => serve(i)}>
                  {t("waiter.serve")}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && (
        <TableModal
          table={selected}
          tables={tables}
          user={user}
          version={version}
          onClose={() => setSelectedId(null)}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </Layout>
  );
}
