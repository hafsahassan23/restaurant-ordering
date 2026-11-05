import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { homeFor } from "./lib/roles.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import RoleHome from "./pages/RoleHome.jsx";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

const guarded = (role) => (
  <ProtectedRoute roles={[role]}>
    <RoleHome />
  </ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/manager" element={guarded("manager")} />
      <Route path="/cashier" element={guarded("cashier")} />
      <Route path="/waiter" element={guarded("waiter")} />
      <Route path="/kitchen" element={guarded("kitchen")} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
