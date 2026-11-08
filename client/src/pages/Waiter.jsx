// import { useEffect, useMemo, useState } from "react";
// import { useTranslation } from "react-i18next";
// import { useAuth } from "../context/AuthContext.jsx";
// import Layout from "../components/Layout.jsx";
// import StatusChip from "../components/StatusChip.jsx";
// import TableModal from "../components/TableModal.jsx";
// import { Tabs } from "../components/Tabs.jsx";
// import { Alert, Button, Card } from "../components/ui.jsx";
// import { api } from "../lib/api";
// import { errorText } from "../lib/errors";
// import { staffSocket } from "../lib/socket";
// import { pick } from "../lib/format";
// import { beep } from "../lib/beep";

// const BORDER = {
//   free: "border-free",
//   ordering: "border-ordering",
//   waiting_food: "border-waiting",
//   eating: "border-eating",
//   paying: "border-paying",
// };

// /** Waiter: floor map by area, orders waiting for confirmation, and "Ready" alerts from the kitchen. */
// export default function Waiter() {
//   const { t, i18n } = useTranslation();
//   const lang = i18n.language;
//   const { user } = useAuth();
//   const [tables, setTables] = useState([]);
//   const [pending, setPending] = useState([]);
//   const [ready, setReady] = useState([]);
//   const [tab, setTab] = useState("tables");
//   const [selectedId, setSelectedId] = useState(null);
//   const [version, setVersion] = useState(0);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     let cancelled = false;
//     Promise.all([
//       api("/tables"),
//       api("/orders/pending"),
//       api("/kitchen/orders"),
//     ])
//       .then(([tb, pd, kitchen]) => {
//         if (cancelled) return;
//         setTables(tb);
//         setPending(pd);
//         setReady(
//           kitchen.flatMap((o) =>
//             o.items
//               .filter((i) => i.status === "ready")
//               .map((i) => ({
//                 ...i,
//                 table_id: o.table_id,
//                 table_number: o.table_number,
//               })),
//           ),
//         );
//       })
//       .catch(() => {
//         if (!cancelled) setError(t("common.error"));
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [version, t]);

//   useEffect(() => {
//     const socket = staffSocket(localStorage.getItem("token"));
//     const bump = () => setVersion((v) => v + 1);
//     [
//       "connect",
//       "order:confirmed",
//       "order:rejected",
//       "order:moved",
//       "item:updated",
//       "table:updated",
//     ].forEach((e) => socket.on(e, bump));
//     socket.on("order:pending", () => {
//       beep();
//       bump();
//     });
//     socket.on("item:ready", () => {
//       beep();
//       bump();
//     });
//     return () => socket.disconnect();
//   }, []);

//   const isMine = (tableId) => {
//     const tb = tables.find((x) => x.id === tableId);
//     return (
//       Boolean(tb) &&
//       (user.role === "manager" || tb.assigned_waiter_id === user.id)
//     );
//   };

//   async function act(fn) {
//     setError("");
//     try {
//       await fn();
//     } catch (e) {
//       setError(errorText(t, "waiter", e));
//     }
//     setVersion((v) => v + 1);
//   }

//   const confirm = (o) =>
//     act(() => api(`/orders/${o.id}/confirm`, { method: "POST" }));
//   const reject = (o) =>
//     act(() => api(`/orders/${o.id}/reject`, { method: "POST", body: {} }));
//   const serve = (i) =>
//     act(() =>
//       api(`/items/${i.id}/status`, {
//         method: "PATCH",
//         body: { status: "served" },
//       }),
//     );

//   const areas = useMemo(() => {
//     const map = new Map();
//     tables.forEach((tb) => {
//       if (!map.has(tb.area)) map.set(tb.area, []);
//       map.get(tb.area).push(tb);
//     });
//     return [...map.entries()];
//   }, [tables]);

//   const selected = tables.find((x) => x.id === selectedId) || null;

//   return (
//     <Layout>
//       <Tabs
//         value={tab}
//         onChange={setTab}
//         tabs={[
//           { id: "tables", label: t("waiter.tabTables") },
//           {
//             id: "pending",
//             label: t("waiter.tabPending"),
//             count: pending.filter((o) => isMine(o.table_id)).length,
//           },
//           {
//             id: "ready",
//             label: t("waiter.tabReady"),
//             count: ready.filter((i) => isMine(i.table_id)).length,
//           },
//         ]}
//       />
//       {error && <Alert>{error}</Alert>}

