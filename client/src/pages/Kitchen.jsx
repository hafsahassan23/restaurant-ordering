import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChefHat, Flame, CheckCircle2, ClipboardList, RefreshCw, StickyNote, Play, Wifi, WifiOff, Timer } from "lucide-react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { Button, Card, EmptyState, PageHeader, StatCard, Spinner } from "../components/ui.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { pick, minutesSince, mmss } from "../lib/format";
import { beep } from "../lib/beep";
import { useNow } from "../lib/useNow";

const NEXT = { ordered: "cooking", cooking: "ready" };
const VISIBLE = ["ordered", "cooking", "ready"];

/** Ticket colour by age: green under 10 minutes, orange 10–20, red over 20 (with a text label too). */
const ageStyle = (minutes) => {
  if (minutes < 10) return { bar: "bg-free", text: "text-green-700", chip: "bg-green-50 text-green-700 ring-green-200", labelKey: "kitchen.fresh" };
  if (minutes <= 20) return { bar: "bg-waiting", text: "text-amber-700", chip: "bg-amber-50 text-amber-800 ring-amber-200", labelKey: "kitchen.attention" };
  return { bar: "bg-paying", text: "text-red-700", chip: "bg-red-50 text-red-700 ring-red-200", labelKey: "kitchen.delayed" };
};

/** Kitchen display: confirmed orders oldest first, timers, one tap per step, sound on new orders. */
export default function Kitchen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [orders, setOrders] = useState([]);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState([]);
  const now = useNow();

  const load = useCallback(() => {
    api("/kitchen/orders")
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    socket.on("connect", () => {
      setOnline(true);
      load(); // reload everything after a (re)connect
    });
    socket.on("disconnect", () => setOnline(false));
    socket.on("order:confirmed", () => {
      beep();
      load();
    });
    socket.on("item:updated", load);
    // An order moved to another table: refresh so the card shows the new table number
    socket.on("order:moved", load);
    load();
    return () => socket.disconnect();
  }, [load]);

  const visibleOrders = useMemo(
    () =>
      [...orders]
        .map((order) => ({ ...order, items: (order.items || []).filter((item) => VISIBLE.includes(item.status)) }))
        .filter((order) => order.items.length > 0)
        .sort((a, b) => new Date(a.confirmed_at).getTime() - new Date(b.confirmed_at).getTime()),
    [orders],
  );

  const allItems = visibleOrders.flatMap((order) => order.items);
  const orderedCount = allItems.filter((item) => item.status === "ordered").length;
  const cookingCount = allItems.filter((item) => item.status === "cooking").length;
  const readyCount = allItems.filter((item) => item.status === "ready").length;

  async function advance(item) {
    if (!NEXT[item.status] || updating.includes(item.id)) return;
    setError(false);
    setUpdating((current) => [...current, item.id]);
    try {
      await api(`/items/${item.id}/status`, { method: "PATCH", body: { status: NEXT[item.status] } });
      load();
    } catch {
      setError(true);
    } finally {
      setUpdating((current) => current.filter((id) => id !== item.id));
    }
  }

  return (
    <Layout>
      <PageHeader eyebrow={t("kitchen.opsLabel")} title={t("kitchen.title")} subtitle={t("kitchen.oldestFirst")}>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
            online ? "bg-green-50 text-green-700 ring-green-200" : "bg-red-50 text-red-700 ring-red-200"
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? t("kitchen.online") : t("kitchen.reconnecting")}
        </span>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("kitchen.refresh")}
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label={t("kitchen.activeOrders")} value={visibleOrders.length} hint={t("kitchen.tablesWaiting")} icon={ClipboardList} tone="brand" />
        <StatCard label={t("itemStatus.ordered")} value={orderedCount} hint={t("kitchen.waitingStart")} icon={ChefHat} tone="blue" />
        <StatCard label={t("itemStatus.cooking")} value={cookingCount} hint={t("kitchen.inPrep")} icon={Flame} tone="amber" />
        <StatCard label={t("itemStatus.ready")} value={readyCount} hint={t("kitchen.waitingWaiter")} icon={CheckCircle2} tone="green" />
      </div>

      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">{t("common.error")}</span>
          <Button size="sm" variant="secondary" onClick={load}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {visibleOrders.length === 0 ? (
        <Card>
          <EmptyState icon={ChefHat} title={t("kitchen.empty")} text={t("kitchen.autoAppear")} className="py-20" />
        </Card>
      ) : (
        <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleOrders.map((order) => {
            const mins = minutesSince(order.confirmed_at, now);
            const age = ageStyle(mins);
            return (
              <article key={order.id} className="relative overflow-hidden rounded-xl border border-line bg-white shadow-card">
                <div className={`absolute inset-x-0 top-0 h-1.5 ${age.bar}`} aria-hidden="true" />
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 pb-3 pt-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 min-w-12 place-items-center rounded-lg bg-ink px-2 text-xl font-extrabold text-white">{order.table_number}</span>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("kitchen.table")}</p>
                      <p className="text-sm text-muted">
                        #{order.id} · {order.items.length} {t("kitchen.items")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`tabular inline-flex items-center gap-1 text-2xl font-bold ${age.text}`}>
                      <Timer className="h-5 w-5" aria-hidden="true" />
                      {mmss(order.confirmed_at, now)}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${age.chip}`}>{t(age.labelKey)}</span>
                  </div>
                </header>

                <ul className="divide-y divide-line">
                  {order.items.map((item) => {
                    const busy = updating.includes(item.id);
                    return (
                      <li key={item.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[17px] font-semibold leading-snug">
                            <span className="tabular mr-2 inline-grid h-7 min-w-7 place-items-center rounded-md bg-slate-100 px-1.5 text-sm font-bold">{item.quantity}</span>
                            {pick(item, "dish_name", lang)}
                          </p>
                          <StatusChip kind="item" status={item.status} />
                        </div>
                        {item.modifiers?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.modifiers.map((modifier, index) => (
                              <span key={`${item.id}-m-${index}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                {pick(modifier, "name", lang)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-900">
                            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-label={t("kitchen.notes")} />
                            {item.notes}
                          </p>
                        )}
                        <div className="mt-3">
                          {NEXT[item.status] ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => advance(item)}
                              className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-white shadow-sm transition active:translate-y-px disabled:opacity-60 ${
                                item.status === "ordered" ? "bg-ink hover:bg-slate-700" : "bg-free hover:bg-green-700"
                              }`}
                            >
                              {busy ? (
                                <Spinner className="h-4 w-4 text-white" />
                              ) : item.status === "ordered" ? (
                                <Play className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              )}
                              {item.status === "ordered" ? t("kitchen.start") : t("kitchen.ready")}
                            </button>
                          ) : (
                            <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-green-50 text-sm font-semibold text-green-700">
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              {t("kitchen.waitingWaiter")}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </section>
      )}
    </Layout>
  );
}
