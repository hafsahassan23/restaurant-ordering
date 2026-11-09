import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, KeyRound, UserX, UserCheck, Users } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { Alert, Badge, Button, Card, EmptyState, Field, IconButton, LoadingState, Modal, PageHeader, StatCard, inputCls, selectCls } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";

const ROLES = ["manager", "cashier", "waiter", "kitchen"];
const ROLE_TONE = { manager: "violet", cashier: "blue", waiter: "teal", kitchen: "amber" };
const blank = { full_name: "", username: "", password: "", role: "waiter" };
const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Manager: create staff accounts, change roles, disable accounts, reset passwords. */
export default function Staff() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'create' } | { type: 'reset', user }
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("/users")
      .then((d) => !cancelled && setUsers(d))
      .catch(() => !cancelled && setError(t("common.error")));
    return () => {
      cancelled = true;
    };
  }, [version, t]);

  const reload = () => setVersion((v) => v + 1);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal.type === "create") await api("/users", { method: "POST", body: form });
      else await api(`/users/${modal.user.id}/reset-password`, { method: "POST", body: { password: form.password } });
      setModal(null);
      setMsg(t("staff.saved"));
      reload();
    } catch (err) {
      setError(errorText(t, "staff", err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(u, body) {
    setError("");
    setMsg("");
    try {
      await api(`/users/${u.id}`, { method: "PATCH", body });
      reload();
    } catch (err) {
      setError(errorText(t, "staff", err));
    }
  }

  const open = (next) => {
    setForm(blank);
    setError("");
    setMsg("");
    setModal(next);
  };

  const counts = Object.fromEntries(ROLES.map((r) => [r, (users || []).filter((u) => u.role === r && u.is_active).length]));

  return (
    <Layout>
      <PageHeader title={t("staff.title")} subtitle={t("staff.subtitle")}>
        <Button onClick={() => open({ type: "create" })}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("staff.add")}
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {ROLES.map((r) => (
          <StatCard key={r} label={t(`roles.${r}`)} value={counts[r]} tone={{ manager: "violet", cashier: "blue", waiter: "brand", kitchen: "amber" }[r]} icon={Users} />
        ))}
      </div>

      {msg && <Alert tone="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {error && !modal && <Alert onClose={() => setError("")}>{error}</Alert>}

      <Card className="overflow-hidden p-0">
        {!users ? (
          <LoadingState />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title={t("staff.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[680px]">
              <thead>
                <tr>
                  <th>{t("staff.fullName")}</th>
                  <th>{t("staff.role")}</th>
                  <th>{t("staff.status")}</th>
                  <th className="text-right">{t("staff.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className={u.is_active ? "" : "opacity-60"}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-dark">
                            {initials(u.full_name)}
                          </span>
                          <div className="leading-tight">
                            <div className="font-semibold">
                              {u.full_name}
                              {self && <Badge tone="teal" className="ml-2">{t("staff.you")}</Badge>}
                            </div>
                            <div className="text-xs text-muted">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {self ? (
                          <Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => patch(u, { role: e.target.value })}
                            className={`${selectCls} h-9 w-36 text-sm`}
                            aria-label={t("staff.role")}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`roles.${r}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <Badge tone={u.is_active ? "green" : "red"}>{u.is_active ? t("staff.active") : t("staff.disabled")}</Badge>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton label={t("staff.resetPassword")} onClick={() => open({ type: "reset", user: u })}>
                            <KeyRound className="h-4 w-4" />
                          </IconButton>
                          {!self && (
                            <IconButton
                              label={u.is_active ? t("staff.disable") : t("staff.enable")}
                              onClick={() => patch(u, { is_active: !u.is_active })}
                              className={u.is_active ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-green-50 hover:text-green-700"}
                            >
                              {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <Modal
          title={modal.type === "create" ? t("staff.add") : t("staff.resetPassword")}
          subtitle={modal.type === "reset" ? modal.user.full_name : undefined}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            {modal.type === "create" && (
              <>
                <Field label={t("staff.fullName")}>
                  <input required minLength={3} value={form.full_name} onChange={set("full_name")} className={inputCls} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("staff.username")}>
                    <input required minLength={3} value={form.username} onChange={set("username")} autoCapitalize="none" className={inputCls} />
                  </Field>
                  <Field label={t("staff.role")}>
                    <select value={form.role} onChange={set("role")} className={selectCls}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
            <Field label={modal.type === "create" ? t("staff.password") : t("staff.newPassword")} hint={t("staff.passwordHint")}>
              <input required type="password" minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" className={inputCls} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy}>
                {modal.type === "create" ? t("staff.create") : t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
