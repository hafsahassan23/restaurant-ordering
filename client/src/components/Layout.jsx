import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3, ClipboardList, UtensilsCrossed, Package, QrCode, Users, Settings,
  Receipt, History, LogOut, Menu, X, ChefHat, LayoutGrid,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import LanguageSwitch from "./LanguageSwitch.jsx";

/** Navigation per role. Roles with one screen (waiter, kitchen) get a full-width layout. */
const NAV = {
  manager: [
    ["/manager/reports", "nav.reports", BarChart3],
    ["/manager/orders", "nav.orders", ClipboardList],
    ["/manager/menu", "nav.menu", UtensilsCrossed],
    ["/manager/stock", "nav.stock", Package],
    ["/manager/tables", "nav.tables", QrCode],
    ["/manager/staff", "nav.staff", Users],
    ["/manager/settings", "nav.settings", Settings],
  ],
  cashier: [
    ["/cashier", "cashier.tabBills", Receipt, true],
    ["/cashier/bills", "cashier.tabHistory", History],
  ],
  waiter: [["/waiter", "nav.floor", LayoutGrid]],
  kitchen: [["/kitchen", "kitchen.title", ChefHat]],
};

const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function Logo({ light = false }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${light ? "bg-white/10 text-white" : "bg-brand text-white"}`}>
        <UtensilsCrossed className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <div className={`text-[15px] font-bold ${light ? "text-white" : "text-ink"}`}>{t("app.name")}</div>
        <div className={`text-[11px] ${light ? "text-white/60" : "text-muted"}`}>{t("app.tagline")}</div>
      </div>
    </div>
  );
}

function NavItems({ links, onNavigate }) {
  const { t } = useTranslation();
  return (
    <nav className="space-y-0.5">
      {links.map(([to, key, Icon, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
              isActive ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`h-[18px] w-[18px] ${isActive ? "text-accent" : ""}`} aria-hidden="true" />
              {t(key)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserCard({ user, onLogout, light = false }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
          light ? "bg-white/15 text-white" : "bg-brand-50 text-brand-dark"
        }`}
      >
        {initials(user.full_name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={`truncate text-sm font-semibold ${light ? "text-white" : "text-ink"}`}>{user.full_name}</div>
        <div className={`text-xs ${light ? "text-white/60" : "text-muted"}`}>{t(`roles.${user.role}`)}</div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        aria-label={t("common.logout")}
        title={t("common.logout")}
        className={`grid h-9 w-9 place-items-center rounded-lg transition ${
          light ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
        }`}
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * App shell for every staff screen.
 * Manager and cashier: dark sidebar on desktop, slide-in drawer on phones.
 * Waiter and kitchen: a slim top bar so the operational screen gets the full width.
 */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role] || [];
  const sidebar = links.length > 1;

  if (!sidebar) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur print:hidden">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
            <Logo />
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSwitch />
              <div className="hidden h-8 w-px bg-line sm:block" />
              <div className="hidden sm:block">
                <UserCard user={user} onLogout={logout} />
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Logout"
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 sm:hidden"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    );
  }

  const panel = (onNavigate) => (
    <div className="flex h-full flex-col bg-brand-900 px-3 py-4">
      <div className="px-2 pb-6">
        <Logo light />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavItems links={links} onNavigate={onNavigate} />
      </div>
      <div className="mt-4 space-y-3 border-t border-white/10 px-1 pt-4">
        <LanguageSwitch dark />
        <UserCard user={user} onLogout={logout} light />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">{panel()}</aside>

      {/* Phone / tablet top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          aria-expanded={open}
          className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Logo />
        <LanguageSwitch />
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-pop">
            {panel(() => setOpen(false))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
