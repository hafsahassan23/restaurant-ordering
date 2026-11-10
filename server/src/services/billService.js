const db = require('../db');
const AppError = require('../utils/AppError');
const billRepository = require('../repositories/billRepository');
const tableRepository = require('../repositories/tableRepository');
const gateway = require('../adapters/payments');
const { METHODS, MOBILE_METHODS, validatePhone, validateCard, maskPhone } = require('../utils/paymentValidation');
const smsGateway = require('../adapters/smsGateway');
const auditService = require('./auditService');
const realtime = require('../realtime');

const EPS = 0.005;
const round2 = (n) => Math.round(n * 100) / 100;

/** A waiter may only bill tables assigned to them; cashier and manager can bill any table. */
function assertCanBill(user, table) {
  if (user.role === 'waiter' && table.assigned_waiter_id !== user.id) {
    throw new AppError(403, 'This table belongs to another waiter', 'NOT_YOUR_TABLE');
  }
}

async function emitTable(tableId) {
  const t = await tableRepository.findById(tableId);
  realtime.emit('waiters', 'table:updated', { id: t.id, number: t.number, status: t.status });
}

/** Everything the cashier screen and the receipt need about one bill. */
exports.getBillView = async (billId) => {
  const bill = await billRepository.findBill(billId);
  if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
  const table = await tableRepository.findById(bill.table_id);
  const items = await billRepository.itemsOfBill(billId);
  const mods = await billRepository.modifiersOfItems(items.map((i) => i.id));
  const splits = (await billRepository.splitsOf(billId)).map((s) => ({ ...s, amount: Number(s.amount) }));
  const all = (await billRepository.paymentsOf(billId)).map((p) => ({
    id: p.id, split_id: p.split_id, method: p.method, status: p.status, reference: p.reference,
    payer_masked: p.payer_masked, failure_reason: p.failure_reason, cashier_name: p.cashier_name,
    created_at: p.created_at, completed_at: p.completed_at,
    amount: Number(p.amount),
    amount_given: p.amount_given == null ? null : Number(p.amount_given),
    change_given: p.change_given == null ? null : Number(p.change_given),
  }));
  // Only successful payments count and appear on the receipt; a pending QR payment is shown separately
  const payments = all.filter((p) => p.status === 'SUCCESS');
  const pendingRow = all.find((p) => p.status === 'PENDING');
  const pending = pendingRow
    ? {
        ...pendingRow,
        payload: qrPayload({ reference: pendingRow.reference, billId, orderIds: await billRepository.orderIdsOfBill(billId), amount: pendingRow.amount }),
      }
    : null;
  const failed = all.filter((p) => p.status === 'FAILED').slice(-5);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const total = Number(bill.total);

  return {
    id: bill.id, table_id: bill.table_id, table_number: table.number, status: bill.status,
    restaurant_name: (await billRepository.getSetting('restaurant_name')) || 'Som Restaurant RTO',
        restaurant_city: (await billRepository.getSetting('restaurant_city')) || '',
    created_at: bill.created_at, updated_at: bill.updated_at,
    subtotal: Number(bill.subtotal), service_charge_pct: Number(bill.service_charge_pct),
    service_charge: Number(bill.service_charge), total,
    lines: items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: round2(Number(i.unit_price) * i.quantity),
      modifiers: mods.filter((m) => m.order_item_id === i.id),
    })),
    splits, payments, pending_payment: pending, failed_payments: failed,
    paid, remaining: round2(Math.max(0, total - paid)),
  };
};

exports.openBillForTable = async (tableId) => {
  const bill = await billRepository.openBillForTable(tableId);
  return bill ? exports.getBillView(bill.id) : null;
};

/**
 * Create the bill of a table (or return the open one).
 * Rules: no pending orders, every item served, cancelled items excluded.
 */
