import { NavLink } from "react-router-dom";

// Segmented control: one grey track, the active tab is a white raised pill.
const track = "scroll-thin mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1 print:hidden";
const base = "flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition";
const on = "bg-white text-ink shadow-sm";
const off = "text-slate-600 hover:text-ink";

/** In-page tabs with optional count badges: tabs = [{ id, label, count?, icon? }]. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className={track}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`${base} ${active ? on : off}`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold ${
                  active ? "bg-brand text-white" : "bg-paying text-white"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tabs that are separate pages (routes): items = [{ to, label, end? }]. */
export function RouteTabs({ items }) {
  return (
    <nav className={track}>
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
