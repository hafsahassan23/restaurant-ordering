import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ArrowRightLeft, Lock, ClipboardList, Users } from "lucide-react";
import { Alert, Button, EmptyState, Modal, selectCls } from "./ui.jsx";
import StatusChip from "./StatusChip.jsx";
import OrderBuilder from "./OrderBuilder.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { pick } from "../lib/format";

/** One table: its open orders, enter a new order directly, and move an order to another table. */
export default function TableModal({ table, tables, user, version, onClose, onChanged }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [orders, setOrders] = useState([]);
  const [targets, setTargets] = useState({}); // orderId -> destination table id
  const [builder, setBuilder] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const mine = user.role === "manager" || table.assigned_waiter_id === user.id;
  const usable = !table.is_closed && table.status !== "paying";
  const destinations = tables.filter(
    (x) => x.id !== table.id && !x.is_closed && x.status !== "paying" && (user.role === "manager" || x.assigned_waiter_id === user.id),
  );

  useEffect(() => {
    let cancelled = false;
    api(`/public/table/${table.token}/orders`)
      .then((o) => !cancelled && setOrders(o))
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [table.token, version, t]);

  async function move(order) {
    setError("");
    setMsg("");
    try {
      await api(`/orders/${order.id}/move`, { method: "POST", body: { toTableId: Number(targets[order.id]) } });
      setMsg(t("waiter.moved"));
      onChanged();
    } catch (e) {
      setError(errorText(t, "waiter", e));
    }
  }

  return (
    <>
      <Modal
        title={`${t("waiter.table")} ${table.number}`}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            {table.area} · <Users className="h-3.5 w-3.5" aria-hidden="true" /> {table.seats}
          </span>
        }
        onClose={onClose}
        wide
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <StatusChip kind="table" status={table.status} />
          <Button disabled={!mine || !usable} onClick={() => setBuilder(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("waiter.newOrder")}
          </Button>
        </div>
        {!mine && (
          <Alert tone="info">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {t("waiter.lockedHint")}
            </span>
          </Alert>
        )}
        {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
        {error && <Alert onClose={() => setError("")}>{error}</Alert>}

        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{t("waiter.openOrders")}</h3>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line">
            <EmptyState icon={ClipboardList} title={t("waiter.noOrders")} className="py-8" />
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="font-semibold">#{o.id}</span>
                  {o.status === "pending_confirmation" && <StatusChip kind="item" status="pending" />}
                </div>
                <ul className="divide-y divide-line px-4">
                  {o.items
                    .filter((i) => i.status !== "cancelled")
                    .map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 py-2.5">
                        <span className="text-sm">
                          <span className="tabular mr-1 text-muted">{i.quantity}×</span>
                          <span className="font-medium">{pick(i, "dish_name", lang)}</span>
                        </span>
                        <StatusChip kind="item" status={i.status} />
                      </li>
                    ))}
                </ul>
                {mine && !o.bill_id && destinations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line bg-slate-50/60 px-4 py-3">
                    <ArrowRightLeft className="h-4 w-4 text-muted" aria-hidden="true" />
                    <select
                      value={targets[o.id] || ""}
                      onChange={(e) => setTargets({ ...targets, [o.id]: e.target.value })}
                      aria-label={t("waiter.moveTo")}
                      className={`${selectCls} h-9 w-52 text-sm`}
                    >
                      <option value="">{t("waiter.moveTo")}</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {t("waiter.table")} {d.number} · {d.area}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" disabled={!targets[o.id]} onClick={() => move(o)}>
                      {t("waiter.move")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {builder && (
        <OrderBuilder
          table={table}
          onClose={() => setBuilder(false)}
          onDone={() => {
            setBuilder(false);
            setMsg(t("waiter.orderSent"));
            onChanged();
          }}
        />
      )}
    </>
  );
}
