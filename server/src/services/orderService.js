const db = require('../db');
const AppError = require('../utils/AppError');
const orderRepository = require('../repositories/orderRepository');
const tableRepository = require('../repositories/tableRepository');
const menuService = require('./menuService');
const stockService = require('./stockService');
const auditService = require('./auditService');
const realtime = require('../realtime');

// Item status moves forward one step at a time, and only these roles may do each step
const NEXT = { ordered: 'cooking', cooking: 'ready', ready: 'served' };
const WHO = { cooking: ['kitchen', 'manager'], ready: ['kitchen', 'manager'], served: ['waiter', 'manager'] };
const STAMP = { cooking: 'cooking_at', ready: 'ready_at', served: 'served_at' };

/** A waiter may only edit tables assigned to them; others can only view. */
function assertOwnsTable(user, table) {
  if (user && user.role === 'waiter' && table.assigned_waiter_id !== user.id) {
    throw new AppError(403, 'This table belongs to another waiter', 'NOT_YOUR_TABLE');
  }
}

/** Table status follows what is happening at the table. "paying" is handled by billing. */
async function refreshTableStatus(tableId, trx) {
  const table = await tableRepository.findById(tableId, trx);
  if (table.status === 'paying') return;
  const a = await orderRepository.tableActivity(tableId, trx);
  let status = 'free';
  if (a.pending > 0) status = 'ordering';
  else if (a.active > 0) status = 'waiting_food';
  else if (a.served > 0) status = 'eating';
  if (status !== table.status) await tableRepository.setStatus(tableId, status, trx);
}

async function emitTable(tableId) {
  const t = await tableRepository.findById(tableId);
  realtime.emit('waiters', 'table:updated', { id: t.id, number: t.number, status: t.status });
}

/** Push an order to the right screens (confirmed orders also go to the kitchen). */
async function publishOrder(orderId, event) {
  const view = await orderRepository.loadOrderView(orderId);
  const rooms = event === 'order:confirmed' ? ['kitchen', 'waiters'] : ['waiters'];
  [...rooms, `table:${view.table_id}`].forEach((room) => realtime.emit(room, event, view));
  await emitTable(view.table_id);
  return view;
}

/** Check dishes, availability and modifier rules; compute the unit price. */
function validateItems(rawItems, dishMap) {
  return rawItems.map((raw) => {
    const dish = dishMap.get(raw.dishId);
    if (!dish) throw new AppError(404, 'Dish not found', 'DISH_NOT_FOUND');
    if (!dish.available) throw new AppError(409, `${dish.name_en} is not available now`, 'DISH_UNAVAILABLE');

    const chosen = [];
    for (const group of dish.modifier_groups) {
      const picked = group.modifiers.filter((m) => raw.modifierIds.includes(m.id));
      if (picked.length > group.max_select) {
        throw new AppError(400, `Too many choices in ${group.name_en}`, 'MODIFIER_LIMIT');
      }
      if (group.is_required && picked.length < Math.max(1, group.min_select)) {
        throw new AppError(400, `Please choose: ${group.name_en}`, 'MODIFIER_REQUIRED');
      }
      for (const m of picked) {
        if (!m.available) throw new AppError(409, `${m.name_en} is not available now`, 'MODIFIER_UNAVAILABLE');
        chosen.push(m);
      }
    }
    if (chosen.length !== new Set(raw.modifierIds).size) {
      throw new AppError(400, 'Invalid modifier choice', 'MODIFIER_INVALID');
    }
    const unitPrice = Math.round((dish.price + chosen.reduce((s, m) => s + m.price_delta, 0)) * 100) / 100;
    return { dish, quantity: raw.quantity, notes: raw.notes || null, modifiers: chosen, unitPrice };
  });
}

