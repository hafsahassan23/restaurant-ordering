import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../lib/roles.js";
import LanguageSwitch from "../components/LanguageSwitch.jsx";

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  // Same limits as the server (username 3+, password 6+)
  const validate = () => {
    const e = {};
    if (!username.trim()) e.username = t("auth.usernameRequired");
    else if (username.trim().length < 3) e.username = t("auth.usernameMin");
    if (!password) e.password = t("auth.passwordRequired");
    else if (password.length < 6) e.password = t("auth.passwordMin");
    return e;
  };

  async function onSubmit(event) {
    event.preventDefault();
    setServerError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const loggedIn = await login(username.trim(), password);
      navigate(homeFor(loggedIn.role), { replace: true });
    } catch (err) {
      if (err.code === "RATE_LIMIT") setServerError(t("auth.tooMany"));
      else if (err.status) setServerError(t("auth.invalid"));
      else setServerError(t("auth.network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex justify-end p-4">
        <LanguageSwitch />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        <form
          onSubmit={onSubmit}
          noValidate
          className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl text-white">
              🍽️
            </div>
            <h1 className="text-2xl font-bold">{t("app.name")}</h1>
            <p className="text-slate-600">{t("app.tagline")}</p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
            >
              {serverError}
            </div>
          )}

          <label htmlFor="username" className="mb-1 block font-medium">
            {t("auth.username")}
          </label>
          <input
            id="username"
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-700">{errors.username}</p>
          )}

          <label htmlFor="password" className="mb-1 mt-4 block font-medium">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className={`${inputClass} pr-24`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-1 top-1 h-10 rounded-lg px-3 text-sm font-medium text-brand"
            >
              {show ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-700">{errors.password}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? t("auth.loading") : t("auth.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
