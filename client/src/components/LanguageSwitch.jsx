import { useTranslation } from "react-i18next";
import { useEffect } from "react";

/** SO | EN switch, always visible. The choice is remembered. */
export default function LanguageSwitch() {
  const { i18n } = useTranslation();
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
      className="inline-flex rounded-lg border border-line bg-white p-1"
      role="group"
      aria-label="Language"
    >
      {["so", "en"].map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => choose(lng)}
          aria-pressed={current === lng}
          className={`h-9 min-w-11 rounded-md px-3 text-sm font-semibold ${
            current === lng ? "bg-brand text-white" : "text-ink"
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
