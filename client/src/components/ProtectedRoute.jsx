import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../lib/roles.js";

/** Only logged-in users with an allowed role can see the page. */
export default function ProtectedRoute({ roles, children }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-lg">
        {t("common.loading")}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
