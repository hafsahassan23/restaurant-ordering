import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
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
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";

const ROLES = ["manager", "cashier", "waiter", "kitchen"];
const blank = { full_name: "", username: "", password: "", role: "waiter" };

/** Manager: create staff accounts, change roles, disable accounts, reset passwords. */
export default function Staff() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'create' } | { type: 'reset', user }
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("/users")
      .then((d) => {
        if (!cancelled) setUsers(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal.type === "create")
        await api("/users", { method: "POST", body: form });
      else
        await api(`/users/${modal.user.id}/reset-password`, {
          method: "POST",
          body: { password: form.password },
        });
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

  return (
    <Layout>
      <PageHeader title={t("staff.title")} subtitle={t("staff.subtitle")}>
        <Button onClick={() => open({ type: "create" })}>
          + {t("staff.add")}
        </Button>
      </PageHeader>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && !modal && <Alert>{error}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-left">
          <thead className="border-b border-line bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">{t("staff.fullName")}</th>
              <th className="px-4 py-3">{t("staff.username")}</th>
              <th className="px-4 py-3">{t("staff.role")}</th>
              <th className="px-4 py-3">{t("staff.status")}</th>
              <th className="px-4 py-3">{t("staff.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    {u.full_name}
                    {self && (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({t("staff.you")})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={self}
                      onChange={(e) => patch(u, { role: e.target.value })}
                      className={`${inputCls} w-40`}
                      aria-label={t("staff.role")}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? "green" : "red"}>
                      {u.is_active ? t("staff.active") : t("staff.disabled")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => open({ type: "reset", user: u })}
                      >
                        {t("staff.resetPassword")}
                      </Button>
                      {!self && (
                        <Button
                          variant={u.is_active ? "danger" : "secondary"}
                          onClick={() => patch(u, { is_active: !u.is_active })}
                        >
                          {u.is_active ? t("staff.disable") : t("staff.enable")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal
          title={
            modal.type === "create"
              ? t("staff.add")
              : `${t("staff.resetPassword")}: ${modal.user.full_name}`
          }
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            {modal.type === "create" && (
              <>
                <Field label={t("staff.fullName")}>
                  <input
                    required
                    minLength={3}
                    value={form.full_name}
                    onChange={set("full_name")}
                    className={inputCls}
                  />
                </Field>
                <Field label={t("staff.username")}>
                  <input
                    required
                    minLength={3}
                    value={form.username}
                    onChange={set("username")}
                    autoCapitalize="none"
                    className={inputCls}
                  />
                </Field>
                <Field label={t("staff.role")}>
                  <select
                    value={form.role}
                    onChange={set("role")}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field
              label={
                modal.type === "create"
                  ? t("staff.password")
                  : t("staff.newPassword")
              }
              hint={t("staff.passwordHint")}
            >
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {modal.type === "create" ? t("staff.create") : t("common.save")}
            </Button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
