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
const field = "h-12 w-full rounded-xl border border-line bg-white px-4";

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
  // split form
  const [mode, setMode] = useState("equal");
  const [people, setPeople] = useState(2);
  const [assign, setAssign] = useState({});
  // payment form
  const [splitId, setSplitId] = useState(null);
  const [method, setMethod] = useState("cash");
  const [given, setGiven] = useState("");
  const [phone, setPhone] = useState("");
  const [partial, setPartial] = useState("");

  const fail = (e) =>
    setError(
      t(`cashier.err.${e.code}`, { defaultValue: t("cashier.err.generic") }),
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
      if (tableRef.current) loadBill(tableRef.current);
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
      applyBill(await api(`/bills/table/${tableId}`, { method: "POST" }));
      loadTables();
    });

  const createSplit = () =>
    run(async () => {
      const body =
        mode === "equal"
          ? { mode: "equal", people: Number(people) }
          : {
              mode: "items",
              groups: Array.from({ length: Number(people) }, (_, p) =>
                bill.lines
                  .filter((l) => (assign[l.id] ?? 0) === p)
                  .map((l) => l.id),
              ).filter((g) => g.length > 0),
            };
      applyBill(
        await api(`/bills/${bill.id}/splits`, { method: "POST", body }),
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
      if (target) body.splitId = target.id;
      else if (partial) body.amount = Number(partial);
      if (method === "cash") body.amountGiven = Number(given);
      else body.phone = phone.trim();

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

  return (
    <Layout>
      <RouteTabs
        items={[
          { to: "/cashier", label: t("cashier.tabBills"), end: true },
          { to: "/cashier/bills", label: t("cashier.tabHistory") },
        ]}
      />
      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
      <div className="grid gap-6 md:grid-cols-3">
        <section>
          <h2 className="mb-2 text-xl font-bold">{t("cashier.tables")}</h2>
          {active.length === 0 && (
            <p className="text-slate-600">{t("cashier.noTables")}</p>
          )}
          <div className="space-y-2">
            {active.map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => select(tb.id)}
                className={`flex min-h-14 w-full items-center justify-between rounded-xl border-2 bg-white px-4 py-2 ${
                  tableId === tb.id ? "border-brand" : "border-line"
                }`}
              >
                <span className="text-xl font-bold">
                  {t("waiter.table")} {tb.number}
                </span>
                <StatusChip kind="table" status={tb.status} />
              </button>
            ))}
          </div>
        </section>

        <section className="md:col-span-2">
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-xl bg-red-50 p-3 text-red-800"
            >
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-3 rounded-xl bg-green-50 p-3 text-green-900">
              {notice}
            </div>
          )}

          {tableId && !bill && (
            <button
              type="button"
              disabled={busy}
              onClick={openBill}
              className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white"
            >
              {t("cashier.openBill")}
            </button>
          )}

          {bill && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-line bg-white p-4">
                <h2 className="mb-2 text-xl font-bold">
                  {t("cashier.bill")} · {t("waiter.table")} {bill.table_number}
                </h2>
                <ul className="divide-y divide-line">
                  {bill.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3 py-2">
                      <div>
                        <div>
                          {l.quantity} × {pick(l, "dish_name", lang)}
                        </div>
                        {l.modifiers.length > 0 && (
                          <div className="text-sm text-slate-600">
                            {l.modifiers
                              .map((m) => pick(m, "name", lang))
                              .join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="font-semibold">{money(l.line_total)}</div>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1">
                  <div className="flex justify-between">
                    <dt>{t("cashier.subtotal")}</dt>
                    <dd>{money(bill.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>
                      {t("cashier.service")} ({bill.service_charge_pct}%)
                    </dt>
                    <dd>{money(bill.service_charge)}</dd>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <dt>{t("cashier.total")}</dt>
                    <dd>{money(bill.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t("cashier.paid")}</dt>
                    <dd>{money(bill.paid)}</dd>
                  </div>
                  <div className="flex justify-between font-bold text-paying">
                    <dt>{t("cashier.remaining")}</dt>
                    <dd>{money(bill.remaining)}</dd>
                  </div>
                </dl>
              </div>

              {bill.payments.length === 0 && (
                <div className="rounded-2xl border border-line bg-white p-4">
                  <h3 className="mb-2 text-lg font-bold">
                    {t("cashier.splitTitle")}
                  </h3>
                  <div className="mb-3 flex gap-2">
                    {["equal", "items"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                        className={`h-12 flex-1 rounded-xl font-semibold ${mode === m ? "bg-brand text-white" : "border border-line"}`}
                      >
                        {m === "equal"
                          ? t("cashier.equal")
                          : t("cashier.byItem")}
                      </button>
                    ))}
                  </div>
                  <label className="block font-medium">
                    {t("cashier.people")}
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={people}
                      onChange={(e) => setPeople(e.target.value)}
                      className={`${field} mt-1`}
                    />
                  </label>
                  {mode === "items" && (
                    <ul className="mt-3 space-y-2">
                      {bill.lines.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
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
                            className="h-11 rounded-xl border border-line px-2"
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
                    className="mt-3 h-12 w-full rounded-xl bg-slate-800 font-semibold text-white"
                  >
                    {t("cashier.createSplit")}
                  </button>
                </div>
              )}

              {bill.splits.length > 0 && (
                <div className="rounded-2xl border border-line bg-white p-4">
                  <h3 className="mb-2 text-lg font-bold">
                    {t("cashier.selectSplit")}
                  </h3>
                  <div className="space-y-2">
                    {bill.splits.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.status === "paid"}
                        onClick={() => setSplitId(s.id)}
                        className={`flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 ${
                          splitId === s.id ? "border-brand" : "border-line"
                        } ${s.status === "paid" ? "bg-green-50" : ""}`}
                      >
                        <span className="font-semibold">
                          {t("cashier.person", { n: i + 1 })} ·{" "}
                          {money(s.amount)}
                        </span>
                        <span
                          className={
                            s.status === "paid" ? "text-free" : "text-paying"
                          }
                        >
                          {s.status === "paid"
                            ? t("cashier.splitPaid")
                            : t("cashier.splitUnpaid")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bill.remaining > 0 && (
                <div className="rounded-2xl border border-line bg-white p-4">
                  <h3 className="mb-2 text-lg font-bold">
                    {t("cashier.method")}
                  </h3>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        aria-pressed={method === m}
                        className={`h-12 rounded-xl font-semibold ${method === m ? "bg-brand text-white" : "border border-line"}`}
                      >
                        {t(`cashier.${m}`)}
                      </button>
                    ))}
                  </div>

                  {bill.splits.length === 0 && (
                    <label className="mb-3 block font-medium">
                      {t("cashier.partialHint")}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={partial}
                        onChange={(e) => setPartial(e.target.value)}
                        className={`${field} mt-1`}
                      />
                    </label>
                  )}

                  <div className="mb-3 flex justify-between text-lg font-bold">
                    <span>{t("cashier.amountDue")}</span>
                    <span>{money(due)}</span>
                  </div>

                  {method === "cash" ? (
                    <>
                      <label className="block font-medium">
                        {t("cashier.amountGiven")}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={given}
                          onChange={(e) => setGiven(e.target.value)}
                          className={`${field} mt-1`}
                        />
                      </label>
                      {change !== null && change >= 0 && (
                        <p className="mt-2 text-xl font-bold text-free">
                          {t("cashier.change")}: {money(change)}
                        </p>
                      )}
                    </>
                  ) : (
                    <label className="block font-medium">
                      {t("cashier.phone")}
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="2526XXXXXXXX"
                        className={`${field} mt-1`}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={!canPay}
                    onClick={pay}
                    className="mt-4 h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? t("cashier.paying") : t("cashier.pay")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
