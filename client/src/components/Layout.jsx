import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import LanguageSwitch from "./LanguageSwitch.jsx";

const MANAGER_LINKS = [
  ["/manager/reports", "nav.reports", "📊"],
  ["/manager/orders", "nav.orders", "🧾"],
  ["/manager/menu", "nav.menu", "🍽️"],
  ["/manager/stock", "nav.stock", "📦"],
  ["/manager/tables", "nav.tables", "🪑"],
  ["/manager/staff", "nav.staff", "👥"],
  ["/manager/settings", "nav.settings", "⚙️"],
];

const sideClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 font-semibold transition ${
    isActive ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
  }`;
const pillClass = ({ isActive }) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
    isActive ? "bg-brand text-white" : "border border-line bg-white"
  }`;

/** Top bar for every staff screen; managers also get a sidebar (a scrolling tab bar on phones). */
export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const isManager = user.role === "manager";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="bg-brand text-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden="true">🍽️</span>
            {t("app.name")}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:block">
              {user.full_name} · {t(`roles.${user.role}`)}
            </span>
            <LanguageSwitch />
            <button
              type="button"
              onClick={logout}
              className="h-11 rounded-lg bg-white/15 px-4 text-sm font-medium hover:bg-white/25"
            >
              {t("common.logout")}
            </button>
          </div>
        </div>
      </header>

      {isManager && (
        <nav className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2 md:hidden print:hidden">
          {MANAGER_LINKS.map(([to, key, icon]) => (
            <NavLink key={to} to={to} className={pillClass}>
              <span aria-hidden="true">{icon}</span>
              {t(key)}
            </NavLink>
          ))}
        </nav>
      )}

      <div
        className={`mx-auto flex w-full flex-1 gap-6 p-4 ${isManager ? "max-w-7xl" : "max-w-6xl"}`}
      >
        {isManager && (
          <aside className="hidden w-60 shrink-0 md:block print:hidden">
            <nav className="sticky top-4 space-y-1 rounded-2xl border border-line bg-white p-3 shadow-sm">
              {MANAGER_LINKS.map(([to, key, icon]) => (
                <NavLink key={to} to={to} className={sideClass}>
                  <span aria-hidden="true">{icon}</span>
                  {t(key)}
                </NavLink>
              ))}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
