import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../lib/roles.js";
import { LoadingState } from "./ui.jsx";

/** Only logged-in users with an allowed role can see the page. */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
