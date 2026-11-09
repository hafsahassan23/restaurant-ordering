/**
 * Shared UI building blocks. Every screen uses these so spacing, colours, focus states
 * and empty/loading/error states look the same everywhere.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";

export const inputCls =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink shadow-[0_1px_0_rgb(15_23_42/0.02)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50 disabled:text-slate-500";
export const selectCls =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink shadow-[0_1px_0_rgb(15_23_42/0.02)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50 disabled:text-slate-500 select-chevron";
export const textareaCls =
  "min-h-24 py-2 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink shadow-[0_1px_0_rgb(15_23_42/0.02)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50 disabled:text-slate-500";

const BADGE = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  teal: "bg-brand-50 text-brand-dark ring-brand-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
export function Badge({ tone = "gray", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const BTN = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-dark",
  secondary: "border border-line bg-white text-ink shadow-sm hover:border-slate-300 hover:bg-slate-50",
  danger: "bg-paying text-white shadow-sm hover:bg-red-700",
  ghost: "text-brand hover:bg-brand-50",
  subtle: "bg-slate-100 text-ink hover:bg-slate-200",
};
const SIZE = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
};
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${SIZE[size]} ${BTN[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Square button that only shows an icon. `label` is read by screen readers. */
export function IconButton({ label, className = "", children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** On/off toggle with a visible label. */
export function Switch({ checked, onChange, label, disabled = false, tone = "brand" }) {
  const on = tone === "red" ? "bg-paying" : "bg-brand";
  return (
    <label className={`inline-flex select-none items-center gap-2.5 text-sm font-medium text-slate-700 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? on : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
      {label}
    </label>
  );
}

export function Card({ className = "", children }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** Card title row: title on the left, actions on the right. */
export function CardHeader({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted sm:text-[15px]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const STAT_TONE = {
  brand: "bg-brand-50 text-brand",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};
/** Key number with a label, e.g. "Pending orders: 3". */
export function StatCard({ label, value, hint, icon: Icon, tone = "brand", className = "" }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-4 shadow-card ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${STAT_TONE[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="stat-value mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

const ALERT = {
  error: ["border-red-200 bg-red-50 text-red-800", AlertCircle],
  success: ["border-green-200 bg-green-50 text-green-800", CheckCircle2],
  info: ["border-blue-200 bg-blue-50 text-blue-800", Info],
  warning: ["border-amber-200 bg-amber-50 text-amber-900", AlertCircle],
};
export function Alert({ tone = "error", className = "", children, onClose }) {
  const [cls, Icon] = ALERT[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${cls} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1 rounded p-1 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }) {
  return <Loader2 className={`animate-spin text-brand ${className}`} aria-hidden="true" />;
}

/** Centered loading state for a page or a panel. */
export function LoadingState({ label, className = "" }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted ${className}`}>
      <Spinner className="h-6 w-6" />
      {label || t("common.loading")}
    </div>
  );
}

/** Friendly "nothing here" state with an icon and an optional action. */
export function EmptyState({ icon: Icon, title, text, children, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Centered dialog. Closes with the X button, a click outside, or the Escape key. */
export function Modal({ title, subtitle, onClose, children, footer, wide = false }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <IconButton label={t("common.close")} onClick={onClose} className="-mr-2 -mt-1">
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
