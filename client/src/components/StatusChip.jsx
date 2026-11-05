import { useTranslation } from "react-i18next";

const TABLE = {
  free: "bg-free text-white",
  ordering: "bg-ordering text-white",
  waiting_food: "bg-waiting text-slate-900",
  eating: "bg-eating text-white",
  paying: "bg-paying text-white",
};
const ITEM = {
  pending: "bg-slate-200 text-slate-800",
  ordered: "bg-ordering text-white",
  cooking: "bg-waiting text-slate-900",
  ready: "bg-free text-white",
  served: "bg-eating text-white",
  cancelled: "bg-paying text-white",
};

/** Status badge: kind = "table" or "item". Always shows text, not only color. */
export default function StatusChip({ kind = "table", status }) {
  const { t } = useTranslation();
  const styles = kind === "table" ? TABLE : ITEM;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
        styles[status] || "bg-slate-200 text-slate-800"
      }`}
    >
      {t(`${kind}Status.${status}`)}
    </span>
  );
}
