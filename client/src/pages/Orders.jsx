import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import {
  Alert,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  inputCls,
} from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";

const CANCELLABLE = ["pending", "ordered", "cooking", "ready"];

/** Manager: open orders, with the option to cancel an item (a reason is required). */
export default function Orders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [pending, setPending] = useState([]);
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    const bump = () => setVersion((v) => v + 1);
    [
      "connect",
      "order:pending",
      "order:confirmed",
      "order:rejected",
      "order:moved",
      "item:updated",
    ].forEach((e) => socket.on(e, bump));
    return () => socket.disconnect();
  }, []);

  async function cancel(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/items/${target.item.id}/cancel`, {
        method: "POST",
        body: { reason },
      });
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

  const section = (title, list) => (
    <section className="mb-6">
      <h2 className="mb-2 text-xl font-bold">{title}</h2>
      {list.length === 0 && (
        <p className="text-slate-600">{t("orders.empty")}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((o) => (
          <Card key={o.id}>
            <div className="mb-2 text-lg font-bold">
              {t("orders.table")} {o.table_number} · #{o.id}
            </div>
            <ul className="divide-y divide-line">
              {o.items
                .filter((i) => i.status !== "cancelled")
                .map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <div className="font-semibold">
                        {i.quantity} × {pick(i, "dish_name", lang)}
                      </div>
                      {i.modifiers.length > 0 && (
                        <div className="text-sm text-slate-600">
                          {i.modifiers
                            .map((m) => pick(m, "name", lang))
                            .join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip kind="item" status={i.status} />
                      {CANCELLABLE.includes(i.status) && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setTarget({ item: i, tableNumber: o.table_number });
                            setReason("");
                            setError("");
                            setMsg("");
                          }}
                        >
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
    </section>
  );

  return (
    <Layout>
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && !target && <Alert>{error}</Alert>}
      {section(t("orders.pending"), pending)}
      {section(t("orders.inKitchen"), open)}

      {target && (
        <Modal
          title={`${t("orders.cancel")}: ${pick(target.item, "dish_name", lang)}`}
          onClose={() => setTarget(null)}
        >
          <form onSubmit={cancel} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Alert tone="info">
              {["cooking", "ready"].includes(target.item.status)
                ? t("orders.wasteNote")
                : target.item.status === "ordered"
                  ? t("orders.restoreNote")
                  : ""}
            </Alert>
            <Field label={t("orders.reason")}>
              <input
                required
                minLength={3}
                maxLength={255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("orders.reasonHint")}
                className={inputCls}
              />
            </Field>
            <Button
              type="submit"
              variant="danger"
              disabled={busy}
              className="w-full"
            >
              {t("orders.confirmCancel")}
            </Button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
