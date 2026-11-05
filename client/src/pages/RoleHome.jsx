import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import { staffSocket } from "../lib/socket.js";

export default function RoleHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    socket.on("connect", () => setOnline(true));
    socket.on("disconnect", () => setOnline(false));
    return () => socket.disconnect();
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-bold">
        {t("home.welcome")}, {user.full_name}
      </h1>
      <p className="mt-1 text-slate-600">{t(`roles.${user.role}`)}</p>
      <p className={`mt-4 font-medium ${online ? "text-free" : "text-paying"}`}>
        {online ? t("home.online") : t("home.offline")}
      </p>
      <p className="mt-6 rounded-xl border border-dashed border-line bg-white p-6 text-slate-600">
        {t("home.soon")}
      </p>
    </Layout>
  );
}