exports.createBill = async (tableId, user, ip) => {
  const { billId, created } = await db.transaction(async (trx) => {
    // Lock the table row: two quick "create bill" clicks run one after the other, so only one bill is made
    const table = await tableRepository.lockById(tableId, trx);
    if (!table) throw new AppError(404, 'Table not found', 'TABLE_NOT_FOUND');
    assertCanBill(user, table);

    const existing = await billRepository.openBillForTable(tableId, trx);
    if (existing) return { billId: existing.id, created: false };

    if ((await billRepository.pendingCount(tableId, trx)) > 0) {
      throw new AppError(409, 'Confirm or reject the pending orders first', 'PENDING_ORDERS');
    }
    const items = await billRepository.billableItems(tableId, trx);
    if (items.length === 0) throw new AppError(409, 'Nothing to bill', 'NOTHING_TO_BILL');
    if (items.some((i) => i.status !== 'served')) {
      throw new AppError(409, 'Some items are not served yet', 'ITEMS_NOT_SERVED');
    }

    const pct = Number(await billRepository.getSetting('service_charge_pct', trx)) || 0;
    const subtotal = round2(items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0));
    const service = round2((subtotal * pct) / 100);
    const id = await billRepository.insertBill({
      table_id: tableId, subtotal, service_charge_pct: pct, service_charge: service,
      total: round2(subtotal + service), status: 'open',
    }, trx);
    await billRepository.attachOrdersToBill(tableId, id, trx);
    await tableRepository.setStatus(tableId, 'paying', trx);
    return { billId: id, created: true };
  });

  if (created) {
    await auditService.log({ userId: user.id, action: 'BILL_CREATED', entity: 'bill', entityId: billId, ip });
    await emitTable(tableId);
  }
  return { bill: await exports.getBillView(billId), created };
};

/**
 * Split a bill: "equal" (number of people) or "items" (groups of item ids, one group per person).
 * The amounts always add up to the bill total (rounding cents go to the last person).
 */
exports.createSplits = async (billId, body, user, ip) => {
  await db.transaction(async (trx) => {
    const bill = await billRepository.lockBill(billId, trx);
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
    if (bill.status !== 'open') throw new AppError(409, 'Bill is already paid', 'BILL_CLOSED');
    assertCanBill(user, await tableRepository.findById(bill.table_id, trx));
    if ((await billRepository.paidTotal(billId, trx)) > 0) {
      throw new AppError(409, 'Payments already started, the split cannot change', 'PAYMENTS_STARTED');
    }
    if (await billRepository.pendingOf(billId, trx)) {
      throw new AppError(409, 'Finish or cancel the QR payment first', 'PAYMENT_PENDING');
    }

    const total = Number(bill.total);
    let amounts;
    if (body.mode === 'equal') {
      const n = body.people;
      const base = Math.floor(Math.round(total * 100) / n) / 100;
      amounts = Array(n).fill(base);
      amounts[n - 1] = round2(total - base * (n - 1));
    } else {
      const items = await billRepository.itemsOfBill(billId, trx);
      const byId = new Map(items.map((i) => [i.id, i]));
      const used = new Set();
      const sums = body.groups.map((group) => {
        let sum = 0;
        for (const id of group) {
          if (!byId.has(id) || used.has(id)) throw new AppError(400, 'Invalid item in the split', 'SPLIT_INVALID');
          used.add(id);
          sum += Number(byId.get(id).unit_price) * byId.get(id).quantity;
        }
        return sum;
      });
      if (used.size !== items.length) {
        throw new AppError(400, 'Every item must be given to someone', 'SPLIT_INCOMPLETE');
      }
      const factor = 1 + Number(bill.service_charge_pct) / 100;
      amounts = sums.map((s) => round2(s * factor));
      const last = amounts.length - 1;
      amounts[last] = round2(amounts[last] + (total - amounts.reduce((a, b) => a + b, 0)));
    }

    await billRepository.replaceSplits(
      billId,
      amounts.map((amount, i) => ({ label: `Person ${i + 1}`, amount, status: 'unpaid' })),
      trx
    );
  });
  await auditService.log({ userId: user.id, action: 'BILL_SPLIT', entity: 'bill', entityId: billId, details: { mode: body.mode }, ip });
  return exports.getBillView(billId);
};

