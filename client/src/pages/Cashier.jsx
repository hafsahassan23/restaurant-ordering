// import { useCallback, useEffect, useRef, useState } from "react";
// import { useTranslation } from "react-i18next";
// import Layout from "../components/Layout.jsx";
// import StatusChip from "../components/StatusChip.jsx";
// import Receipt from "../components/Receipt.jsx";
// import { api } from "../lib/api";
// import { staffSocket } from "../lib/socket";
// import { money, pick } from "../lib/format";
// import { RouteTabs } from "../components/Tabs.jsx";

// const METHODS = ["cash", "evc_plus", "zaad", "edahab"];
// const field = "h-12 w-full rounded-xl border border-line bg-white px-4";

// export default function Cashier() {
//   const { t, i18n } = useTranslation();
//   const lang = i18n.language;
//   const tableRef = useRef(null);
//   const [tables, setTables] = useState([]);
//   const [tableId, setTableId] = useState(null);
//   const [bill, setBill] = useState(null);
//   const [error, setError] = useState("");
//   const [notice, setNotice] = useState("");
//   const [busy, setBusy] = useState(false);
//   const [receipt, setReceipt] = useState(null);
//   // split form
//   const [mode, setMode] = useState("equal");
//   const [people, setPeople] = useState(2);
//   const [assign, setAssign] = useState({});
//   // payment form
//   const [splitId, setSplitId] = useState(null);
//   const [method, setMethod] = useState("cash");
//   const [given, setGiven] = useState("");
//   const [phone, setPhone] = useState("");
//   const [partial, setPartial] = useState("");

//   const fail = (e) =>
//     setError(
//       t(`cashier.err.${e.code}`, { defaultValue: t("cashier.err.generic") }),
//     );

//   const applyBill = useCallback((b) => {
//     setBill(b);
//     setAssign((prev) =>
//       Object.fromEntries(
//         (b ? b.lines : []).map((l) => [l.id, prev[l.id] ?? 0]),
//       ),
//     );
//     setSplitId((prev) =>
//       b && b.splits.some((s) => s.id === prev && s.status !== "paid")
//         ? prev
//         : null,
//     );
//   }, []);

//   const loadTables = useCallback(
//     () =>
//       api("/tables")
//         .then(setTables)
//         .catch(() => {}),
//     [],
//   );
//   const loadBill = useCallback(
//     (id) =>
//       api(`/bills/table/${id}`)
//         .then(applyBill)
//         .catch(() => applyBill(null)),
//     [applyBill],
//   );

//   useEffect(() => {
//     const socket = staffSocket(localStorage.getItem("token"));
//     const refresh = () => {
//       loadTables();
//       if (tableRef.current) loadBill(tableRef.current);
//     };
//     socket.on("connect", refresh);
//     socket.on("table:updated", refresh);
//     socket.on("item:updated", refresh);
//     return () => socket.disconnect();
//   }, [loadTables, loadBill]);

//   function select(id) {
//     tableRef.current = id;
//     setTableId(id);
//     setError("");
//     setNotice("");
//     loadBill(id);
//   }

//   async function run(fn) {
//     setBusy(true);
//     setError("");
//     try {
//       await fn();
//     } catch (e) {
//       fail(e);
//     } finally {
//       setBusy(false);
//     }
//   }

//   const openBill = () =>
//     run(async () => {
//       applyBill(await api(`/bills/table/${tableId}`, { method: "POST" }));
//       loadTables();
//     });

//   const createSplit = () =>
//     run(async () => {
//       const body =
//         mode === "equal"
//           ? { mode: "equal", people: Number(people) }
//           : {
//               mode: "items",
//               groups: Array.from({ length: Number(people) }, (_, p) =>
//                 bill.lines
//                   .filter((l) => (assign[l.id] ?? 0) === p)
//                   .map((l) => l.id),
//               ).filter((g) => g.length > 0),
//             };
//       applyBill(
//         await api(`/bills/${bill.id}/splits`, { method: "POST", body }),
//       );
//     });

