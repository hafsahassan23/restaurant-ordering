import { useTranslation } from "react-i18next";

// Soft background + coloured dot + text: readable, and never relies on colour alone.
const TABLE = {
  free: "bg-green-50 text-green-700 ring-green-200 [--dot:var(--color-free)]",
  ordering: "bg-blue-50 text-blue-700 ring-blue-200 [--dot:var(--color-ordering)]",
  waiting_food: "bg-amber-50 text-amber-800 ring-amber-200 [--dot:var(--color-waiting)]",
  eating: "bg-violet-50 text-violet-700 ring-violet-200 [--dot:var(--color-eating)]",
  paying: "bg-red-50 text-red-700 ring-red-200 [--dot:var(--color-paying)]",
};
const ITEM = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200 [--dot:#94a3b8]",
  ordered: "bg-blue-50 text-blue-700 ring-blue-200 [--dot:var(--color-ordering)]",
  cooking: "bg-amber-50 text-amber-800 ring-amber-200 [--dot:var(--color-waiting)]",
  ready: "bg-green-50 text-green-700 ring-green-200 [--dot:var(--color-free)]",
  served: "bg-violet-50 text-violet-700 ring-violet-200 [--dot:var(--color-eating)]",
  cancelled: "bg-red-50 text-red-700 ring-red-200 [--dot:var(--color-paying)]",
};

/** Status badge: kind = "table" or "item". Always shows text, not only colour. */
export default function StatusChip({ kind = "table", status, className = "" }) {
  const { t } = useTranslation();
  const styles = kind === "table" ? TABLE : ITEM;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        styles[status] || "bg-slate-100 text-slate-700 ring-slate-200 [--dot:#94a3b8]"
      } ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" aria-hidden="true" />
      {t(`${kind}Status.${status}`)}
    </span>
  );
}