/** Message per validation code (the client shows its own translated text for each code). */
const PAYMENT_ERRORS = {
  PHONE_REQUIRED: 'Enter the phone number',
  PHONE_FORMAT: 'Enter a 9-digit Somali mobile number, e.g. 61 901 1723',
  PHONE_PROVIDER: 'This number does not belong to the chosen payment method',
  PHONE_FAKE: 'This number is not valid',
  CARD_NAME: 'Enter the cardholder name',
  CARD_NUMBER: 'The card number is not valid',
  CARD_EXPIRY: 'Enter the expiry date as MM/YY',
  CARD_EXPIRED: 'This card has expired',
  CARD_CVV: 'The CVV must be 3 or 4 digits',
};

/** Which split / amount this payment is for. Throws when the choice is not allowed. */
function chooseAmount(bill, splits, body, paidBefore) {
  const remaining = round2(Number(bill.total) - paidBefore);
  if (splits.length > 0) {
    if (!body.splitId) throw new AppError(400, 'Choose which split to pay', 'SPLIT_REQUIRED');
    const split = splits.find((s) => s.id === body.splitId);
    if (!split) throw new AppError(404, 'Split not found', 'NOT_FOUND');
    if (split.status === 'paid') throw new AppError(409, 'This split is already paid', 'SPLIT_PAID');
    return { split, amount: Number(split.amount) };
  }
  const amount = body.amount != null ? round2(body.amount) : remaining;
  if (amount <= 0 || amount > remaining + EPS) throw new AppError(400, 'Invalid amount', 'INVALID_AMOUNT');
  return { split: null, amount };
}

/** After a SUCCESS payment: mark the split paid; when everything is paid, close the bill and free the table. */
async function settle(bill, split, amount, splits, paidBefore, trx) {
  if (split) await billRepository.markSplitPaid(split.id, trx);
  const unpaidSplits = splits.filter((s) => s.status !== 'paid' && (!split || s.id !== split.id));
  if (round2(paidBefore + amount) + EPS >= Number(bill.total) && unpaidSplits.length === 0) {
    await billRepository.updateBill(bill.id, { status: 'paid' }, trx);
    await billRepository.closeBillOrders(bill.id, trx);
    await tableRepository.setStatus(bill.table_id, 'free', trx);
    return true;
  }
  return false;
}

const publicPayment = (p) => ({
  id: p.id, method: p.method, amount: Number(p.amount), reference: p.reference, status: p.status,
  payer_masked: p.payer_masked, failure_reason: p.failure_reason,
});

/** Data encoded in the demo QR code: a unique payment reference, the bill, its orders and the amount. */
const qrPayload = ({ reference, billId, orderIds, amount }) =>
  `SOMRTO-DEMO;ref=${reference};bill=${billId};orders=${orderIds.join(',')};amount=${Number(amount).toFixed(2)};cur=USD`;

/** Validate the payer details before anything is written. Output: what the gateway needs + a masked label. */
function checkDetails(body) {
  if (body.method === 'cash') throw new AppError(400, 'Cash payments are not accepted', 'CASH_NOT_ALLOWED');
  if (!METHODS.includes(body.method)) throw new AppError(400, 'Unknown payment method', 'METHOD_NOT_ALLOWED');
  if (body.method === 'qr') throw new AppError(400, 'Start a QR payment instead', 'USE_QR_FLOW');
  if (MOBILE_METHODS.includes(body.method)) {
    const v = validatePhone(body.method, body.phone);
    if (!v.ok) {
      throw new AppError(400, PAYMENT_ERRORS[v.code], v.code, { field: 'phone', suggestion: v.suggestion, expected: v.expected });
    }
    return { kind: 'mobile', national: v.national, international: v.international, masked: maskPhone(v.national) };
  }
  const v = validateCard(body.card);
  if (!v.ok) throw new AppError(400, PAYMENT_ERRORS[v.code], v.code, { field: v.field });
  return { kind: 'card', number: String(body.card.number).replace(/[\s-]/g, ''), brand: v.brand, last4: v.last4, masked: v.masked };
}

