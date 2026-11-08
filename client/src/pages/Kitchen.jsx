// import { useCallback, useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";
// import Layout from "../components/Layout.jsx";
// import StatusChip from "../components/StatusChip.jsx";
// import { api } from "../lib/api";
// import { staffSocket } from "../lib/socket";
// import { pick, minutesSince, mmss } from "../lib/format";
// import { beep } from "../lib/beep";
// import { useNow } from "../lib/useNow";

// const NEXT = { ordered: "cooking", cooking: "ready" };
// const VISIBLE = ["ordered", "cooking", "ready"];
// // green under 10 min, orange 10-20, red over 20
// const ageColor = (m) =>
//   m < 10
//     ? "bg-free text-white"
//     : m <= 20
//       ? "bg-waiting text-slate-900"
//       : "bg-paying text-white";

// export default function Kitchen() {
//   const { t, i18n } = useTranslation();
//   const lang = i18n.language;
//   const [orders, setOrders] = useState([]);
//   const [online, setOnline] = useState(false);
//   const [error, setError] = useState(false);
//   const now = useNow();

//   const load = useCallback(() => {
//     api("/kitchen/orders")
//       .then(setOrders)
//       .catch(() => setError(true));
//   }, []);

//  useEffect(() => {
//    const socket = staffSocket(localStorage.getItem("token"));
//    socket.on("connect", () => {
//      setOnline(true);
//      load();
//    }); // reload everything after a reconnect
//    socket.on("disconnect", () => setOnline(false));
//    socket.on("order:confirmed", () => {
//      beep();
//      load();
//    });
//    socket.on("item:updated", load);
//    return () => socket.disconnect();
//  }, [load]);

//   async function advance(item) {
//     setError(false);
//     try {
//       await api(`/items/${item.id}/status`, {
//         method: "PATCH",
//         body: { status: NEXT[item.status] },
//       });
//     } catch {
//       setError(true);
//     }
//   }

//   return (
//     <Layout>
//       <div className="mb-4 flex items-center justify-between">
//         <h1 className="text-2xl font-bold">{t("kitchen.title")}</h1>
//         <span
//           className={`font-semibold ${online ? "text-free" : "text-paying"}`}
//         >
//           {online
//             ? `● ${t("kitchen.online")}`
//             : `○ ${t("kitchen.reconnecting")}`}
//         </span>
//       </div>
//       {error && (
//         <div
//           role="alert"
//           className="mb-4 rounded-xl bg-red-50 p-3 text-red-800"
//         >
//           {t("common.error")}
//         </div>
//       )}
//       {orders.length === 0 && (
//         <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-lg text-slate-600">
//           {t("kitchen.empty")}
//         </p>
//       )}
//       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//         {orders.map((o) => {
//           const mins = minutesSince(o.confirmed_at, now);
//           return (
//             <article
//               key={o.id}
//               className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
//             >
//               <header
//                 className={`flex items-center justify-between px-4 py-3 ${ageColor(mins)}`}
//               >
//                 <span className="text-2xl font-bold">
//                   {t("kitchen.table")} {o.table_number}
//                 </span>
//                 <span className="text-right font-semibold">
//                   <span className="block text-xl">
//                     {mmss(o.confirmed_at, now)}
//                   </span>
//                   <span className="text-sm">
//                     {mins} {t("kitchen.min")}
//                   </span>
//                 </span>
//               </header>
//               <ul className="divide-y divide-line">
//                 {o.items
//                   .filter((i) => VISIBLE.includes(i.status))
//                   .map((i) => (
//                     <li key={i.id} className="p-4">
//                       <div className="text-lg font-semibold">
//                         {i.quantity} × {pick(i, "dish_name", lang)}
//                       </div>
//                       {i.modifiers.length > 0 && (
//                         <div className="text-slate-700">
//                           {i.modifiers
//                             .map((m) => pick(m, "name", lang))
//                             .join(", ")}
//                         </div>
//                       )}
//                       {i.notes && (
//                         <div className="mt-1 rounded bg-yellow-100 px-2 py-1 font-medium">
//                           {i.notes}
//                         </div>
//                       )}
//                       <div className="mt-3 flex items-center justify-between gap-2">
//                         <StatusChip kind="item" status={i.status} />
//                         {NEXT[i.status] ? (
//                           <button
//                             type="button"
//                             onClick={() => advance(i)}
//                             className="h-12 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
//                           >
//                             {i.status === "ordered"
//                               ? t("kitchen.start")
//                               : t("kitchen.ready")}
//                           </button>
//                         ) : (
//                           <span className="text-sm text-slate-600">
//                             {t("kitchen.waitingWaiter")}
//                           </span>
//                         )}
//                       </div>
//                     </li>
//                   ))}
//               </ul>
//             </article>
//           );
//         })}
//       </div>
//     </Layout>
//   );
// }

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { pick, minutesSince, mmss } from "../lib/format";
import { beep } from "../lib/beep";
import { useNow } from "../lib/useNow";

const NEXT = {
  ordered: "cooking",
  cooking: "ready",
};

const VISIBLE = ["ordered", "cooking", "ready"];

const ageStyle = (minutes) => {
  if (minutes < 10) {
    return {
      header: "bg-emerald-600 text-white",
      badge: "bg-emerald-50 text-emerald-700",
      label: "Fresh",
      dot: "bg-emerald-400",
    };
  }

  if (minutes <= 20) {
    return {
      header: "bg-amber-400 text-slate-950",
      badge: "bg-amber-50 text-amber-800",
      label: "Attention",
      dot: "bg-amber-500",
    };
  }

  return {
    header: "bg-red-600 text-white",
    badge: "bg-red-50 text-red-700",
    label: "Delayed",
    dot: "bg-red-500",
  };
};

