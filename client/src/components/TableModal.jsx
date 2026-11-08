import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Modal, inputCls } from "./ui.jsx";
import StatusChip from "./StatusChip.jsx";
import OrderBuilder from "./OrderBuilder.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { pick } from "../lib/format";

/** One table: its open orders, enter a new order directly, and move an order to another table. */
export default function TableModal({
  table,
  tables,
  user,
  version,
  onClose,
  onChanged,
}) {
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
    (x) =>
      x.id !== table.id &&
      !x.is_closed &&
      x.status !== "paying" &&
      (user.role === "manager" || x.assigned_waiter_id === user.id),
  );

  useEffect(() => {
    let cancelled = false;
    api(`/public/table/${table.token}/orders`)
      .then((o) => {
        if (!cancelled) setOrders(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [table.token, version]);

  async function move(order) {
    setError("");
    setMsg("");
    try {
      await api(`/orders/${order.id}/move`, {
        method: "POST",
        body: { toTableId: Number(targets[order.id]) },
      });
      setMsg(t("waiter.moved"));
      onChanged();
    } catch (e) {
      setError(errorText(t, "waiter", e));
    }
  }

  return (
    <>
      <Modal
        title={`${t("waiter.table")} ${table.number} · ${table.area}`}
        onClose={onClose}
        wide
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <StatusChip kind="table" status={table.status} />
          <Button disabled={!mine || !usable} onClick={() => setBuilder(true)}>
            + {t("waiter.newOrder")}
          </Button>
        </div>
        {!mine && <Alert tone="info">{t("waiter.lockedHint")}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        {error && <Alert>{error}</Alert>}

        <h3 className="mb-2 font-bold">{t("waiter.openOrders")}</h3>
        {orders.length === 0 && (
          <p className="text-slate-600">{t("waiter.noOrders")}</p>
        )}
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="mb-2 flex items-center justify-between font-semibold">
                <span>#{o.id}</span>
                {o.status === "pending_confirmation" && (
                  <span className="text-sm text-ordering">
                    {t("itemStatus.pending")}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {o.items
                  .filter((i) => i.status !== "cancelled")
                  .map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {i.quantity} × {pick(i, "dish_name", lang)}
                      </span>
                      <StatusChip kind="item" status={i.status} />
                    </li>
                  ))}
              </ul>
              {mine && !o.bill_id && destinations.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <select
                    value={targets[o.id] || ""}
                    onChange={(e) =>
                      setTargets({ ...targets, [o.id]: e.target.value })
                    }
                    aria-label={t("waiter.moveTo")}
                    className={`${inputCls} w-48`}
                  >
                    <option value="">{t("waiter.moveTo")}</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {t("waiter.table")} {d.number} · {d.area}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    disabled={!targets[o.id]}
                    onClick={() => move(o)}
                  >
                    {t("waiter.move")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
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