//   const target =
//     bill && bill.splits.length > 0
//       ? bill.splits.find((s) => s.id === splitId)
//       : null;
//   const due = bill
//     ? target
//       ? target.amount
//       : partial
//         ? Number(partial)
//         : bill.remaining
//     : 0;
//   const change =
//     method === "cash" && given !== ""
//       ? Math.round((Number(given) - due) * 100) / 100
//       : null;
//   const needsSplit = bill && bill.splits.length > 0 && !target;
//   const canPay =
//     bill &&
//     !busy &&
//     !needsSplit &&
//     due > 0 &&
//     (method === "cash"
//       ? given !== "" && Number(given) + 0.005 >= due
//       : phone.trim().length >= 7);

//   const pay = () =>
//     run(async () => {
//       const body = { method };
//       if (target) body.splitId = target.id;
//       else if (partial) body.amount = Number(partial);
//       if (method === "cash") body.amountGiven = Number(given);
//       else body.phone = phone.trim();

//       const res = await api(`/bills/${bill.id}/payments`, {
//         method: "POST",
//         body,
//       });
//       setGiven("");
//       setPartial("");
//       if (res.closed) {
//         setReceipt(res.bill);
//         applyBill(null);
//         tableRef.current = null;
//         setTableId(null);
//       } else {
//         applyBill(res.bill);
//         setNotice(`${t("cashier.success")} · ${money(res.payment.amount)}`);
//       }
//       loadTables();
//     });

//   const active = tables.filter((x) => x.status !== "free");

//   return (
//     <Layout>
//       <RouteTabs
//         items={[
//           { to: "/cashier", label: t("cashier.tabBills"), end: true },
//           { to: "/cashier/bills", label: t("cashier.tabHistory") },
//         ]}
//       />
//       {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
//       <div className="grid gap-6 md:grid-cols-3">
//         <section>
//           <h2 className="mb-2 text-xl font-bold">{t("cashier.tables")}</h2>
//           {active.length === 0 && (
//             <p className="text-slate-600">{t("cashier.noTables")}</p>
//           )}
//           <div className="space-y-2">
//             {active.map((tb) => (
//               <button
//                 key={tb.id}
//                 type="button"
//                 onClick={() => select(tb.id)}
//                 className={`flex min-h-14 w-full items-center justify-between rounded-xl border-2 bg-white px-4 py-2 ${
//                   tableId === tb.id ? "border-brand" : "border-line"
//                 }`}
//               >
//                 <span className="text-xl font-bold">
//                   {t("waiter.table")} {tb.number}
//                 </span>
//                 <StatusChip kind="table" status={tb.status} />
//               </button>
//             ))}
//           </div>
//         </section>

//         <section className="md:col-span-2">
//           {error && (
//             <div
//               role="alert"
//               className="mb-3 rounded-xl bg-red-50 p-3 text-red-800"
//             >
//               {error}
//             </div>
//           )}
//           {notice && (
//             <div className="mb-3 rounded-xl bg-green-50 p-3 text-green-900">
//               {notice}
//             </div>
//           )}

//           {tableId && !bill && (
//             <button
//               type="button"
//               disabled={busy}
//               onClick={openBill}
//               className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white"
//             >
//               {t("cashier.openBill")}
//             </button>
//           )}

//           {bill && (
//             <div className="space-y-5">
//               <div className="rounded-2xl border border-line bg-white p-4">
//                 <h2 className="mb-2 text-xl font-bold">
//                   {t("cashier.bill")} · {t("waiter.table")} {bill.table_number}
//                 </h2>
//                 <ul className="divide-y divide-line">
//                   {bill.lines.map((l) => (
//                     <li key={l.id} className="flex justify-between gap-3 py-2">
//                       <div>
//                         <div>
//                           {l.quantity} × {pick(l, "dish_name", lang)}
//                         </div>
//                         {l.modifiers.length > 0 && (
//                           <div className="text-sm text-slate-600">
//                             {l.modifiers
//                               .map((m) => pick(m, "name", lang))
//                               .join(", ")}
//                           </div>
//                         )}
//                       </div>
//                       <div className="font-semibold">{money(l.line_total)}</div>
//                     </li>
//                   ))}
//                 </ul>
//                 <dl className="mt-3 space-y-1">
//                   <div className="flex justify-between">
//                     <dt>{t("cashier.subtotal")}</dt>
//                     <dd>{money(bill.subtotal)}</dd>
//                   </div>
//                   <div className="flex justify-between">
//                     <dt>
//                       {t("cashier.service")} ({bill.service_charge_pct}%)
//                     </dt>
//                     <dd>{money(bill.service_charge)}</dd>
//                   </div>
//                   <div className="flex justify-between text-xl font-bold">
//                     <dt>{t("cashier.total")}</dt>
//                     <dd>{money(bill.total)}</dd>
//                   </div>
//                   <div className="flex justify-between">
//                     <dt>{t("cashier.paid")}</dt>
//                     <dd>{money(bill.paid)}</dd>
//                   </div>
//                   <div className="flex justify-between font-bold text-paying">
//                     <dt>{t("cashier.remaining")}</dt>
//                     <dd>{money(bill.remaining)}</dd>
//                   </div>
//                 </dl>
//               </div>