/**
 * Pay a bill, or one split of it, with demo mobile money (EVC Plus, eDahab, ZAAD, WAAFI) or a demo card.
 * Rules: details are validated first (invalid -> 400, nothing is written); a declined demo charge is
 * recorded as FAILED (402) and never counts; only SUCCESS payments count towards the bill.
 * The same idempotencyKey sent twice returns the first result instead of paying twice.
 * When everything is paid the bill is closed (PAID), its orders are closed and the table becomes Free.
 */
exports.pay = async (billId, body, user, ip) => {
  const details = checkDetails(body);

  const outcome = await db.transaction(async (trx) => {
    // Lock the bill first: two clicks on the same bill run one after the other
    const bill = await billRepository.lockBill(billId, trx);
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
    if (body.idempotencyKey) {
      const previous = await billRepository.paymentByKey(body.idempotencyKey, trx);
      if (previous) {
        if (previous.bill_id !== billId) throw new AppError(409, 'Duplicate payment key', 'DUPLICATE_KEY');
        return { duplicate: true, payment: publicPayment(previous), tableId: null };
      }
    }
    if (bill.status !== 'open') throw new AppError(409, 'Bill is already paid', 'BILL_CLOSED');
    if (await billRepository.pendingOf(billId, trx)) {
      throw new AppError(409, 'Finish or cancel the QR payment first', 'PAYMENT_PENDING');
    }

    const paidBefore = await billRepository.paidTotal(billId, trx);
    const splits = await billRepository.splitsOf(billId, trx);
    const { split, amount } = chooseAmount(bill, splits, body, paidBefore);

    const charge = details.kind === 'mobile'
      ? await gateway.chargeMobile({ method: body.method, phone: details.national, amount })
      : await gateway.chargeCard({ number: details.number, brand: details.brand, last4: details.last4, amount });

    const row = {
      bill_id: billId, split_id: split ? split.id : null, method: body.method, amount,
      reference: charge.reference, cashier_id: user.id, payer_masked: details.masked,
      idempotency_key: body.idempotencyKey || null,
      status: charge.ok ? 'SUCCESS' : 'FAILED', failure_reason: charge.ok ? null : charge.reason,
      completed_at: db.fn.now(),
    };
    const id = await billRepository.insertPayment(row, trx);
    const closed = charge.ok ? await settle(bill, split, amount, splits, paidBefore, trx) : false;
    return { payment: publicPayment({ ...row, id }), closed, tableId: bill.table_id };
  });

  const { payment } = outcome;
  if (!outcome.duplicate) {
    await auditService.log({
      userId: user.id, action: payment.status === 'SUCCESS' ? 'PAYMENT' : 'PAYMENT_FAILED', entity: 'bill', entityId: billId,
      details: { method: payment.method, amount: payment.amount, reference: payment.reference, payer: payment.payer_masked, closed: outcome.closed }, ip,
    });
  }
  if (payment.status === 'FAILED') {
    throw new AppError(402, payment.failure_reason || 'Payment declined (demo)', 'PAYMENT_DECLINED', { reference: payment.reference });
  }

  const view = await exports.getBillView(billId);
  if (!outcome.duplicate && details.kind === 'mobile') {
    const a = `$${payment.amount.toFixed(2)}`;
    await smsGateway.send({
      to: details.international,
      message: `[DEMO] ${view.restaurant_name}: waxaad bixisay ${a} (Miiska ${view.table_number}), Ref ${payment.reference}. / You paid ${a} (Table ${view.table_number}), Ref ${payment.reference}.`,
    });
  }
  if (outcome.tableId) await emitTable(outcome.tableId);
  return { payment, closed: view.status === 'paid', duplicate: !!outcome.duplicate, bill: view };
};

/**
 * Start a demo QR payment: a PENDING payment with a unique reference and a QR payload
 * (reference, bill, order IDs, amount). Showing the QR never pays anything by itself.
 */