async function insertOrderWithItems(trx, table, lines, createdBy) {
  const orderId = await orderRepository.insertOrder(
    { table_id: table.id, status: 'pending_confirmation', created_by: createdBy }, trx);
  for (const line of lines) {
    const snapshot = await stockService.buildSnapshot(line.dish.id, line.modifiers.map((m) => m.id));
    const itemId = await orderRepository.insertItem({
      order_id: orderId, dish_id: line.dish.id,
      dish_name_so: line.dish.name_so, dish_name_en: line.dish.name_en,
      quantity: line.quantity, unit_price: line.unitPrice, notes: line.notes,
      status: 'pending', recipe_snapshot: JSON.stringify(snapshot),
    }, trx);
    await orderRepository.insertItemModifiers(line.modifiers.map((m) => ({
      order_item_id: itemId, modifier_id: m.id,
      name_so: m.name_so, name_en: m.name_en, price_delta: m.price_delta,
    })), trx);
  }
  return orderId;
}

/** Confirm an order: deduct stock, send items to the kitchen. Runs inside the caller's transaction. */
async function confirmInTrx(orderId, user, trx) {
  const order = await orderRepository.lockOrder(orderId, trx);
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status !== 'pending_confirmation') {
    throw new AppError(409, 'Order is not waiting for confirmation', 'BAD_STATE');
  }
  assertOwnsTable(user, await tableRepository.findById(order.table_id, trx));

  const items = (await orderRepository.itemsForOrder(orderId, trx)).filter((i) => i.status === 'pending');
  await stockService.deductForItems(items, trx, user.id);
  for (const i of items) await orderRepository.updateItem(i.id, { status: 'ordered' }, trx);
  await orderRepository.updateOrder(orderId,
    { status: 'confirmed', confirmed_by: user.id, confirmed_at: db.fn.now() }, trx);
  await refreshTableStatus(order.table_id, trx);
}

/**
 * Create an order. Customers (user = null) create "pending" orders that wait for the waiter.
 * A waiter entering an order directly uses autoConfirm = true (one atomic transaction).
 */
exports.createOrder = async ({ table, items, user = null, autoConfirm = false, ip = null }) => {
  
  if (table.status === 'paying') throw new AppError(409, 'The bill is being paid', 'TABLE_PAYING');

  if (table.is_closed) throw new AppError(403, 'Please ask a waiter', 'TABLE_CLOSED');
  if (user) assertOwnsTable(user, table);

  const lines = validateItems(items, await menuService.getDishMap());

  const orderId = await db.transaction(async (trx) => {
    const id = await insertOrderWithItems(trx, table, lines, user ? user.id : null);
    if (autoConfirm) await confirmInTrx(id, user, trx);
    else await refreshTableStatus(table.id, trx);
    return id;
  });

  if (user) {
    await auditService.log({ userId: user.id, action: 'ORDER_CREATED', entity: 'order', entityId: orderId, ip });
  }
  const view = await publishOrder(orderId, autoConfirm ? 'order:confirmed' : 'order:pending');
  if (autoConfirm) realtime.emitAll('menu:updated', {});
  return view;
};

/** Waiter confirms a customer order: it reaches the kitchen and stock is deducted. */
exports.confirmOrder = async (orderId, user, ip) => {
  await db.transaction((trx) => confirmInTrx(orderId, user, trx));
  await auditService.log({ userId: user.id, action: 'ORDER_CONFIRMED', entity: 'order', entityId: orderId, ip });
  const view = await publishOrder(orderId, 'order:confirmed');
  realtime.emitAll('menu:updated', {});
  return view;
};

/** Waiter rejects a fake or wrong order. Nothing was deducted yet. */
exports.rejectOrder = async (orderId, reason, user, ip) => {
  await db.transaction(async (trx) => {
    const order = await orderRepository.lockOrder(orderId, trx);
    if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
    if (order.status !== 'pending_confirmation') throw new AppError(409, 'Order already handled', 'BAD_STATE');
    assertOwnsTable(user, await tableRepository.findById(order.table_id, trx));
    await orderRepository.cancelItemsOfOrder(orderId, reason || 'Rejected by waiter', trx);
    await orderRepository.updateOrder(orderId, { status: 'closed' }, trx);
    await refreshTableStatus(order.table_id, trx);
  });
  await auditService.log({ userId: user.id, action: 'ORDER_REJECTED', entity: 'order', entityId: orderId, details: { reason }, ip });
  return publishOrder(orderId, 'order:rejected');
};