//               {bill.payments.length === 0 && (
//                 <div className="rounded-2xl border border-line bg-white p-4">
//                   <h3 className="mb-2 text-lg font-bold">
//                     {t("cashier.splitTitle")}
//                   </h3>
//                   <div className="mb-3 flex gap-2">
//                     {["equal", "items"].map((m) => (
//                       <button
//                         key={m}
//                         type="button"
//                         onClick={() => setMode(m)}
//                         aria-pressed={mode === m}
//                         className={`h-12 flex-1 rounded-xl font-semibold ${mode === m ? "bg-brand text-white" : "border border-line"}`}
//                       >
//                         {m === "equal"
//                           ? t("cashier.equal")
//                           : t("cashier.byItem")}
//                       </button>
//                     ))}
//                   </div>
//                   <label className="block font-medium">
//                     {t("cashier.people")}
//                     <input
//                       type="number"
//                       min="2"
//                       max="20"
//                       value={people}
//                       onChange={(e) => setPeople(e.target.value)}
//                       className={`${field} mt-1`}
//                     />
//                   </label>
//                   {mode === "items" && (
//                     <ul className="mt-3 space-y-2">
//                       {bill.lines.map((l) => (
//                         <li
//                           key={l.id}
//                           className="flex items-center justify-between gap-2"
//                         >
//                           <span>
//                             {l.quantity} × {pick(l, "dish_name", lang)}
//                           </span>
//                           <select
//                             value={assign[l.id] ?? 0}
//                             onChange={(e) =>
//                               setAssign((a) => ({
//                                 ...a,
//                                 [l.id]: Number(e.target.value),
//                               }))
//                             }
//                             className="h-11 rounded-xl border border-line px-2"
//                           >
//                             {Array.from(
//                               { length: Number(people) || 2 },
//                               (_, p) => (
//                                 <option key={p} value={p}>
//                                   {t("cashier.person", { n: p + 1 })}
//                                 </option>
//                               ),
//                             )}
//                           </select>
//                         </li>
//                       ))}
//                     </ul>
//                   )}
//                   <button
//                     type="button"
//                     disabled={busy}
//                     onClick={createSplit}
//                     className="mt-3 h-12 w-full rounded-xl bg-slate-800 font-semibold text-white"
//                   >
//                     {t("cashier.createSplit")}
//                   </button>
//                 </div>
//               )}