//       {tab === "tables" &&
//         areas.map(([area, list]) => (
//           <section key={area} className="mb-6">
//             <h2 className="mb-2 text-lg font-bold text-slate-700">{area}</h2>
//             <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
//               {list.map((tb) => {
//                 const mine = isMine(tb.id);
//                 return (
//                   <button
//                     key={tb.id}
//                     type="button"
//                     onClick={() => setSelectedId(tb.id)}
//                     className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:shadow ${BORDER[tb.status]} ${mine ? "" : "opacity-75"}`}
//                   >
//                     <div className="flex items-center justify-between">
//                       <span className="text-3xl font-bold">{tb.number}</span>
//                       <span aria-hidden="true">{mine ? "" : "🔒"}</span>
//                     </div>
//                     <div className="text-sm text-slate-600">
//                       {tb.seats} {t("waiter.seats")}
//                     </div>
//                     <div className="mt-2">
//                       <StatusChip kind="table" status={tb.status} />
//                     </div>
//                     <div className="mt-1 truncate text-xs text-slate-600">
//                       {mine
//                         ? t("waiter.mine")
//                         : tb.waiter_name || t("waiter.others")}
//                     </div>
//                   </button>
//                 );
//               })}
//             </div>
//           </section>
//         ))}

//       {tab === "pending" && (
//         <>
//           {pending.length === 0 && (
//             <p className="text-slate-600">{t("waiter.noPending")}</p>
//           )}
//           <div className="grid gap-3 md:grid-cols-2">
//             {pending.map((o) => (
//               <Card key={o.id}>
//                 <div className="text-lg font-bold">
//                   {t("waiter.table")} {o.table_number}
//                 </div>
//                 <ul className="mt-2 space-y-1 text-sm">
//                   {o.items.map((i) => (
//                     <li key={i.id}>
//                       <span className="font-semibold">
//                         {i.quantity} × {pick(i, "dish_name", lang)}
//                       </span>
//                       {i.modifiers.length > 0 && (
//                         <span>
//                           {" "}
//                           (
//                           {i.modifiers
//                             .map((m) => pick(m, "name", lang))
//                             .join(", ")}
//                           )
//                         </span>
//                       )}
//                       {i.notes && (
//                         <div className="rounded bg-yellow-100 px-2 py-1">
//                           {i.notes}
//                         </div>
//                       )}
//                     </li>
//                   ))}
//                 </ul>
//                 <div className="mt-3 flex gap-2">
//                   <Button
//                     disabled={!isMine(o.table_id)}
//                     onClick={() => confirm(o)}
//                     className="flex-1"
//                   >
//                     {t("waiter.confirm")}
//                   </Button>
//                   <Button
//                     variant="secondary"
//                     disabled={!isMine(o.table_id)}
//                     onClick={() => reject(o)}
//                   >
//                     {t("waiter.reject")}
//                   </Button>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         </>
//       )}

//       {tab === "ready" && (
//         <>
//           {ready.length === 0 && (
//             <p className="text-slate-600">{t("waiter.noReady")}</p>
//           )}
//           <div className="grid gap-3 sm:grid-cols-2">
//             {ready.map((i) => (
//               <div
//                 key={i.id}
//                 className="flex items-center justify-between gap-3 rounded-2xl border-2 border-free bg-green-50 p-4"
//               >
//                 <div>
//                   <div className="font-bold">
//                     {t("waiter.table")} {i.table_number}
//                   </div>
//                   <div>
//                     {i.quantity} × {pick(i, "dish_name", lang)}
//                   </div>
//                 </div>
//                 <Button disabled={!isMine(i.table_id)} onClick={() => serve(i)}>
//                   {t("waiter.serve")}
//                 </Button>
//               </div>
//             ))}
//           </div>
//         </>
//       )}

//       {selected && (
//         <TableModal
//           table={selected}
//           tables={tables}
//           user={user}
//           version={version}
//           onClose={() => setSelectedId(null)}
//           onChanged={() => setVersion((v) => v + 1)}
//         />
//       )}
//     </Layout>
//   );
// }



import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import TableModal from "../components/TableModal.jsx";
import { Tabs } from "../components/Tabs.jsx";
import { Alert, Button } from "../components/ui.jsx";
import { api } from "../lib/api";
import { errorText } from "../lib/errors";
import { staffSocket } from "../lib/socket";
import { pick } from "../lib/format";
import { beep } from "../lib/beep";

const BORDER = {
  free: "border-free",
  ordering: "border-ordering",
  waiting_food: "border-waiting",
  eating: "border-eating",
  paying: "border-paying",
};

