import { useTranslation } from "react-i18next";
import { useEffect } from "react";

/** SO | EN switch, always visible. The choice is remembered. `dark` = for coloured backgrounds. */
export default function LanguageSwitch({ dark = false }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language.startsWith("en") ? "en" : "so";

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const choose = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("lang", lng);
  };

  return (
    <div
      className={`inline-flex rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-slate-200/70"}`}
      role="group"
      aria-label={t("common.language")}
    >
      {["so", "en"].map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => choose(lng)}
            aria-pressed={active}
            className={`h-8 min-w-10 rounded-md px-2.5 text-xs font-bold tracking-wide transition ${
              active
                ? dark
                  ? "bg-white text-brand-dark"
                  : "bg-white text-ink shadow-sm"
                : dark
                  ? "text-white/80 hover:text-white"
                  : "text-slate-600 hover:text-ink"
            }`}
          >
            {lng.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