//               {bill.splits.length > 0 && (
//                 <div className="rounded-2xl border border-line bg-white p-4">
//                   <h3 className="mb-2 text-lg font-bold">
//                     {t("cashier.selectSplit")}
//                   </h3>
//                   <div className="space-y-2">
//                     {bill.splits.map((s, i) => (
//                       <button
//                         key={s.id}
//                         type="button"
//                         disabled={s.status === "paid"}
//                         onClick={() => setSplitId(s.id)}
//                         className={`flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 ${
//                           splitId === s.id ? "border-brand" : "border-line"
//                         } ${s.status === "paid" ? "bg-green-50" : ""}`}
//                       >
//                         <span className="font-semibold">
//                           {t("cashier.person", { n: i + 1 })} ·{" "}
//                           {money(s.amount)}
//                         </span>
//                         <span
//                           className={
//                             s.status === "paid" ? "text-free" : "text-paying"
//                           }
//                         >
//                           {s.status === "paid"
//                             ? t("cashier.splitPaid")
//                             : t("cashier.splitUnpaid")}
//                         </span>
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {bill.remaining > 0 && (
//                 <div className="rounded-2xl border border-line bg-white p-4">
//                   <h3 className="mb-2 text-lg font-bold">
//                     {t("cashier.method")}
//                   </h3>
//                   <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
//                     {METHODS.map((m) => (
//                       <button
//                         key={m}
//                         type="button"
//                         onClick={() => setMethod(m)}
//                         aria-pressed={method === m}
//                         className={`h-12 rounded-xl font-semibold ${method === m ? "bg-brand text-white" : "border border-line"}`}
//                       >
//                         {t(`cashier.${m}`)}
//                       </button>
//                     ))}
//                   </div>

//                   {bill.splits.length === 0 && (
//                     <label className="mb-3 block font-medium">
//                       {t("cashier.partialHint")}
//                       <input
//                         type="number"
//                         min="0"
//                         step="0.01"
//                         value={partial}
//                         onChange={(e) => setPartial(e.target.value)}
//                         className={`${field} mt-1`}
//                       />
//                     </label>
//                   )}

//                   <div className="mb-3 flex justify-between text-lg font-bold">
//                     <span>{t("cashier.amountDue")}</span>
//                     <span>{money(due)}</span>
//                   </div>

//                   {method === "cash" ? (
//                     <>
//                       <label className="block font-medium">
//                         {t("cashier.amountGiven")}
//                         <input
//                           type="number"
//                           min="0"
//                           step="0.01"
//                           inputMode="decimal"
//                           value={given}
//                           onChange={(e) => setGiven(e.target.value)}
//                           className={`${field} mt-1`}
//                         />
//                       </label>
//                       {change !== null && change >= 0 && (
//                         <p className="mt-2 text-xl font-bold text-free">
//                           {t("cashier.change")}: {money(change)}
//                         </p>
//                       )}
//                     </>
//                   ) : (
//                     <label className="block font-medium">
//                       {t("cashier.phone")}
//                       <input
//                         type="tel"
//                         inputMode="numeric"
//                         value={phone}
//                         onChange={(e) => setPhone(e.target.value)}
//                         placeholder="2526XXXXXXXX"
//                         className={`${field} mt-1`}
//                       />
//                     </label>
//                   )}

//                   <button
//                     type="button"
//                     disabled={!canPay}
//                     onClick={pay}
//                     className="mt-4 h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-40"
//                   >
//                     {busy ? t("cashier.paying") : t("cashier.pay")}
//                   </button>
//                 </div>
//               )}
//             </div>
//           )}
//         </section>
//       </div>
//     </Layout>
//   );
// }



import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import Receipt from "../components/Receipt.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { money, pick } from "../lib/format";
import { RouteTabs } from "../components/Tabs.jsx";

const METHODS = ["cash", "evc_plus", "zaad", "edahab"];

import { inputCls } from "../components/ui.jsx";

const panel = "rounded-2xl border border-line bg-white shadow-sm";

export default function Cashier() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const tableRef = useRef(null);

  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [bill, setBill] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Split bill
  const [mode, setMode] = useState("equal");
  const [people, setPeople] = useState(2);
  const [assign, setAssign] = useState({});

  // Payment
  const [splitId, setSplitId] = useState(null);
  const [method, setMethod] = useState("cash");
  const [given, setGiven] = useState("");
  const [phone, setPhone] = useState("");
  const [partial, setPartial] = useState("");

  const fail = (e) =>
    setError(
      t(`cashier.err.${e.code}`, {
        defaultValue: t("cashier.err.generic"),
      }),
    );

  const applyBill = useCallback((b) => {
    setBill(b);

    setAssign((prev) =>
      Object.fromEntries(
        (b ? b.lines : []).map((l) => [l.id, prev[l.id] ?? 0]),
      ),
    );

    setSplitId((prev) =>
      b && b.splits.some((s) => s.id === prev && s.status !== "paid")
        ? prev
        : null,
    );
  }, []);

  const loadTables = useCallback(
    () =>
      api("/tables")
        .then(setTables)
        .catch(() => {}),
    [],
  );

  const loadBill = useCallback(
    (id) =>
      api(`/bills/table/${id}`)
        .then(applyBill)
        .catch(() => applyBill(null)),
    [applyBill],
  );

  useEffect(() => {
    const socket = staffSocket(localStorage.getItem("token"));

    const refresh = () => {
      loadTables();

      if (tableRef.current) {
        loadBill(tableRef.current);
      }
    };

    socket.on("connect", refresh);
    socket.on("table:updated", refresh);
    socket.on("item:updated", refresh);

    return () => socket.disconnect();
  }, [loadTables, loadBill]);

  function select(id) {
    tableRef.current = id;
    setTableId(id);
    setError("");
    setNotice("");
    setGiven("");
    setPartial("");
    setPhone("");
    loadBill(id);
  }

  async function run(fn) {
    setBusy(true);
    setError("");

    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const openBill = () =>
    run(async () => {
      applyBill(
        await api(`/bills/table/${tableId}`, {
          method: "POST",
        }),
      );

      loadTables();
    });

  const createSplit = () =>
    run(async () => {
      const body =
        mode === "equal"
          ? {
              mode: "equal",
              people: Number(people),
            }
          : {
              mode: "items",
              groups: Array.from({ length: Number(people) }, (_, p) =>
                bill.lines
                  .filter((l) => (assign[l.id] ?? 0) === p)
                  .map((l) => l.id),
              ).filter((g) => g.length > 0),
            };

      applyBill(
        await api(`/bills/${bill.id}/splits`, {
          method: "POST",
          body,
        }),
      );
    });

  const target =
    bill && bill.splits.length > 0
      ? bill.splits.find((s) => s.id === splitId)
      : null;

  const due = bill
    ? target
      ? target.amount
      : partial
        ? Number(partial)
        : bill.remaining
    : 0;

  const change =
    method === "cash" && given !== ""
      ? Math.round((Number(given) - due) * 100) / 100
      : null;

  const needsSplit = bill && bill.splits.length > 0 && !target;

  const canPay =
    bill &&
    !busy &&
    !needsSplit &&
    due > 0 &&
    (method === "cash"
      ? given !== "" && Number(given) + 0.005 >= due
      : phone.trim().length >= 7);

  const pay = () =>
    run(async () => {
      const body = { method };

      if (target) {
        body.splitId = target.id;
      } else if (partial) {
        body.amount = Number(partial);
      }

      if (method === "cash") {
        body.amountGiven = Number(given);
      } else {
        body.phone = phone.trim();
      }

      const res = await api(`/bills/${bill.id}/payments`, {
        method: "POST",
        body,
      });

      setGiven("");
      setPartial("");

      if (res.closed) {
        setReceipt(res.bill);
        applyBill(null);
        tableRef.current = null;
        setTableId(null);
      } else {
        applyBill(res.bill);
        setNotice(`${t("cashier.success")} · ${money(res.payment.amount)}`);
      }

      loadTables();
    });

  const active = tables.filter((x) => x.status !== "free");
  const selectedTable = tables.find((x) => x.id === tableId);

  return (
    <Layout>
      <div className="space-y-5">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Restaurant POS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand">
              Cashier & Payments
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage table bills, split payments and receipts.
            </p>
          </div>

          <RouteTabs
            items={[
              {
                to: "/cashier",
                label: t("cashier.tabBills"),
                end: true,
              },
              {
                to: "/cashier/bills",
                label: t("cashier.tabHistory"),
              },
            ]}
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl p-4 text-white">
            <div className="text-xs font-medium text-slate-400">
              Active tables
            </div>
            <div className="mt-2 text-3xl font-bold text-brand">
              {active.length}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Tables currently occupied
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              {t("cashier.remaining")}
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {bill ? money(bill.remaining) : money(0)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {bill ? "Selected bill balance" : "No bill selected"}
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-line bg-white p-4 lg:col-span-1">
            <div className="text-xs font-medium text-slate-500">
              Selected table
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {selectedTable
                ? `${t("waiter.table")} ${selectedTable.number}`
                : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {selectedTable
                ? selectedTable.area
                : "Choose a table to continue"}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            {notice}
          </div>
        )}

        {/* Main workspace */}
        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Tables sidebar */}
          <aside className={`${panel} overflow-hidden`}>
            <div className="border-b border-line bg-surface px-4 py-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-brand">{t("cashier.tables")}</h2>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {active.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Select an occupied table to view its bill.
              </p>
            </div>

            <div className="max-h-[600px] space-y-2 overflow-y-auto p-3">
              {active.length === 0 && (
                <div className="rounded-xl bg-surface px-4 py-8 text-center">
                  <div className="text-3xl">🪑</div>
                  <p className="mt-2 text-sm text-slate-500">
                    {t("cashier.noTables")}
                  </p>
                </div>
              )}

              {active.map((tb) => {
                const selected = tableId === tb.id;

                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => select(tb.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-slate-950 bg-brand text-white shadow-md"
                        : "border-line bg-white hover:border-slate-400 hover:bg-surface"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold">
                        {t("waiter.table")} {tb.number}
                      </div>
                      <div
                        className={`mt-1 truncate text-xs ${
                          selected ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {tb.area} · {tb.seats} {t("waiter.seats")}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <StatusChip kind="table" status={tb.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Bill workspace */}
          <main className="min-w-0 space-y-5">
            {!tableId && (
              <div
                className={`${panel} flex min-h-[350px] flex-col items-center justify-center p-8 text-center`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                  🧾
                </div>
                <h2 className="mt-4 text-lg font-bold text-brand">
                  Select a table
                </h2>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Choose an occupied table from the left panel to view its bill
                  and process payment.
                </p>
              </div>
            )}

            {tableId && !bill && (
              <div
                className={`${panel} flex flex-col items-center justify-center p-8 text-center`}
              >
                <div className="text-4xl">🧾</div>
                <h2 className="mt-3 text-lg font-bold text-brand">
                  {t("cashier.openBill")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("waiter.table")} {selectedTable?.number}
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={openBill}
                  className="mt-5 h-12 w-full max-w-xs rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  {busy ? "Loading..." : t("cashier.openBill")}
                </button>
              </div>
            )}

            {bill && (
              <>
                {/* Bill details */}
                <section className={panel}>
                  <div className="flex flex-col justify-between gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Current bill
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-brand">
                        {t("cashier.bill")} · {t("waiter.table")}{" "}
                        {bill.table_number}
                      </h2>
                    </div>

                    <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                      {t("cashier.remaining")}: {money(bill.remaining)}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="mb-3 hidden grid-cols-[1fr_auto_auto] gap-4 text-xs font-bold uppercase tracking-wider text-slate-400 sm:grid">
                      <span>Item</span>
                      <span>Qty</span>
                      <span>Total</span>
                    </div>

                    <ul className="divide-y divide-slate-100">
                      {bill.lines.map((l) => (
                        <li
                          key={l.id}
                          className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto]"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800">
                              {pick(l, "dish_name", lang)}
                            </div>

                            {l.modifiers.length > 0 && (
                              <div className="mt-1 text-xs text-slate-500">
                                {l.modifiers
                                  .map((m) => pick(m, "name", lang))
                                  .join(", ")}
                              </div>
                            )}
                          </div>

                          <span className="text-sm text-slate-500">
                            × {l.quantity}
                          </span>

                          <span className="text-right font-bold text-brand">
                            {money(l.line_total)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Bill totals */}
                    <div className="mt-4 rounded-xl bg-surface p-4">
                      <dl className="space-y-3 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <dt>{t("cashier.subtotal")}</dt>
                          <dd>{money(bill.subtotal)}</dd>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <dt>
                            {t("cashier.service")} ({bill.service_charge_pct}%)
                          </dt>
                          <dd>{money(bill.service_charge)}</dd>
                        </div>

                        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold text-slate-950">
                          <dt>{t("cashier.total")}</dt>
                          <dd>{money(bill.total)}</dd>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <dt>{t("cashier.paid")}</dt>
                          <dd>{money(bill.paid)}</dd>
                        </div>

                        <div className="flex justify-between font-bold text-amber-700">
                          <dt>{t("cashier.remaining")}</dt>
                          <dd>{money(bill.remaining)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>

                {/* Split bill */}
                {bill.payments.length === 0 && (
                  <section className={`${panel} p-4`}>
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Bill management
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-brand">
                        {t("cashier.splitTitle")}
                      </h3>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2">
                      {["equal", "items"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          aria-pressed={mode === m}
                          className={`h-12 rounded-xl text-sm font-semibold transition ${
                            mode === m
                              ? "bg-brand text-white"
                              : "border border-line bg-white text-slate-600 hover:bg-surface"
                          }`}
                        >
                          {m === "equal"
                            ? t("cashier.equal")
                            : t("cashier.byItem")}
                        </button>
                      ))}
                    </div>

                    <label className="block text-sm font-semibold text-slate-700">
                      {t("cashier.people")}
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={people}
                        onChange={(e) => setPeople(e.target.value)}
                        className={`${inputCls} mt-2`}
                      />
                    </label>

                    {mode === "items" && (
                      <ul className="mt-4 space-y-2">
                        {bill.lines.map((l) => (
                          <li
                            key={l.id}
                            className="flex flex-col justify-between gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center"
                          >
                            <span className="text-sm font-medium text-slate-700">
                              {l.quantity} × {pick(l, "dish_name", lang)}
                            </span>

                            <select
                              value={assign[l.id] ?? 0}
                              onChange={(e) =>
                                setAssign((a) => ({
                                  ...a,
                                  [l.id]: Number(e.target.value),
                                }))
                              }
                              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
                            >
                              {Array.from(
                                { length: Number(people) || 2 },
                                (_, p) => (
                                  <option key={p} value={p}>
                                    {t("cashier.person", { n: p + 1 })}
                                  </option>
                                ),
                              )}
                            </select>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={createSplit}
                      className="mt-4 h-12 w-full rounded-xl bg-slate-800 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                    >
                      {t("cashier.createSplit")}
                    </button>
                  </section>
                )}

                {/* Split selection */}
                {bill.splits.length > 0 && (
                  <section className={`${panel} p-4`}>
                    <h3 className="mb-4 text-lg font-bold text-brand">
                      {t("cashier.selectSplit")}
                    </h3>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {bill.splits.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={s.status === "paid"}
                          onClick={() => setSplitId(s.id)}
                          className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                            splitId === s.id
                              ? "border-slate-950 bg-surface ring-1 ring-slate-950"
                              : "border-line hover:border-slate-400"
                          } ${
                            s.status === "paid"
                              ? "cursor-not-allowed bg-green-50 opacity-70"
                              : ""
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-800">
                              {t("cashier.person", { n: i + 1 })}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {money(s.amount)}
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              s.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {s.status === "paid"
                              ? t("cashier.splitPaid")
                              : t("cashier.splitUnpaid")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Payment panel */}
                {bill.remaining > 0 && (
                  <section className={`${panel} overflow-hidden`}>
                    <div className="bg-brand p-4 text-white">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Checkout
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {t("cashier.method")}
                      </h3>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-slate-300">
                          {t("cashier.amountDue")}
                        </span>
                        <span className="text-2xl font-bold">{money(due)}</span>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {METHODS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMethod(m)}
                            aria-pressed={method === m}
                            className={`flex min-h-14 items-center justify-center rounded-xl border px-2 text-sm font-bold transition ${
                              method === m
                                ? "border-slate-950 bg-brand text-white shadow-sm"
                                : "border-line bg-white text-slate-600 hover:border-slate-400"
                            }`}
                          >
                            {t(`cashier.${m}`)}
                          </button>
                        ))}
                      </div>

                      {bill.splits.length === 0 && (
                        <label className="block text-sm font-semibold text-slate-700">
                          {t("cashier.partialHint")}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={partial}
                            onChange={(e) => setPartial(e.target.value)}
                            className={`${inputCls} mt-2`}
                          />
                        </label>
                      )}

                      {method === "cash" ? (
                        <div className="space-y-3">
                          <label className="block text-sm font-semibold text-slate-700">
                            {t("cashier.amountGiven")}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={given}
                              onChange={(e) => setGiven(e.target.value)}
                              className={`${inputCls} mt-2`}
                              placeholder="0.00"
                            />
                          </label>

                          {change !== null && change >= 0 && (
                            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4">
                              <span className="text-sm font-semibold text-green-800">
                                {t("cashier.change")}
                              </span>
                              <span className="text-xl font-bold text-green-700">
                                {money(change)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className="block text-sm font-semibold text-slate-700">
                          {t("cashier.phone")}
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="2526XXXXXXXX"
                            className={`${inputCls} mt-2`}
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        disabled={!canPay}
                        onClick={pay}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? t("cashier.paying") : t("cashier.pay")}
                      </button>

                      <p className="text-center text-xs text-slate-400">
                        Payment processing · Receipt generated after successful
                        checkout
                      </p>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  );
}