exports.startQr = async (billId, body, user, ip) => {
  const payment = await db.transaction(async (trx) => {
    const bill = await billRepository.lockBill(billId, trx);
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
    if (body.idempotencyKey) {
      const previous = await billRepository.paymentByKey(body.idempotencyKey, trx);
      if (previous) return previous;
    }
    if (bill.status !== 'open') throw new AppError(409, 'Bill is already paid', 'BILL_CLOSED');
    if (await billRepository.pendingOf(billId, trx)) {
      throw new AppError(409, 'Finish or cancel the QR payment first', 'PAYMENT_PENDING');
    }
    const paidBefore = await billRepository.paidTotal(billId, trx);
    const splits = await billRepository.splitsOf(billId, trx);
    const { split, amount } = chooseAmount(bill, splits, body, paidBefore);
    const row = {
      bill_id: billId, split_id: split ? split.id : null, method: 'qr', amount, status: 'PENDING',
      reference: gateway.newReference('qr'), cashier_id: user.id, idempotency_key: body.idempotencyKey || null,
    };
    const id = await billRepository.insertPayment(row, trx);
    return { ...row, id };
  });
  await auditService.log({
    userId: user.id, action: 'PAYMENT_QR_STARTED', entity: 'bill', entityId: billId,
    details: { reference: payment.reference, amount: Number(payment.amount) }, ip,
  });
  return exports.getBillView(billId);
};

/**
 * Finish a demo QR payment: outcome "success" (customer paid) or "failed" (customer cancelled / failed).
 * Only a PENDING QR payment can be finished, and only once.
 */
exports.finishQr = async (reference, outcome, user, ip) => {
  const result = await db.transaction(async (trx) => {
    const p = await billRepository.lockPaymentByReference(reference, trx);
    if (!p || p.method !== 'qr') throw new AppError(404, 'Payment not found', 'NOT_FOUND');
    if (p.status !== 'PENDING') throw new AppError(409, 'This payment is already finished', 'PAYMENT_DONE');
    const bill = await billRepository.lockBill(p.bill_id, trx);

    if (outcome === 'failed') {
      await billRepository.updatePayment(p.id, { status: 'FAILED', failure_reason: 'Customer payment failed (demo)', completed_at: db.fn.now() }, trx);
      return { billId: bill.id, tableId: bill.table_id, status: 'FAILED', amount: Number(p.amount) };
    }
    const paidBefore = await billRepository.paidTotal(bill.id, trx);
    const splits = await billRepository.splitsOf(bill.id, trx);
    const split = p.split_id ? splits.find((s) => s.id === p.split_id) : null;
    if (bill.status !== 'open' || (split && split.status === 'paid') || Number(p.amount) > round2(Number(bill.total) - paidBefore) + EPS) {
      await billRepository.updatePayment(p.id, { status: 'FAILED', failure_reason: 'Bill changed before payment', completed_at: db.fn.now() }, trx);
      return { billId: bill.id, tableId: bill.table_id, status: 'FAILED', amount: Number(p.amount), changed: true };
    }
    await billRepository.updatePayment(p.id, { status: 'SUCCESS', payer_masked: 'QR', completed_at: db.fn.now() }, trx);
    await settle(bill, split, Number(p.amount), splits, paidBefore, trx);
    return { billId: bill.id, tableId: bill.table_id, status: 'SUCCESS', amount: Number(p.amount) };
  });

  await auditService.log({
    userId: user.id, action: result.status === 'SUCCESS' ? 'PAYMENT' : 'PAYMENT_FAILED', entity: 'bill', entityId: result.billId,
    details: { method: 'qr', amount: result.amount, reference }, ip,
  });
  if (result.changed) throw new AppError(409, 'The bill changed, start a new payment', 'BILL_CHANGED');
  const view = await exports.getBillView(result.billId);
  await emitTable(result.tableId);
  return { status: result.status, reference, closed: view.status === 'paid', bill: view };
};

exports.getServiceCharge = async () => Number(await billRepository.getSetting('service_charge_pct')) || 0;

/** Manager sets the service charge percentage used by new bills. */
exports.setServiceCharge = async (pct, user, ip) => {
  await billRepository.setSetting('service_charge_pct', pct);
  await auditService.log({ userId: user.id, action: 'SERVICE_CHARGE_CHANGED', entity: 'setting', details: { pct }, ip });
  return pct;
};

/** Recent bills (open or paid) so receipts can be shown again. */
exports.listBills = async ({ status, limit }) =>
  (await billRepository.list({ status, limit })).map((b) => ({ ...b, total: Number(b.total) }));