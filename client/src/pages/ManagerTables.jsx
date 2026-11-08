import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  inputCls,
} from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";

const blank = { number: "", area: "", seats: 4, assignedWaiterId: "" };

/** Manager: tables, QR codes (print / regenerate), waiter assignment and the Closed flag. */
export default function ManagerTables() {
  const { t } = useTranslation();
  const [tables, setTables] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [base, setBase] = useState(() => window.location.origin);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { table? }
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/tables"), api("/users")])
      .then(([tb, us]) => {
        if (cancelled) return;
        setTables(tb);
        setWaiters(us.filter((u) => u.role === "waiter" && u.is_active));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function openForm(table) {
    setError("");
    setMsg("");
    setForm(
      table
        ? {
            number: table.number,
            area: table.area,
            seats: table.seats,
            assignedWaiterId: "",
          }
        : blank,
    );
    setModal({ table });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        number: Number(form.number),
        area: form.area,
        seats: Number(form.seats),
      };
      if (modal.table)
        await api(`/admin/tables/${modal.table.id}`, { method: "PATCH", body });
      else {
        if (form.assignedWaiterId)
          body.assignedWaiterId = Number(form.assignedWaiterId);
        await api("/admin/tables", { method: "POST", body });
      }
      setModal(null);
      setMsg(t("tableAdmin.saved"));
      reload();
    } catch (err) {
      setError(errorText(t, "tableAdmin", err));
    } finally {
      setBusy(false);
    }
  }

  async function act(fn, confirmKey) {
    if (confirmKey && !window.confirm(t(confirmKey))) return;
    setError("");
    setMsg("");
    try {
      await fn();
      reload();
    } catch (err) {
      setError(errorText(t, "tableAdmin", err));
    }
  }

  const patch = (tb, body) =>
    act(() => api(`/admin/tables/${tb.id}`, { method: "PATCH", body }));
  const regenerate = (tb) =>
    act(
      () => api(`/admin/tables/${tb.id}/regenerate-qr`, { method: "POST" }),
      "tableAdmin.regenerateWarn",
    );
  const remove = (tb) =>
    act(
      () => api(`/admin/tables/${tb.id}`, { method: "DELETE" }),
      "tableAdmin.deleteWarn",
    );

  return (
    <Layout>
      <PageHeader title={t("nav.tables")} subtitle={t("tableAdmin.subtitle")}>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            aria-label={t("manager.baseUrl")}
            className={`${inputCls} w-64`}
          />
          <Button variant="secondary" onClick={() => window.print()}>
            {t("manager.print")}
          </Button>
          <Button onClick={() => openForm(null)}>
            + {t("tableAdmin.add")}
          </Button>
        </div>
      </PageHeader>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && !modal && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((tb) => {
          const url = `${base}/t/${tb.token}`;
          return (
            <Card key={tb.id} className="break-inside-avoid text-center">
              <div className="flex items-start justify-between text-left">
                <div>
                  <div className="text-2xl font-bold">
                    {t("waiter.table")} {tb.number}
                  </div>
                  <div className="text-sm text-slate-600">
                    {tb.area} · {tb.seats} {t("waiter.seats")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 print:hidden">
                  <StatusChip kind="table" status={tb.status} />
                  {tb.is_closed ? (
                    <Badge tone="red">{t("tableAdmin.closed")}</Badge>
                  ) : null}
                </div>
              </div>
              <QRCodeSVG value={url} size={150} className="mx-auto my-3" />
              <p className="text-sm">{t("manager.scan")}</p>

              <div className="mt-3 space-y-2 text-left print:hidden">
                <div className="flex gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand font-semibold text-white hover:bg-brand-dark"
                  >
                    {t("tableAdmin.openCustomer")}
                  </a>
                  <Button
                    variant="secondary"
                    onClick={() => navigator.clipboard?.writeText(url)}
                  >
                    {t("tableAdmin.copyLink")}
                  </Button>
                </div>
                <Field label={t("tableAdmin.waiter")}>
                  <select
                    value={tb.assigned_waiter_id || ""}
                    onChange={(e) =>
                      patch(tb, {
                        assigned_waiter_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">{t("tableAdmin.noWaiter")}</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openForm(tb)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => patch(tb, { is_closed: !tb.is_closed })}
                  >
                    {tb.is_closed
                      ? t("tableAdmin.reopen")
                      : t("tableAdmin.close")}
                  </Button>
                  <Button variant="secondary" onClick={() => regenerate(tb)}>
                    {t("tableAdmin.regenerate")}
                  </Button>
                  <Button variant="ghost" onClick={() => remove(tb)}>
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal
          title={modal.table ? t("tableAdmin.edit") : t("tableAdmin.add")}
          onClose={() => setModal(null)}
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("tableAdmin.number")}>
                <input
                  required
                  type="number"
                  min="1"
                  max="999"
                  value={form.number}
                  onChange={set("number")}
                  className={inputCls}
                />
              </Field>
              <Field label={t("tableAdmin.seats")}>
                <input
                  required
                  type="number"
                  min="1"
                  max="50"
                  value={form.seats}
                  onChange={set("seats")}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label={t("tableAdmin.area")}>
              <input
                required
                minLength={2}
                value={form.area}
                onChange={set("area")}
                className={inputCls}
              />
            </Field>
            {!modal.table && (
              <Field label={t("tableAdmin.waiter")}>
                <select
                  value={form.assignedWaiterId}
                  onChange={set("assignedWaiterId")}
                  className={inputCls}
                >
                  <option value="">{t("tableAdmin.noWaiter")}</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {t("common.save")}
            </Button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
