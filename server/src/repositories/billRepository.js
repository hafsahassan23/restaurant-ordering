const db = require('../db');

exports.findBill = (id, trx = db) => trx('bills').where({ id }).first();
exports.lockBill = (id, trx) => trx('bills').where({ id }).forUpdate().first();
exports.openBillForTable = (tableId, trx = db) => trx('bills').where({ table_id: tableId, status: 'open' }).first();
exports.insertBill = (row, trx) => trx('bills').insert(row).then(([id]) => id);
exports.updateBill = (id, patch, trx = db) => trx('bills').where({ id }).update(patch);

exports.getSetting = async (key, trx = db) => {
  const row = await trx('settings').where({ key }).first();
  return row ? row.value : null;
};
exports.setSetting = (key, value, trx = db) => trx('settings').where({ key }).update({ value: String(value) });

exports.pendingCount = async (tableId, trx = db) => {
  const r = await trx('orders').where({ table_id: tableId, status: 'pending_confirmation' }).count({ c: 'id' }).first();
  return Number(r.c);
};

/** Items still to be billed: confirmed orders of the table that are not on a bill yet, not cancelled. */
exports.billableItems = (tableId, trx = db) =>
  trx('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .where('orders.table_id', tableId)
    .where('orders.status', 'confirmed')
    .whereNull('orders.bill_id')
    .whereNot('order_items.status', 'cancelled')
    .select('order_items.*');

exports.attachOrdersToBill = (tableId, billId, trx) =>
  trx('orders').where({ table_id: tableId, status: 'confirmed' }).whereNull('bill_id').update({ bill_id: billId });
exports.closeBillOrders = (billId, trx) => trx('orders').where({ bill_id: billId }).update({ status: 'closed' });

/** Lines shown on the bill and receipt (cancelled items never appear). */
exports.itemsOfBill = (billId, trx = db) =>
  trx('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .where('orders.bill_id', billId)
    .whereNot('order_items.status', 'cancelled')
    .select('order_items.id', 'order_items.dish_name_so', 'order_items.dish_name_en',
      'order_items.quantity', 'order_items.unit_price', 'order_items.notes')
    .orderBy('order_items.id');
exports.modifiersOfItems = (itemIds, trx = db) =>
  itemIds.length ? trx('order_item_modifiers').whereIn('order_item_id', itemIds) : Promise.resolve([]);

exports.splitsOf = (billId, trx = db) => trx('bill_splits').where({ bill_id: billId }).orderBy('id');
exports.replaceSplits = async (billId, rows, trx) => {
  await trx('bill_splits').where({ bill_id: billId }).del();
  for (const row of rows) await trx('bill_splits').insert({ ...row, bill_id: billId });
};
exports.markSplitPaid = (id, trx) => trx('bill_splits').where({ id }).update({ status: 'paid' });

exports.paymentsOf = (billId, trx = db) =>
  trx('payments')
    .leftJoin('users', 'payments.cashier_id', 'users.id')
    .where('payments.bill_id', billId)
    .select('payments.*', 'users.full_name as cashier_name')
    .orderBy('payments.id');
exports.insertPayment = (row, trx) => trx('payments').insert(row).then(([id]) => id);
exports.updatePayment = (id, patch, trx) => trx('payments').where({ id }).update(patch);
/** Only successful payments count towards the bill. */
exports.paidTotal = async (billId, trx = db) => {
  const r = await trx('payments').where({ bill_id: billId, status: 'SUCCESS' }).sum({ s: 'amount' }).first();
  return Number(r.s || 0);
};
/** The payment started earlier with the same idempotency key (duplicate submission). */
exports.paymentByKey = (key, trx = db) => trx('payments').where({ idempotency_key: key }).first();
/** A QR payment still waiting for the customer blocks other payments on the bill. */
exports.pendingOf = (billId, trx = db) => trx('payments').where({ bill_id: billId, status: 'PENDING' }).first();
exports.lockPaymentByReference = (reference, trx) => trx('payments').where({ reference }).forUpdate().first();
exports.orderIdsOfBill = async (billId, trx = db) =>
  (await trx('orders').where({ bill_id: billId }).select('id').orderBy('id')).map((o) => o.id);
exports.list = ({ status, limit }) => {
  const query = db('bills')
    .join('dining_tables', 'bills.table_id', 'dining_tables.id')
    .select('bills.id', 'bills.status', 'bills.total', 'bills.created_at', 'bills.updated_at',
      'dining_tables.number as table_number')
    .orderBy('bills.id', 'desc')
    .limit(limit);
  if (status) query.where('bills.status', status);
  return query;
};