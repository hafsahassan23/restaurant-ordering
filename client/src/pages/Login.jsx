import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock, User, Zap, ChefHat, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../lib/roles.js";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import { Logo } from "../components/Layout.jsx";
import { Alert, Button } from "../components/ui.jsx";

const inputClass =
  "h-12 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-[15px] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10";

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

  const features = [
    [Zap, "auth.feature1"],
    [ChefHat, "auth.feature2"],
    [BarChart3, "auth.feature3"],
  ];

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <img src="/images/cover.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Logo light />
          <div className="max-w-md text-white">
            <h2 className="text-3xl font-bold leading-tight xl:text-4xl">{t("auth.panelTitle")}</h2>
            <p className="mt-3 text-white/75">{t("auth.panelText")}</p>
            <ul className="mt-8 space-y-3">
              {features.map(([Icon, key]) => (
                <li key={key} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Form */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <div className="lg:invisible">
            <Logo />
          </div>
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <form onSubmit={onSubmit} noValidate className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">{t("auth.welcome")}</h1>
            <p className="mb-8 mt-1 text-muted">{t("auth.subtitle")}</p>

            {serverError && <Alert>{serverError}</Alert>}

            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("auth.username")}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="username"
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                aria-invalid={!!errors.username}
              />
            </div>
            {errors.username && <p className="mt-1 text-xs font-medium text-red-600">{errors.username}</p>}

            <label htmlFor="password" className="mb-1.5 mt-5 block text-sm font-medium text-slate-700">
              {t("auth.password")}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="password"
                type={show ? "text" : "password"}
                className={`${inputClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t("auth.hide") : t("auth.show")}
                title={show ? t("auth.hide") : t("auth.show")}
                className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs font-medium text-red-600">{errors.password}</p>}

            <Button type="submit" size="lg" loading={busy} className="mt-8 w-full">
              {busy ? t("auth.loading") : t("auth.submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
