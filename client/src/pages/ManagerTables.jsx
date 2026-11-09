import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Printer, ExternalLink, Copy, Pencil, Lock, Unlock, RefreshCw, Trash2, Users, Globe, QrCode } from "lucide-react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { Alert, Badge, Button, Card, EmptyState, Field, IconButton, LoadingState, Modal, PageHeader, inputCls, selectCls } from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";

const blank = { number: "", area: "", seats: 4, assignedWaiterId: "" };

/** Manager: tables, QR codes (print / regenerate), waiter assignment and the Closed flag. */
export default function ManagerTables() {
  const { t } = useTranslation();
  const [tables, setTables] = useState(null);
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
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  const reload = () => setVersion((v) => v + 1);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function openForm(table) {
    setError("");
    setMsg("");
    setForm(table ? { number: table.number, area: table.area, seats: table.seats, assignedWaiterId: "" } : blank);
    setModal({ table });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { number: Number(form.number), area: form.area, seats: Number(form.seats) };
      if (modal.table) await api(`/admin/tables/${modal.table.id}`, { method: "PATCH", body });
      else {
        if (form.assignedWaiterId) body.assignedWaiterId = Number(form.assignedWaiterId);
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

  const patch = (tb, body) => act(() => api(`/admin/tables/${tb.id}`, { method: "PATCH", body }));
  const regenerate = (tb) => act(() => api(`/admin/tables/${tb.id}/regenerate-qr`, { method: "POST" }), "tableAdmin.regenerateWarn");
  const remove = (tb) => act(() => api(`/admin/tables/${tb.id}`, { method: "DELETE" }), "tableAdmin.deleteWarn");
  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setMsg(t("tableAdmin.copied"));
    } catch {
      window.prompt(t("tableAdmin.copyLink"), url);
    }
  };

  const localhost = /localhost|127\.0\.0\.1/.test(base);

  return (
    <Layout>
      <PageHeader title={t("nav.tables")} subtitle={t("tableAdmin.subtitle")}>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            {t("manager.print")}
          </Button>
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("tableAdmin.add")}
          </Button>
        </div>
      </PageHeader>

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4 print:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand">
          <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-48 flex-1">
          <label htmlFor="base-url" className="text-sm font-semibold">{t("manager.baseUrl")}</label>
          <p className="text-xs text-muted">{t("tableAdmin.baseHint")}</p>
        </div>
        <input id="base-url" value={base} onChange={(e) => setBase(e.target.value)} className={`${inputCls} w-full sm:w-72`} />
        {localhost && (
          <p className="w-full text-xs font-medium text-amber-700">{t("tableAdmin.localhostWarn")}</p>
        )}
      </Card>

      {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {error && !modal && <Alert onClose={() => setError("")}>{error}</Alert>}

      {!tables ? (
        <LoadingState />
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState icon={QrCode} title={t("tableAdmin.empty")}>
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("tableAdmin.add")}
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
          {tables.map((tb) => {
            const url = `${base}/t/${tb.token}`;
            return (
              <Card key={tb.id} className={`break-inside-avoid p-0 ${tb.is_closed ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-2 p-4 pb-0">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t("waiter.table")}</div>
                    <div className="text-3xl font-bold leading-none">{tb.number}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      {tb.area} · <Users className="h-3.5 w-3.5" aria-hidden="true" /> {tb.seats}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 print:hidden">
                    <StatusChip kind="table" status={tb.status} />
                    {tb.is_closed ? <Badge tone="red">{t("tableAdmin.closed")}</Badge> : null}
                  </div>
                </div>

                <div className="mx-4 my-4 flex flex-col items-center rounded-xl border border-dashed border-line bg-slate-50/60 p-4">
                  <div className="rounded-lg bg-white p-2 shadow-sm">
                    <QRCodeSVG value={url} size={140} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-muted">{t("manager.scan")}</p>
                </div>

                <div className="space-y-3 border-t border-line p-4 print:hidden">
                  <Field label={t("tableAdmin.waiter")}>
                    <select
                      value={tb.assigned_waiter_id || ""}
                      onChange={(e) => patch(tb, { assigned_waiter_id: e.target.value ? Number(e.target.value) : null })}
                      className={`${selectCls} h-10`}
                    >
                      <option value="">{t("tableAdmin.noWaiter")}</option>
                      {waiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-center gap-1">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-brand hover:bg-brand-50"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t("tableAdmin.openCustomer")}
                    </a>
                    <IconButton label={t("tableAdmin.copyLink")} onClick={() => copy(url)}>
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t("common.edit")} onClick={() => openForm(tb)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={tb.is_closed ? t("tableAdmin.reopen") : t("tableAdmin.close")}
                      onClick={() => patch(tb, { is_closed: !tb.is_closed })}
                    >
                      {tb.is_closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label={t("tableAdmin.regenerate")} onClick={() => regenerate(tb)}>
                      <RefreshCw className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t("common.delete")} onClick={() => remove(tb)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.table ? t("tableAdmin.edit") : t("tableAdmin.add")} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("tableAdmin.number")}>
                <input required type="number" min="1" max="999" value={form.number} onChange={set("number")} className={inputCls} />
              </Field>
              <Field label={t("tableAdmin.seats")}>
                <input required type="number" min="1" max="50" value={form.seats} onChange={set("seats")} className={inputCls} />
              </Field>
            </div>
            <Field label={t("tableAdmin.area")}>
              <input required minLength={2} value={form.area} onChange={set("area")} className={inputCls} />
            </Field>
            {!modal.table && (
              <Field label={t("tableAdmin.waiter")}>
                <select value={form.assignedWaiterId} onChange={set("assignedWaiterId")} className={selectCls}>
                  <option value="">{t("tableAdmin.noWaiter")}</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
