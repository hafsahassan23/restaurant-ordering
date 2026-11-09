import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Hourglass, Flame, ClipboardList } from "lucide-react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { Alert, Button, Card, EmptyState, Field, LoadingState, Modal, PageHeader, inputCls } from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";

const CANCELLABLE = ["pending", "ordered", "cooking", "ready"];

/** Manager: open orders, with the option to cancel an item (a reason is required). */
export default function Orders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [pending, setPending] = useState(null);
  const [open, setOpen] = useState([]);
  const [version, setVersion] = useState(0);
  const [target, setTarget] = useState(null); // { item, tableNumber }
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/orders/pending"), api("/kitchen/orders")])
      .then(([p, k]) => {
        if (!cancelled) {
          setPending(p);
          setOpen(k);
        }
      })
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    const bump = () => setVersion((v) => v + 1);
    ["connect", "order:pending", "order:confirmed", "order:rejected", "order:moved", "item:updated"].forEach((e) => socket.on(e, bump));
    return () => socket.disconnect();
  }, []);

  async function cancel(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/items/${target.item.id}/cancel`, { method: "POST", body: { reason } });
      setTarget(null);
      setReason("");
      setMsg(t("orders.cancelled"));
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorText(t, "orders", err));
    } finally {
      setBusy(false);
    }
  }

  const column = (title, Icon, tone, list) => (
    <section className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="font-semibold">{title}</h2>
        <span className="tabular rounded-full bg-slate-200/70 px-2 text-xs font-bold text-slate-700">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <EmptyState icon={ClipboardList} title={t("orders.empty")} className="py-8" />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <Card key={o.id} className="p-0">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-ink px-2 text-sm font-bold text-white">{o.table_number}</span>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">{t("orders.table")} {o.table_number}</div>
                    <div className="text-xs text-muted">#{o.id}</div>
                  </div>
                </div>
                {(o.confirmed_at || o.created_at) && (
                  <span className="text-xs text-muted">
                    {new Date(o.confirmed_at || o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-line">
                {o.items
                  .filter((i) => i.status !== "cancelled")
                  .map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          <span className="tabular text-muted">{i.quantity}×</span> {pick(i, "dish_name", lang)}
                        </div>
                        {i.modifiers.length > 0 && (
                          <div className="text-xs text-muted">{i.modifiers.map((m) => pick(m, "name", lang)).join(", ")}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip kind="item" status={i.status} />
                        {CANCELLABLE.includes(i.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setTarget({ item: i, tableNumber: o.table_number });
                              setReason("");
                              setError("");
                              setMsg("");
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("orders.cancel")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <Layout>
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
      {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {error && !target && <Alert onClose={() => setError("")}>{error}</Alert>}

      {!pending ? (
        <LoadingState />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {column(t("orders.pending"), Hourglass, "bg-blue-50 text-blue-600", pending)}
          {column(t("orders.inKitchen"), Flame, "bg-amber-50 text-amber-600", open)}
        </div>
      )}

      {target && (
        <Modal title={t("orders.cancel")} subtitle={`${pick(target.item, "dish_name", lang)} · ${t("orders.table")} ${target.tableNumber}`} onClose={() => setTarget(null)}>
          <form onSubmit={cancel} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            {["cooking", "ready", "ordered"].includes(target.item.status) && (
              <Alert tone={target.item.status === "ordered" ? "info" : "warning"}>
                {target.item.status === "ordered" ? t("orders.restoreNote") : t("orders.wasteNote")}
              </Alert>
            )}
            <Field label={t("orders.reason")}>
              <input
                required
                minLength={3}
                maxLength={255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("orders.reasonHint")}
                className={inputCls}
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setTarget(null)}>
                {t("common.back")}
              </Button>
              <Button type="submit" variant="danger" loading={busy}>
                {t("orders.confirmCancel")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
