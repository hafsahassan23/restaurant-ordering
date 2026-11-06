import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { homeFor } from "./lib/roles.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
// import RoleHome from "./pages/RoleHome.jsx";
import Customer from "./pages/Customer.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Waiter from "./pages/Waiter.jsx";
import ManagerTables from "./pages/ManagerTables.jsx";
import Cashier from "./pages/Cashier.jsx";
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

const guard = (role, page) => (
  <ProtectedRoute roles={[role]}>{page}</ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/t/:token" element={<Customer />} />
      <Route path="/manager" element={guard("manager", <ManagerTables />)} />
      <Route path="/waiter" element={guard("waiter", <Waiter />)} />
      <Route path="/kitchen" element={guard("kitchen", <Kitchen />)} />
      {/* <Route path="/cashier" element={guard("cashier", <RoleHome />)} /> */}
      <Route path="/cashier" element={guard("cashier", <Cashier />)} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