const TABLE_STYLES = {
  free: {
    dot: "bg-emerald-500",
    background: "bg-emerald-50/70",
  },
  ordering: {
    dot: "bg-blue-500",
    background: "bg-blue-50/70",
  },
  waiting_food: {
    dot: "bg-amber-500",
    background: "bg-amber-50/70",
  },
  eating: {
    dot: "bg-indigo-500",
    background: "bg-indigo-50/70",
  },
  paying: {
    dot: "bg-rose-500",
    background: "bg-rose-50/70",
  },
};

export default function Waiter() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();

  const [tables, setTables] = useState([]);
  const [pending, setPending] = useState([]);
  const [ready, setReady] = useState([]);
  const [tab, setTab] = useState("tables");
  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");

  // Load floor tables, pending orders and kitchen-ready items.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api("/tables"),
      api("/orders/pending"),
      api("/kitchen/orders"),
    ])
      .then(([tb, pd, kitchen]) => {
        if (cancelled) return;

        setTables(tb);
        setPending(pd);

        setReady(
          kitchen.flatMap((o) =>
            o.items
              .filter((i) => i.status === "ready")
              .map((i) => ({
                ...i,
                table_id: o.table_id,
                table_number: o.table_number,
              })),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setError(t("common.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [version, t]);

  // Real-time staff notifications.
  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));
    const bump = () => setVersion((v) => v + 1);

    [
      "connect",
      "order:confirmed",
      "order:rejected",
      "order:moved",
      "item:updated",
      "table:updated",
    ].forEach((event) => socket.on(event, bump));

    socket.on("order:pending", () => {
      beep();
      bump();
    });

    socket.on("item:ready", () => {
      beep();
      bump();
    });

    return () => socket.disconnect();
  }, []);

  // Check waiter assignment permissions.
  const isMine = (tableId) => {
    const table = tables.find((x) => x.id === tableId);

    return (
      Boolean(table) &&
      (user?.role === "manager" || table.assigned_waiter_id === user?.id)
    );
  };

  async function act(fn) {
    setError("");

    try {
      await fn();
    } catch (e) {
      setError(errorText(t, "waiter", e));
    }

    setVersion((v) => v + 1);
  }

  const confirm = (order) =>
    act(() =>
      api(`/orders/${order.id}/confirm`, {
        method: "POST",
      }),
    );

  const reject = (order) =>
    act(() =>
      api(`/orders/${order.id}/reject`, {
        method: "POST",
        body: {},
      }),
    );

  const serve = (item) =>
    act(() =>
      api(`/items/${item.id}/status`, {
        method: "PATCH",
        body: { status: "served" },
      }),
    );

  // Group tables by restaurant area.
  const areas = useMemo(() => {
    const map = new Map();

    tables.forEach((table) => {
      const area = table.area || "Other";

      if (!map.has(area)) map.set(area, []);
      map.get(area).push(table);
    });

    return [...map.entries()];
  }, [tables]);

  const selected = tables.find((x) => x.id === selectedId) || null;

  const myTables = tables.filter((table) => isMine(table.id));
  const myPending = pending.filter((order) => isMine(order.table_id));
  const myReady = ready.filter((item) => isMine(item.table_id));

  const occupiedTables = myTables.filter(
    (table) => table.status !== "free",
  ).length;

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* Dashboard heading */}
        <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Restaurant Operations
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Waiter Dashboard
              </h1>

              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
                Manage your tables, confirm customer orders and serve meals when
                they are ready.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 sm:min-w-40">
              <p className="text-xs font-medium text-slate-400">
                Assigned tables
              </p>
              <div className="mt-1 text-3xl font-bold">{myTables.length}</div>
              <p className="mt-1 text-xs text-slate-400">
                {occupiedTables} currently occupied
              </p>
            </div>
          </div>
        </section>

        {/* Overview cards */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                My tables
              </span>
              <span className="text-lg">▦</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {myTables.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Assigned to you</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Occupied
              </span>
              <span className="text-lg">◉</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {occupiedTables}
            </p>
            <p className="mt-1 text-xs text-slate-500">Active tables</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800">
                Pending orders
              </span>
              <span className="text-lg">◷</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-900">
              {myPending.length}
            </p>
            <p className="mt-1 text-xs text-amber-700">Awaiting confirmation</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">
                Ready to serve
              </span>
              <span className="text-lg">✓</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-900">
              {myReady.length}
            </p>
            <p className="mt-1 text-xs text-emerald-700">Waiting in kitchen</p>
          </div>
        </section>

        {/* Main tabs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">
              Service Management
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a section to manage restaurant operations.
            </p>
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: "tables",
                label: t("waiter.tabTables"),
                count: myTables.length,
              },
              {
                id: "pending",
                label: t("waiter.tabPending"),
                count: myPending.length,
              },
              {
                id: "ready",
                label: t("waiter.tabReady"),
                count: myReady.length,
              },
            ]}
          />
        </section>

        {error && <Alert>{error}</Alert>}

        {/* TABLES */}
        {tab === "tables" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Restaurant Floor
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a table to view its details and manage service.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Free
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Waiting
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Paying
                </span>
              </div>
            </div>

            {areas.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <div className="text-3xl">▦</div>
                <p className="mt-3 font-semibold text-slate-800">
                  No tables available
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Restaurant tables will appear here.
                </p>
              </div>
            )}

            {areas.map(([area, list]) => (
              <section key={area} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800">{area}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {list.length} tables
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {list.map((table) => {
                    const mine = isMine(table.id);
                    const style = TABLE_STYLES[table.status] || {
                      dot: "bg-slate-400",
                      background: "bg-slate-50",
                    };

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedId(table.id)}
                        className={`
                          group relative overflow-hidden rounded-2xl border-2
                          ${BORDER[table.status] || "border-slate-200"}
                          ${style.background}
                          p-4 text-left shadow-sm transition-all
                          hover:-translate-y-0.5 hover:shadow-md
                          focus:outline-none focus:ring-2 focus:ring-slate-400
                          ${mine ? "" : "opacity-70"}
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              TABLE
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900">
                              {table.number}
                            </p>
                          </div>

                          <span
                            className={`mt-1 h-3 w-3 rounded-full ${style.dot}`}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">
                            {table.seats} {t("waiter.seats")}
                          </span>
                          {mine ? (
                            <span className="text-xs font-semibold text-emerald-700">
                              Assigned
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">
                              🔒 Assigned
                            </span>
                          )}
                        </div>

                        <div className="mt-3 border-t border-slate-200/70 pt-3">
                          <StatusChip kind="table" status={table.status} />
                        </div>

                        {!mine && table.waiter_name && (
                          <p className="mt-2 truncate text-xs text-slate-500">
                            {table.waiter_name}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* PENDING ORDERS */}
        {tab === "pending" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Incoming Orders
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review customer orders before sending them to the kitchen.
              </p>
            </div>

            {pending.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <div className="text-3xl">✓</div>
                <p className="mt-3 font-semibold text-slate-800">
                  {t("waiter.noPending")}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New customer orders will appear here.
                </p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {pending.map((order) => {
                const mine = isMine(order.table_id);

                return (
                  <article
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          New customer order
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          {t("waiter.table")} {order.table_number}
                        </h3>
                      </div>

                      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                        Awaiting confirmation
                      </span>
                    </div>

                    <div className="space-y-3 p-5">
                      {(order.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.quantity} ×{" "}
                                {pick(item, "dish_name", lang)}
                              </p>

                              {item.modifiers?.length > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.modifiers
                                    .map((modifier) =>
                                      pick(modifier, "name", lang),
                                    )
                                    .join(", ")}
                                </p>
                              )}
                            </div>

                            <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                              Qty: {item.quantity}
                            </span>
                          </div>

                          {item.notes && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                Customer note
                              </p>
                              <p className="mt-1 text-sm text-amber-900">
                                {item.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row">
                      <Button
                        disabled={!mine}
                        onClick={() => confirm(order)}
                        className="flex-1"
                      >
                        {t("waiter.confirm")}
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={!mine}
                        onClick={() => reject(order)}
                        className="sm:min-w-28"
                      >
                        {t("waiter.reject")}
                      </Button>
                    </div>

                    {!mine && (
                      <p className="px-4 pb-3 text-center text-xs text-slate-500">
                        This table is assigned to another waiter.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* READY ITEMS */}
        {tab === "ready" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Kitchen Ready
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Collect prepared dishes and deliver them to the tables.
              </p>
            </div>

            {ready.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <div className="text-3xl">🍽️</div>
                <p className="mt-3 font-semibold text-slate-800">
                  {t("waiter.noReady")}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Kitchen-ready items will appear here.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {ready.map((item) => {
                const mine = isMine(item.table_id);

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                        🍽️
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">
                            {t("waiter.table")} {item.table_number}
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                            Ready
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-700">
                          {item.quantity} × {pick(item, "dish_name", lang)}
                        </p>

                        {item.notes && (
                          <p className="mt-1 text-xs text-slate-500">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      disabled={!mine}
                      onClick={() => serve(item)}
                      className="sm:min-w-28"
                    >
                      {t("waiter.serve")}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* TABLE DETAILS MODAL */}
        {selected && (
          <TableModal
            table={selected}
            tables={tables}
            user={user}
            version={version}
            onClose={() => setSelectedId(null)}
            onChanged={() => setVersion((v) => v + 1)}
          />
        )}
      </div>
    </Layout>
  );
}
