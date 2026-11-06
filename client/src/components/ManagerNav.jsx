import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const LINKS = [
  ["/manager", "nav.tables", true],
  ["/manager/reports", "nav.reports", false],
  ["/manager/menu", "nav.menu", false],
  ["/manager/stock", "nav.stock", false],
  ["/manager/settings", "nav.settings", false],
];

/** Tabs shown at the top of every manager screen. */
export default function ManagerNav() {
  const { t } = useTranslation();
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto print:hidden">
      {LINKS.map(([to, key, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `h-11 shrink-0 rounded-full px-5 py-2.5 font-semibold ${isActive ? "bg-brand text-white" : "border border-line bg-white"}`
          }
        >
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}
