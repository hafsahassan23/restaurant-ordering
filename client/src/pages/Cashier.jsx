import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, Smartphone, Receipt as ReceiptIcon, Users, Split, CheckCircle2, Armchair, Coins } from "lucide-react";
import Layout from "../components/Layout.jsx";
import StatusChip from "../components/StatusChip.jsx";
import Receipt from "../components/Receipt.jsx";
import { Alert, Button, Card, EmptyState, Field, PageHeader, inputCls, selectCls } from "../components/ui.jsx";
import { api } from "../lib/api";
import { staffSocket } from "../lib/socket";
import { money, pick } from "../lib/format";

const METHODS = [
  ["cash", Banknote],
  ["evc_plus", Smartphone],
  ["zaad", Smartphone],
  ["edahab", Smartphone],
];

/** Quick amounts a customer typically hands over: exact, then the next round notes. */
const quickCash = (due) => {
  const options = new Set([Math.round(due * 100) / 100]);
  [5, 10, 20, 50, 100].forEach((step) => {
    const v = Math.ceil(due / step) * step;
    if (v > due) options.add(v);
  });
  return [...options].slice(0, 4);
};

/** Cashier: pick an active table, create the bill, split it, take cash or mobile money, print the receipt. */
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

  const fail = (e) => setError(t(`cashier.err.${e.code}`, { defaultValue: t("cashier.err.generic") }));

  const applyBill = useCallback((b) => {
    setBill(b);
    setAssign((prev) => Object.fromEntries((b ? b.lines : []).map((l) => [l.id, prev[l.id] ?? 0])));
    setSplitId((prev) => (b && b.splits.some((s) => s.id === prev && s.status !== "paid") ? prev : null));
  }, []);

  const loadTables = useCallback(() => api("/tables").then(setTables).catch(() => {}), []);
  const loadBill = useCallback((id) => api(`/bills/table/${id}`).then(applyBill).catch(() => applyBill(null)), [applyBill]);

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
                bill.lines.filter((l) => (assign[l.id] ?? 0) === p).map((l) => l.id),
              ).filter((g) => g.length > 0),
            };
      applyBill(await api(`/bills/${bill.id}/splits`, { method: "POST", body }));
    });

  const target = bill && bill.splits.length > 0 ? bill.splits.find((s) => s.id === splitId) : null;
  const due = bill ? (target ? target.amount : partial ? Number(partial) : bill.remaining) : 0;
  const change = method === "cash" && given !== "" ? Math.round((Number(given) - due) * 100) / 100 : null;
  const needsSplit = bill && bill.splits.length > 0 && !target;
  const canPay =
    bill && !busy && !needsSplit && due > 0 && (method === "cash" ? given !== "" && Number(given) + 0.005 >= due : phone.trim().length >= 7);

  const pay = () =>
    run(async () => {
      const body = { method };
      if (target) body.splitId = target.id;
      else if (partial) body.amount = Number(partial);
      if (method === "cash") body.amountGiven = Number(given);
      else body.phone = phone.trim();

      const res = await api(`/bills/${bill.id}/payments`, { method: "POST", body });
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
      <PageHeader eyebrow={t("cashier.posLabel")} title={t("cashier.pageTitle")} subtitle={t("cashier.pageDesc")} />

      {error && <Alert onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Active tables */}
        <Card className="overflow-hidden p-0 lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">{t("cashier.tables")}</h2>
            <span className="tabular rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <EmptyState icon={Armchair} title={t("cashier.noTables")} className="py-10" />
          ) : (
            <div className="scroll-thin flex gap-2 overflow-x-auto p-2 lg:max-h-[calc(100vh-14rem)] lg:flex-col lg:overflow-y-auto">
              {active.map((tb) => {
                const selected = tableId === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => select(tb.id)}
                    aria-pressed={selected}
                    className={`flex min-w-44 shrink-0 items-center gap-3 rounded-lg border p-2.5 text-left transition lg:min-w-0 ${
                      selected ? "border-brand bg-brand-50 ring-1 ring-brand" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className={`grid h-10 min-w-10 place-items-center rounded-lg text-sm font-bold ${selected ? "bg-brand text-white" : "bg-slate-100 text-ink"}`}>
                      {tb.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-muted">{tb.area}</div>
                      <StatusChip kind="table" status={tb.status} className="mt-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Workspace */}
        <div className="min-w-0">
          {!tableId && (
            <Card>
              <EmptyState icon={ReceiptIcon} title={t("cashier.selectTitle")} text={t("cashier.selectLong")} className="py-20" />
            </Card>
          )}

          {tableId && !bill && (
            <Card>
              <EmptyState icon={ReceiptIcon} title={t("cashier.openBill")} text={`${t("waiter.table")} ${selectedTable?.number ?? ""}`} className="py-16">
                <Button size="lg" loading={busy} onClick={openBill}>
                  {t("cashier.openBill")}
                </Button>
              </EmptyState>
            </Card>
          )}

          {bill && (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* Bill */}
              <div className="space-y-4">
                <Card className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("cashier.currentBill")} · #{bill.id}</p>
                      <h2 className="text-lg font-bold">
                        {t("waiter.table")} {bill.table_number}
                      </h2>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                      {t("cashier.remaining")}: <span className="tabular">{money(bill.remaining)}</span>
                    </span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("cashier.item")}</th>
                        <th className="w-16 text-center">{t("cashier.qty")}</th>
                        <th className="text-right">{t("cashier.total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <div className="font-medium">{pick(l, "dish_name", lang)}</div>
                            {l.modifiers.length > 0 && <div className="text-xs text-muted">{l.modifiers.map((m) => pick(m, "name", lang)).join(", ")}</div>}
                          </td>
                          <td className="text-center text-muted">{l.quantity}</td>
                          <td className="text-right font-semibold">{money(l.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <dl className="space-y-2 border-t border-line bg-slate-50/70 px-5 py-4 text-sm">
                    <div className="flex justify-between text-muted">
                      <dt>{t("cashier.subtotal")}</dt>
                      <dd className="tabular">{money(bill.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-muted">
                      <dt>
                        {t("cashier.service")} ({bill.service_charge_pct}%)
                      </dt>
                      <dd className="tabular">{money(bill.service_charge)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 text-lg font-bold">
                      <dt>{t("cashier.total")}</dt>
                      <dd className="tabular">{money(bill.total)}</dd>
                    </div>
                    {bill.paid > 0 && (
                      <div className="flex justify-between text-green-700">
                        <dt>{t("cashier.paid")}</dt>
                        <dd className="tabular">− {money(bill.paid)}</dd>
                      </div>
                    )}
                  </dl>
                </Card>

                {/* Split */}
                {bill.payments.length === 0 && (
                  <Card>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand">
                        <Split className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-semibold">{t("cashier.splitTitle")}</h3>
                        <p className="text-xs text-muted">{t("cashier.billMgmt")}</p>
                      </div>
                    </div>
                    <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                      {["equal", "items"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          aria-pressed={mode === m}
                          className={`h-9 rounded-md text-sm font-semibold transition ${mode === m ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"}`}
                        >
                          {m === "equal" ? t("cashier.equal") : t("cashier.byItem")}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-32">
                        <Field label={t("cashier.people")}>
                          <input type="number" min="2" max="20" value={people} onChange={(e) => setPeople(e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                      <Button variant="secondary" loading={busy} onClick={createSplit} className="flex-1">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        {t("cashier.createSplit")}
                      </Button>
                    </div>
                    {mode === "items" && (
                      <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                        {bill.lines.map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span className="text-sm">
                              <span className="tabular mr-1 text-muted">{l.quantity}×</span>
                              {pick(l, "dish_name", lang)}
                            </span>
                            <select
                              value={assign[l.id] ?? 0}
                              onChange={(e) => setAssign((a) => ({ ...a, [l.id]: Number(e.target.value) }))}
                              className={`${selectCls} h-9 w-36 text-sm`}
                              aria-label={t("cashier.people")}
                            >
                              {Array.from({ length: Number(people) || 2 }, (_, p) => (
                                <option key={p} value={p}>
                                  {t("cashier.person", { n: p + 1 })}
                                </option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}
              </div>

              {/* Payment */}
              <div className="space-y-4 xl:sticky xl:top-6">
                {bill.splits.length > 0 && (
                  <Card>
                    <h3 className="mb-3 font-semibold">{t("cashier.selectSplit")}</h3>
                    <div className="grid gap-2">
                      {bill.splits.map((s, i) => {
                        const paid = s.status === "paid";
                        const chosen = splitId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={paid}
                            onClick={() => setSplitId(s.id)}
                            aria-pressed={chosen}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                              paid ? "cursor-not-allowed border-green-200 bg-green-50" : chosen ? "border-brand bg-brand-50 ring-1 ring-brand" : "border-line hover:border-slate-300"
                            }`}
                          >
                            <span className="font-medium">{t("cashier.person", { n: i + 1 })}</span>
                            <span className="flex items-center gap-2">
                              <span className="tabular font-semibold">{money(s.amount)}</span>
                              {paid ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                  <CheckCircle2 className="h-4 w-4" /> {t("cashier.splitPaid")}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-amber-700">{t("cashier.splitUnpaid")}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {bill.remaining > 0 && (
                  <Card className="overflow-hidden p-0">
                    <div className="bg-brand-900 px-5 py-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{t("cashier.amountDue")}</p>
                      <p className="tabular mt-1 text-3xl font-bold">{money(due)}</p>
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">{t("cashier.method")}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {METHODS.map(([m, Icon]) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMethod(m)}
                              aria-pressed={method === m}
                              className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition ${
                                method === m ? "border-brand bg-brand-50 text-brand-dark ring-1 ring-brand" : "border-line text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <Icon className="h-4 w-4" aria-hidden="true" />
                              {t(`cashier.${m}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bill.splits.length === 0 && (
                        <Field label={t("cashier.partialHint")}>
                          <input type="number" min="0" step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)} placeholder={money(bill.remaining)} className={inputCls} />
                        </Field>
                      )}

                      {method === "cash" ? (
                        <div className="space-y-3">
                          <Field label={t("cashier.amountGiven")}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={given}
                              onChange={(e) => setGiven(e.target.value)}
                              className={`${inputCls} h-12 text-lg font-semibold`}
                              placeholder="0.00"
                            />
                          </Field>
                          {due > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {quickCash(due).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setGiven(String(v))}
                                  className="tabular inline-flex h-8 items-center gap-1 rounded-md bg-slate-100 px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                                >
                                  <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                                  {money(v)}
                                </button>
                              ))}
                            </div>
                          )}
                          {change !== null && change >= 0 && (
                            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                              <span className="text-sm font-semibold text-green-800">{t("cashier.change")}</span>
                              <span className="tabular text-xl font-bold text-green-700">{money(change)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Field label={t("cashier.phone")} hint={t("cashier.mobileHint")}>
                          <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2526XXXXXXXX" className={inputCls} />
                        </Field>
                      )}

                      {needsSplit && <p className="text-sm font-medium text-amber-700">{t("cashier.selectSplit")}</p>}

                      <Button size="lg" disabled={!canPay} loading={busy} onClick={pay} className="w-full">
                        {busy ? t("cashier.paying") : `${t("cashier.pay")} · ${money(due)}`}
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  );
}
