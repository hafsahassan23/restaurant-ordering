const db = require('../db');
const AppError = require('../utils/AppError');
const billRepository = require('../repositories/billRepository');
const tableRepository = require('../repositories/tableRepository');
const paymentGateway = require('../adapters/paymentGateway');
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
  const payments = (await billRepository.paymentsOf(billId)).map((p) => ({
    ...p,
    amount: Number(p.amount),
    amount_given: p.amount_given == null ? null : Number(p.amount_given),
    change_given: p.change_given == null ? null : Number(p.change_given),
  }));
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const total = Number(bill.total);

  return {
    id: bill.id, table_id: bill.table_id, table_number: table.number, status: bill.status,
    restaurant_name: (await billRepository.getSetting('restaurant_name')) || 'Som Restaurant RTO',
    created_at: bill.created_at, updated_at: bill.updated_at,
    subtotal: Number(bill.subtotal), service_charge_pct: Number(bill.service_charge_pct),
    service_charge: Number(bill.service_charge), total,
    lines: items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: round2(Number(i.unit_price) * i.quantity),
      modifiers: mods.filter((m) => m.order_item_id === i.id),
    })),
    splits, payments, paid, remaining: round2(Math.max(0, total - paid)),
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
    const table = await tableRepository.findById(tableId, trx);
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

/**
 * Pay a bill, or one split of it. Cash needs the amount given (change is returned);
 * mobile money goes through the payment adapter and writes an SMS to the outbox.
 * Partial payment is allowed on a bill without splits. When everything is paid
 * the bill is closed, its orders are closed and the table becomes Free.
 */
exports.pay = async (billId, body, user, ip) => {
  const outcome = await db.transaction(async (trx) => {
    const bill = await billRepository.lockBill(billId, trx);
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
    if (bill.status !== 'open') throw new AppError(409, 'Bill is already paid', 'BILL_CLOSED');

    const paidBefore = await billRepository.paidTotal(billId, trx);
    const splits = await billRepository.splitsOf(billId, trx);
    const remaining = round2(Number(bill.total) - paidBefore);

    let split = null;
    let amount;
    if (splits.length > 0) {
      if (!body.splitId) throw new AppError(400, 'Choose which split to pay', 'SPLIT_REQUIRED');
      split = splits.find((s) => s.id === body.splitId);
      if (!split) throw new AppError(404, 'Split not found', 'NOT_FOUND');
      if (split.status === 'paid') throw new AppError(409, 'This split is already paid', 'SPLIT_PAID');
      amount = Number(split.amount);
    } else {
      amount = body.amount != null ? round2(body.amount) : remaining;
      if (amount <= 0 || amount > remaining + EPS) throw new AppError(400, 'Invalid amount', 'INVALID_AMOUNT');
    }

    let given = null;
    let change = null;
    let reference = null;
    if (body.method === 'cash') {
      if (body.amountGiven == null) throw new AppError(400, 'Enter the amount given', 'AMOUNT_GIVEN_REQUIRED');
      if (body.amountGiven + EPS < amount) throw new AppError(400, 'The amount given is not enough', 'NOT_ENOUGH_CASH');
      given = round2(body.amountGiven);
      change = round2(given - amount);
    } else {
      if (!body.phone) throw new AppError(400, 'Phone number is required', 'PHONE_REQUIRED');
      // A real provider would be called before the DB write and handled as a pending payment
      const charge = await paymentGateway.charge({ method: body.method, phone: body.phone, amount });
      if (!charge.ok) throw new AppError(402, 'Payment declined', 'PAYMENT_DECLINED');
      reference = charge.reference;
    }

    const paymentId = await billRepository.insertPayment({
      bill_id: billId, split_id: split ? split.id : null, method: body.method, amount,
      amount_given: given, change_given: change, reference, cashier_id: user.id,
    }, trx);
    if (split) await billRepository.markSplitPaid(split.id, trx);

    const paidNow = round2(paidBefore + amount);
    const unpaidSplits = splits.filter((s) => s.status !== 'paid' && (!split || s.id !== split.id));
    let closed = false;
    if (paidNow + EPS >= Number(bill.total) && unpaidSplits.length === 0) {
      await billRepository.updateBill(billId, { status: 'paid' }, trx);
      await billRepository.closeBillOrders(billId, trx);
      await tableRepository.setStatus(bill.table_id, 'free', trx);
      closed = true;
    }
    return {
      tableId: bill.table_id, closed,
      payment: { id: paymentId, method: body.method, amount, amount_given: given, change, reference },
    };
  });

  await auditService.log({
    userId: user.id, action: 'PAYMENT', entity: 'bill', entityId: billId,
    details: { method: body.method, amount: outcome.payment.amount, closed: outcome.closed }, ip,
  });
  const view = await exports.getBillView(billId);
  if (body.method !== 'cash') {
    const a = `$${outcome.payment.amount.toFixed(2)}`;
    await smsGateway.send({
      to: body.phone,
      message: `${view.restaurant_name}: waxaad bixisay ${a} (Miiska ${view.table_number}). Mahadsanid! / You paid ${a} (Table ${view.table_number}). Thank you!`,
    });
  }
  await emitTable(outcome.tableId);
  return { payment: outcome.payment, closed: outcome.closed, bill: view };
};

exports.getServiceCharge = async () => Number(await billRepository.getSetting('service_charge_pct')) || 0;

/** Manager sets the service charge percentage used by new bills. */
exports.setServiceCharge = async (pct, user, ip) => {
  await billRepository.setSetting('service_charge_pct', pct);
  await auditService.log({ userId: user.id, action: 'SERVICE_CHARGE_CHANGED', entity: 'setting', details: { pct }, ip });
  return pct;
};