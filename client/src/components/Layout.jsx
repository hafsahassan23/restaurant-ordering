import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import LanguageSwitch from "./LanguageSwitch.jsx";

/** Top bar (brand, user, language, logout) around every staff screen. */
export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden="true">🍽️</span>
            {t("app.name")}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:block">
              {user.full_name} · {t(`roles.${user.role}`)}
            </span>
            <LanguageSwitch />
            <button
              type="button"
              onClick={logout}
              className="h-11 rounded-lg bg-white/15 px-4 text-sm font-medium hover:bg-white/25"
            >
              {t("common.logout")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </div>
  );
}
