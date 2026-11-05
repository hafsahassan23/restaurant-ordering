const db = require('../db');

exports.insertOrder = (row, trx = db) => trx('orders').insert(row).then(([id]) => id);
exports.insertItem = (row, trx = db) => trx('order_items').insert(row).then(([id]) => id);
exports.insertItemModifiers = (rows, trx = db) => (rows.length ? trx('order_item_modifiers').insert(rows) : Promise.resolve());

exports.lockOrder = (id, trx) => trx('orders').where({ id }).forUpdate().first();
exports.lockItem = (id, trx) => trx('order_items').where({ id }).forUpdate().first();
exports.itemsForOrder = (orderId, trx = db) => trx('order_items').where({ order_id: orderId }).orderBy('id');
exports.updateOrder = (id, patch, trx = db) => trx('orders').where({ id }).update(patch);
exports.updateItem = (id, patch, trx = db) => trx('order_items').where({ id }).update(patch);
exports.cancelItemsOfOrder = (orderId, reason, trx) =>
  trx('order_items').where({ order_id: orderId }).update({ status: 'cancelled', cancel_reason: reason });

/** One order with its table number, items and each item's modifiers. */
exports.loadOrderView = async (orderId, trx = db) => {
  const order = await trx('orders')
    .join('dining_tables', 'orders.table_id', 'dining_tables.id')
    .where('orders.id', orderId)
    .select('orders.*', 'dining_tables.number as table_number')
    .first();
  if (!order) return null;
  const items = await trx('order_items').where({ order_id: orderId }).orderBy('id');
  const mods = items.length
    ? await trx('order_item_modifiers').whereIn('order_item_id', items.map((i) => i.id))
    : [];
  order.items = items.map(({ recipe_snapshot, ...item }) => ({
    ...item,
    modifiers: mods.filter((m) => m.order_item_id === item.id),
  }));
  return order;
};

exports.pendingIds = () => db('orders').where({ status: 'pending_confirmation' }).orderBy('id').pluck('id');
exports.tableOrderIds = (tableId) =>
  db('orders').where({ table_id: tableId }).whereNot({ status: 'closed' }).orderBy('id').pluck('id');

/** Confirmed orders that still have items to cook or serve, oldest first. */
exports.kitchenIds = async () => {
  const rows = await db('orders')
    .join('order_items', 'order_items.order_id', 'orders.id')
    .where('orders.status', 'confirmed')
    .whereIn('order_items.status', ['ordered', 'cooking', 'ready'])
    .distinct('orders.id', 'orders.confirmed_at')
    .orderBy('orders.confirmed_at');
  return rows.map((r) => r.id);
};

/** Counts used to decide a table's status. */
exports.tableActivity = async (tableId, trx = db) => {
  const pending = await trx('orders')
    .where({ table_id: tableId, status: 'pending_confirmation' })
    .count({ c: 'id' })
    .first();
  const rows = await trx('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .where('orders.table_id', tableId)
    .whereNot('orders.status', 'closed')
    .select('order_items.status')
    .count({ c: 'order_items.id' })
    .groupBy('order_items.status');
  const n = (s) => Number((rows.find((r) => r.status === s) || {}).c || 0);
  return {
    pending: Number(pending.c),
    active: n('ordered') + n('cooking') + n('ready'),
    served: n('served'),
  };
};