export default function Kitchen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [orders, setOrders] = useState([]);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState([]);
  const now = useNow();

  const load = useCallback(() => {
    api("/kitchen/orders")
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));

    socket.on("connect", () => {
      setOnline(true);
      load();
    });

    socket.on("disconnect", () => setOnline(false));

    socket.on("order:confirmed", () => {
      beep();
      load();
    });

    socket.on("item:updated", load);

    // Initial load in case the socket is already connected.
    load();

    return () => socket.disconnect();
  }, [load]);

  const visibleOrders = useMemo(() => {
    return [...orders]
      .map((order) => ({
        ...order,
        items: (order.items || []).filter((item) =>
          VISIBLE.includes(item.status),
        ),
      }))
      .filter((order) => order.items.length > 0)
      .sort(
        (a, b) =>
          new Date(a.confirmed_at).getTime() -
          new Date(b.confirmed_at).getTime(),
      );
  }, [orders]);

  const allItems = visibleOrders.flatMap((order) => order.items);

  const orderedCount = allItems.filter(
    (item) => item.status === "ordered",
  ).length;

  const cookingCount = allItems.filter(
    (item) => item.status === "cooking",
  ).length;

  const readyCount = allItems.filter((item) => item.status === "ready").length;

  async function advance(item) {
    if (!NEXT[item.status] || updating.includes(item.id)) return;

    setError(false);
    setUpdating((current) => [...current, item.id]);

    try {
      await api(`/items/${item.id}/status`, {
        method: "PATCH",
        body: { status: NEXT[item.status] },
      });

      load();
    } catch {
      setError(true);
    } finally {
      setUpdating((current) => current.filter((id) => id !== item.id));
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page heading */}
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Kitchen operations
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("kitchen.title")}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage incoming orders and preparation progress.
            </p>
          </div>

          <div
            className={`flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              online
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                online ? "animate-pulse bg-emerald-500" : "bg-red-500"
              }`}
            />
            {online ? t("kitchen.online") : t("kitchen.reconnecting")}
          </div>
        </section>

        {/* Order summary */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active orders</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {visibleOrders.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Tables waiting for kitchen
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-700">
              {t("itemStatus.ordered", "New items")}
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-900">
              {orderedCount}
            </p>
            <p className="mt-1 text-xs text-blue-600">Waiting to start</p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">
              {t("itemStatus.cooking", "Cooking")}
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {cookingCount}
            </p>
            <p className="mt-1 text-xs text-amber-700">In preparation</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">
              {t("itemStatus.ready", "Ready")}
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {readyCount}
            </p>
            <p className="mt-1 text-xs text-emerald-700">Waiting for waiter</p>
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm font-medium">{t("common.error")}</p>

            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* Orders heading */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Incoming orders
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Oldest confirmed orders are displayed first.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <span aria-hidden="true">↻</span>
            Refresh
          </button>
        </div>

        {/* Empty state */}
        {visibleOrders.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-5 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
              🍽️
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-800">
              {t("kitchen.empty")}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              New confirmed orders will appear here automatically.
            </p>
          </div>
        )}

        {/* Kitchen order cards */}
        <section className="grid items-start gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleOrders.map((order) => {
            const mins = minutesSince(order.confirmed_at, now);
            const age = ageStyle(mins);

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Order header */}
                <header className={`${age.header} px-5 py-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                        {t("kitchen.table")}
                      </p>

                      <h3 className="mt-1 text-3xl font-extrabold">
                        #{order.table_number}
                      </h3>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                        Preparation time
                      </p>

                      <p className="mt-1 text-2xl font-bold tabular-nums">
                        {mmss(order.confirmed_at, now)}
                      </p>

                      <p className="text-xs font-medium opacity-90">
                        {mins} {t("kitchen.min")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-current/20 pt-3">
                    <span className="text-sm font-semibold">
                      {order.items.length} item(s)
                    </span>

                    <span className="flex items-center gap-2 rounded-full bg-black/10 px-3 py-1 text-xs font-bold">
                      <span className={`h-2 w-2 rounded-full ${age.dot}`} />
                      {age.label}
                    </span>
                  </div>
                </header>

                {/* Order items */}
                <ul className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <li key={item.id} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-bold leading-snug text-slate-900">
                            <span className="mr-2 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-extrabold text-slate-700">
                              {item.quantity}×
                            </span>
                            {pick(item, "dish_name", lang)}
                          </p>

                          {item.modifiers?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.modifiers.map((modifier, index) => (
                                <span
                                  key={`${item.id}-modifier-${index}`}
                                  className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                                >
                                  {pick(modifier, "name", lang)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <StatusChip kind="item" status={item.status} />
                      </div>

                      {item.notes && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                            Special instructions
                          </p>
                          <p className="mt-1 text-sm font-medium text-amber-900">
                            {item.notes}
                          </p>
                        </div>
                      )}

                      <div className="mt-4">
                        {NEXT[item.status] ? (
                          <button
                            type="button"
                            disabled={updating.includes(item.id)}
                            onClick={() => advance(item)}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              item.status === "ordered"
                                ? "bg-slate-900 hover:bg-slate-700"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {updating.includes(item.id) ? (
                              "Updating..."
                            ) : item.status === "ordered" ? (
                              <>
                                <span>▶</span>
                                {t("kitchen.start")}
                              </>
                            ) : (
                              <>
                                <span>✓</span>
                                {t("kitchen.ready")}
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                            <span>✓</span>
                            {t("kitchen.waitingWaiter")}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      </div>
    </Layout>
  );
}