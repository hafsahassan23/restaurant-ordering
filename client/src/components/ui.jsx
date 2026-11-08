import { useEffect } from "react";

export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const BADGE = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-blue-100 text-blue-800",
  teal: "bg-teal-100 text-teal-800",
};
export function Badge({ tone = "gray", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

const BTN = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-line bg-white hover:bg-slate-50",
  danger: "bg-paying text-white hover:bg-red-700",
  ghost: "text-brand hover:bg-brand/10",
};
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-slate-600">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

const ALERT = {
  error: "bg-red-50 text-red-800",
  success: "bg-green-50 text-green-900",
  info: "bg-blue-50 text-blue-900",
};
export function Alert({ tone = "error", children }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl px-4 py-3 ${ALERT[tone]}`}
    >
      {children}
    </div>
  );
}

/** Centered dialog. Closes with the X button, a click outside, or the Escape key. */
export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-full bg-slate-100 text-xl"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
