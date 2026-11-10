import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Hourglass, BellRing, Users, Lock, Check, X, StickyNote, UtensilsCrossed, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import TableModal from "../components/TableModal.jsx";
import { Tabs } from "../components/Tabs.jsx";
import { Alert, Button, Card, EmptyState, PageHeader, StatCard } from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";
import { beep } from "../lib/beep";

// Status colour on the tile's top edge (the chip below always carries the text)
const EDGE = {
  free: "before:bg-free",
  ordering: "before:bg-ordering",
  waiting_food: "before:bg-waiting",
  eating: "before:bg-eating",
  paying: "before:bg-paying",
};
const STATUSES = ["free", "ordering", "waiting_food", "eating", "paying"];

/** Waiter: floor map by status, confirm customer orders, serve ready items, open a table. */
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
  const [online, setOnline] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  // Load floor tables, pending orders and kitchen-ready items.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/tables"), api("/orders/pending"), api("/kitchen/orders")])
      .then(([tb, pd, kitchen]) => {
        if (cancelled) return;
        setTables(tb);
        setPending(pd);
        setReady(
          kitchen.flatMap((o) =>
            o.items
              .filter((i) => i.status === "ready")
              .map((i) => ({ ...i, table_id: o.table_id, table_number: o.table_number })),
          ),
        );
      })
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  // Real-time staff notifications.
  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    const bump = () => setVersion((v) => v + 1);
    socket.on("connect", () => {
      setOnline(true);
      bump();
    });
    socket.on("disconnect", () => setOnline(false));
    ["order:confirmed", "order:rejected", "order:moved", "item:updated", "table:updated"].forEach((event) => socket.on(event, bump));
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

  // A waiter edits only the tables assigned to them; the manager edits all.
  const isMine = (tableId) => {
    const table = tables.find((x) => x.id === tableId);
    return Boolean(table) && (user?.role === "manager" || table.assigned_waiter_id === user?.id);
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

  const confirm = (order) => act(() => api(`/orders/${order.id}/confirm`, { method: "POST" }));
  const reject = (order) => act(() => api(`/orders/${order.id}/reject`, { method: "POST", body: {} }));
  const serve = (item) => act(() => api(`/items/${item.id}/status`, { method: "PATCH", body: { status: "served" } }));

  // Group tables by restaurant area.
  const areas = useMemo(() => {
    const map = new Map();
    tables
      .filter((table) => !mineOnly || user?.role === "manager" || table.assigned_waiter_id === user?.id)
      .forEach((table) => {
        const area = table.area || "—";
        if (!map.has(area)) map.set(area, []);
        map.get(area).push(table);
      });
    return [...map.entries()];
  }, [tables, mineOnly, user]);

  const selected = tables.find((x) => x.id === selectedId) || null;
  const myTables = tables.filter((table) => isMine(table.id));
  const myPending = pending.filter((order) => isMine(order.table_id));
  const myReady = ready.filter((item) => isMine(item.table_id));
  const occupiedTables = myTables.filter((table) => table.status !== "free").length;

  return (
    <Layout>
      <PageHeader eyebrow={t("waiter.dashboardLabel")} title={t("waiter.dashboardTitle")} subtitle={t("waiter.dashboardDescription")}>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
            online ? "bg-green-50 text-green-700 ring-green-200" : "bg-red-50 text-red-700 ring-red-200"
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? t("kitchen.online") : t("kitchen.reconnecting")}
        </span>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label={t("waiter.myTables")} value={myTables.length} hint={t("waiter.assignedToYou")} icon={LayoutGrid} tone="brand" />
        <StatCard label={t("waiter.occupied")} value={occupiedTables} hint={t("waiter.activeTables")} icon={Users} tone="violet" />
        <StatCard label={t("waiter.pendingOrders")} value={myPending.length} hint={t("waiter.awaitingConfirmation")} icon={Hourglass} tone={myPending.length ? "amber" : "blue"} />
        <StatCard label={t("waiter.readyToServe")} value={myReady.length} hint={t("waiter.waitingInKitchen")} icon={BellRing} tone={myReady.length ? "green" : "blue"} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "tables", label: t("waiter.tabTables"), icon: LayoutGrid },
          { id: "pending", label: t("waiter.tabPending"), count: myPending.length, icon: Hourglass },
          { id: "ready", label: t("waiter.tabReady"), count: myReady.length, icon: BellRing },
        ]}
      />

      {error && <Alert onClose={() => setError("")}>{error}</Alert>}

      {/* FLOOR MAP */}
      {tab === "tables" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {STATUSES.map((s) => (
                <StatusChip key={s} kind="table" status={s} />
              ))}
            </div>
            {user?.role !== "manager" && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 accent-brand" />
                {t("waiter.mineOnly")}
              </label>
            )}
          </div>

          {areas.length === 0 && (
            <Card>
              <EmptyState icon={LayoutGrid} title={t("waiter.noTables")} text={t("waiter.tablesAppear")} />
            </Card>
          )}

          {areas.map(([area, list]) => (
            <section key={area}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold">{area}</h2>
                <span className="text-sm text-muted">· {list.length} {t("waiter.tablesCount")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {list.map((table) => {
                  const mine = isMine(table.id);
                  const waiting = pending.some((o) => o.table_id === table.id);
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedId(table.id)}
                      className={`relative overflow-hidden rounded-xl border border-line bg-white p-4 pt-5 text-left shadow-card transition before:absolute before:inset-x-0 before:top-0 before:h-1 hover:-translate-y-0.5 hover:shadow-md ${
                        EDGE[table.status] || "before:bg-slate-300"
                      } ${mine ? "" : "bg-slate-50/80"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("waiter.tableLabel")}</p>
                          <p className="text-3xl font-bold leading-tight">{table.number}</p>
                        </div>
                        {waiting ? (
                          <span className="relative mt-1 flex h-3 w-3" title={t("waiter.awaitingConfirmation")}>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-waiting opacity-60" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-waiting" />
                          </span>
                        ) : !mine ? (
                          <Lock className="h-4 w-4 text-slate-400" aria-label={t("waiter.otherWaiter")} />
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {table.seats} {t("waiter.seats")}
                      </div>
                      <div className="mt-3">
                        <StatusChip kind="table" status={table.status} />
                      </div>
                      {!mine && table.waiter_name && <p className="mt-2 truncate text-xs text-muted">{table.waiter_name}</p>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* PENDING ORDERS */}
      {tab === "pending" &&
        (myPending.length === 0 ? (
          <Card>
            <EmptyState icon={Check} title={t("waiter.noPending")} text={t("waiter.reviewOrders")} />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {myPending.map((order) => {
              const mine = isMine(order.table_id);
              return (
                <Card key={order.id} className="flex flex-col p-0">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 min-w-11 place-items-center rounded-lg bg-ink px-2 text-lg font-bold text-white">{order.table_number}</span>
                      <div>
                        <p className="font-semibold">{t("waiter.table")} {order.table_number}</p>
                        <p className="text-xs text-muted">{t("waiter.newCustomerOrder")} · #{order.id}</p>
                      </div>
                    </div>
                    <StatusChip kind="item" status="pending" />
                  </div>
                  <ul className="flex-1 divide-y divide-line px-5">
                    {(order.items || []).map((item) => (
                      <li key={item.id} className="py-3">
                        <p className="font-medium">
                          <span className="tabular mr-1 text-muted">{item.quantity}×</span>
                          {pick(item, "dish_name", lang)}
                        </p>
                        {item.modifiers?.length > 0 && (
                          <p className="mt-0.5 text-sm text-muted">{item.modifiers.map((m) => pick(m, "name", lang)).join(", ")}</p>
                        )}
                        {item.notes && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">
                            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {item.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 border-t border-line bg-slate-50/70 p-4">
                    <Button disabled={!mine} onClick={() => confirm(order)} className="flex-1">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {t("waiter.confirm")}
                    </Button>
                    <Button variant="secondary" disabled={!mine} onClick={() => reject(order)}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      {t("waiter.reject")}
                    </Button>
                  </div>
                  {!mine && (
                    <p className="flex items-center justify-center gap-1.5 px-4 pb-3 text-xs text-muted">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      {t("waiter.otherWaiter")}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        ))}

      {/* READY ITEMS */}
      {tab === "ready" &&
        (myReady.length === 0 ? (
          <Card>
            <EmptyState icon={UtensilsCrossed} title={t("waiter.noReady")} text={t("waiter.readyItemsAppear")} />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {myReady.map((item) => {
              const mine = isMine(item.table_id);
              return (
                <Card key={item.id} className="flex items-center gap-4 border-green-200 p-4">
                  <span className="grid h-12 min-w-12 place-items-center rounded-lg bg-green-50 text-lg font-bold text-green-700">{item.table_number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      <span className="tabular mr-1 text-muted">{item.quantity}×</span>
                      {pick(item, "dish_name", lang)}
                    </p>
                    <p className="text-xs text-muted">
                      {t("waiter.table")} {item.table_number}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                  <Button size="sm" disabled={!mine} onClick={() => serve(item)}>
                    {t("waiter.serve")}
                  </Button>
                </Card>
              );
            })}
          </div>
        ))}

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
