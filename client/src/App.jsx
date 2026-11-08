import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { homeFor } from "./lib/roles.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Customer from "./pages/Customer.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Waiter from "./pages/Waiter.jsx";
import Cashier from "./pages/Cashier.jsx";
import ManagerTables from "./pages/ManagerTables.jsx";
import Reports from "./pages/Reports.jsx";
import MenuAdmin from "./pages/MenuAdmin.jsx";
import Stock from "./pages/Stock.jsx";
import Settings from "./pages/Settings.jsx";
import Staff from "./pages/Staff.jsx";
import Orders from "./pages/Orders.jsx";
import BillHistory from "./pages/BillHistory.jsx";

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
      <Route
        path="/manager"
        element={<Navigate to="/manager/reports" replace />}
      />
      <Route path="/manager/reports" element={guard("manager", <Reports />)} />
      <Route path="/manager/orders" element={guard("manager", <Orders />)} />
      <Route path="/manager/menu" element={guard("manager", <MenuAdmin />)} />
      <Route path="/manager/stock" element={guard("manager", <Stock />)} />
      <Route
        path="/manager/tables"
        element={guard("manager", <ManagerTables />)}
      />
      <Route path="/manager/staff" element={guard("manager", <Staff />)} />
      <Route
        path="/manager/settings"
        element={guard("manager", <Settings />)}
      />
      <Route path="/waiter" element={guard("waiter", <Waiter />)} />
      <Route path="/kitchen" element={guard("kitchen", <Kitchen />)} />
      <Route path="/cashier" element={guard("cashier", <Cashier />)} />
      <Route
        path="/cashier/bills"
        element={guard("cashier", <BillHistory />)}
      />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