/** Kitchen/waiter moves an item one step forward: ordered > cooking > ready > served. */
exports.advanceItem = async (itemId, newStatus, user) => {
  const info = await db.transaction(async (trx) => {
    const item = await orderRepository.lockItem(itemId, trx);
    if (!item) throw new AppError(404, 'Item not found', 'NOT_FOUND');
    if (NEXT[item.status] !== newStatus) {
      throw new AppError(409, 'Status can only move forward, one step at a time', 'BAD_TRANSITION');
    }
    if (!WHO[newStatus].includes(user.role)) {
      throw new AppError(403, 'You do not have permission', 'FORBIDDEN');
    }
    const order = await orderRepository.lockOrder(item.order_id, trx);
    const table = await tableRepository.findById(order.table_id, trx);
    if (newStatus === 'served') assertOwnsTable(user, table);

    await orderRepository.updateItem(itemId, { status: newStatus, [STAMP[newStatus]]: db.fn.now() }, trx);
    await refreshTableStatus(order.table_id, trx);
    return {
      itemId, orderId: order.id, tableId: table.id, tableNumber: table.number, status: newStatus,
      dish_name_so: item.dish_name_so, dish_name_en: item.dish_name_en,
    };
  });

  ['kitchen', 'waiters', `table:${info.tableId}`].forEach((room) => realtime.emit(room, 'item:updated', info));
  if (newStatus === 'ready') realtime.emit('waiters', 'item:ready', info); // "Ready" alert for the waiter
  await emitTable(info.tableId);
  return info;
};

/**
 * Manager cancels an item (reason required). Before cooking: stock is returned.
 * While cooking/ready: ingredients stay deducted and are marked as waste.
 */
exports.cancelItem = async (itemId, reason, user, ip) => {
  const info = await db.transaction(async (trx) => {
    const item = await orderRepository.lockItem(itemId, trx);
    if (!item) throw new AppError(404, 'Item not found', 'NOT_FOUND');
    if (item.status === 'served' || item.status === 'cancelled') {
      throw new AppError(409, 'Item can no longer be cancelled', 'BAD_STATE');
    }
    const restored = item.status === 'ordered';
    const waste = item.status === 'cooking' || item.status === 'ready';
    if (restored) await stockService.restoreForItem(item, trx, user.id);
    if (waste) await stockService.markWaste(item.id, trx);

    await orderRepository.updateItem(itemId, { status: 'cancelled', cancel_reason: reason, is_waste: waste }, trx);
    const order = await orderRepository.lockOrder(item.order_id, trx);
    await refreshTableStatus(order.table_id, trx);
    return { itemId, orderId: order.id, tableId: order.table_id, status: 'cancelled', waste, restored };
  });

  await auditService.log({
    userId: user.id, action: 'ITEM_CANCELLED', entity: 'order_item', entityId: itemId,
    details: { reason, waste: info.waste }, ip,
  });
  ['kitchen', 'waiters', `table:${info.tableId}`].forEach((room) => realtime.emit(room, 'item:updated', info));
  if (info.restored) realtime.emitAll('menu:updated', {});
  await emitTable(info.tableId);
  return info;
};

const views = (ids) => Promise.all(ids.map((id) => orderRepository.loadOrderView(id)));
exports.pendingOrders = async () => views(await orderRepository.pendingIds());
/** Used by the kitchen screen, and to reload everything after a reconnect. */
exports.kitchenOrders = async () => views(await orderRepository.kitchenIds());
exports.ordersForTable = async (tableId) => views(await orderRepository.tableOrderIds(tableId));