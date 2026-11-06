import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

export { app, db };

export const loginAs = async (username, password) =>
  (await request(app).post('/api/auth/login').send({ username, password })).body.token;

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export const dishId = async (name) => (await db('dishes').where({ name_en: name }).first()).id;
export const customerOrder = (table, items) =>
  request(app).post('/api/public/orders').send({ tableToken: table.token, items });
export const confirm = (token, orderId) =>
  request(app).post(`/api/orders/${orderId}/confirm`).set(auth(token));

/** Order, confirm and move every item to "served". */
export async function servedOrder({ table, waiterToken, kitchenToken, items }) {
  const order = await customerOrder(table, items);
  await confirm(waiterToken, order.body.id);
  const rows = await db('order_items').where({ order_id: order.body.id });
  for (const row of rows) {
    for (const [token, status] of [[kitchenToken, 'cooking'], [kitchenToken, 'ready'], [waiterToken, 'served']]) {
      await request(app).patch(`/api/items/${row.id}/status`).set(auth(token)).send({ status });
    }
  }
  return order.body;
}

/** Clean orders, bills and stock so each test starts from the same state. */
export async function resetState() {
  await db('sms_outbox').del();
  await db('payments').del();
  await db('bill_splits').del();
  await db('stock_movements').whereNotNull('order_item_id').del();
  await db('order_item_modifiers').del();
  await db('order_items').del();
  await db('orders').del();
  await db('bills').del();
  await db('dining_tables').update({ status: 'free', is_closed: false });
  await db('ingredients').update({ stock_qty: 100 });
  await db('dishes').update({ is_available: true, force_unavailable: false });
  await db('settings').where({ key: 'service_charge_pct' }).update({ value: '5' });
}