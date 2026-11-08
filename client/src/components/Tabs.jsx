import { NavLink } from "react-router-dom";

const base =
  "flex h-11 shrink-0 items-center gap-2 rounded-full px-5 font-semibold transition";
const on = "bg-brand text-white";
const off = "border border-line bg-white hover:bg-slate-50";

/** In-page tabs with optional count badges: tabs = [{ id, label, count? }]. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div
      role="tablist"
      className="mb-4 flex gap-2 overflow-x-auto print:hidden"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`${base} ${value === tab.id ? on : off}`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-sm font-bold ${value === tab.id ? "bg-white text-brand" : "bg-paying text-white"}`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Tabs that are separate pages (routes): items = [{ to, label, end? }]. */
export function RouteTabs({ items }) {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto print:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `${base} ${isActive ? on : off}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
