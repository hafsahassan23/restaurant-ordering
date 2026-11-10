import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db, loginAs, auth } from './helpers.js';

let managerToken, cashierToken, waiter1Token, waiter2Token, kitchenToken, table1;

const dishId = async (name) => (await db('dishes').where({ name_en: name }).first()).id;
const customerOrder = (table, items) =>
  request(app).post('/api/public/orders').send({ tableToken: table.token, items });
const confirm = (token, orderId) => request(app).post(`/api/orders/${orderId}/confirm`).set(auth(token));
const createBill = (token, tableId) => request(app).post(`/api/bills/table/${tableId}`).set(auth(token));
const pay = (token, billId, body) =>
  request(app).post(`/api/bills/${billId}/payments`).set(auth(token)).send(body);
const tableStatus = async (id) => (await db('dining_tables').where({ id }).first()).status;
const cents = (n) => Math.round(n * 100) / 100;

/** Order, confirm and move every item to "served". */
async function servedOrder(items) {
  const order = await customerOrder(table1, items);
  expect((await confirm(waiter1Token, order.body.id)).status).toBe(200);
  const rows = await db('order_items').where({ order_id: order.body.id });
  for (const row of rows) {
    for (const [token, status] of [[kitchenToken, 'cooking'], [kitchenToken, 'ready'], [waiter1Token, 'served']]) {
      const res = await request(app).patch(`/api/items/${row.id}/status`).set(auth(token)).send({ status });
      expect(res.status).toBe(200);
    }
  }
  return order.body;
}

async function resetState() {
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

beforeAll(async () => {
  await db.seed.run();
  managerToken = await loginAs('manager', 'Manager@123');
  cashierToken = await loginAs('cashier', 'Cashier@123');
  waiter1Token = await loginAs('waiter1', 'Waiter@123');
  waiter2Token = await loginAs('waiter2', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  table1 = await db('dining_tables').where({ number: 1 }).first(); // waiter1
});

beforeEach(resetState);

afterAll(async () => {
  await db.destroy();
});

describe('Bills', () => {
  it('bill = subtotal + service charge, and cancelled items do not appear', async () => {
    const eggs = await dishId('Fried eggs');
    const lemon = await dishId('Lemon juice');
    await servedOrder([{ dishId: eggs, quantity: 2 }]);
    const extra = await customerOrder(table1, [{ dishId: lemon, quantity: 1 }]);
    await confirm(waiter1Token, extra.body.id);
    const lemonItem = await db('order_items').where({ order_id: extra.body.id }).first();
    await request(app).post(`/api/items/${lemonItem.id}/cancel`).set(auth(managerToken)).send({ reason: 'Changed mind' });

    const res = await createBill(cashierToken, table1.id);
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(5);
    expect(res.body.service_charge).toBe(0.25);
    expect(res.body.total).toBe(5.25);
    expect(res.body.lines).toHaveLength(1);
    expect(await tableStatus(table1.id)).toBe('paying');
  });

  it('cannot bill while items are not served', async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    await confirm(waiter1Token, order.body.id);
    const res = await createBill(cashierToken, table1.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ITEMS_NOT_SERVED');
  });

  it('cannot bill while an order is waiting for the waiter', async () => {
    await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const res = await createBill(cashierToken, table1.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PENDING_ORDERS');
  });

  it('a table with an open bill refuses new orders', async () => {
    const eggs = await dishId('Fried eggs');
    await servedOrder([{ dishId: eggs, quantity: 1 }]);
    await createBill(cashierToken, table1.id);
    const res = await customerOrder(table1, [{ dishId: eggs, quantity: 1 }]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TABLE_PAYING');
  });

  it('equal split: the amounts always add up to the total', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 1 }]); // total 2.63
    const bill = (await createBill(cashierToken, table1.id)).body;
    const res = await request(app).post(`/api/bills/${bill.id}/splits`).set(auth(cashierToken))
      .send({ mode: 'equal', people: 3 });
    expect(res.status).toBe(201);
    expect(res.body.splits).toHaveLength(3);
    expect(cents(res.body.splits.reduce((s, x) => s + x.amount, 0))).toBe(res.body.total);
  });

  it('split by item: every item must be assigned, and amounts add up', async () => {
    await servedOrder([
      { dishId: await dishId('Fried eggs'), quantity: 1 },
      { dishId: await dishId('Milk tea'), quantity: 1 },
      { dishId: await dishId('Lemon juice'), quantity: 1 },
    ]);
    const bill = (await createBill(cashierToken, table1.id)).body;
    const [a, b, c] = bill.lines.map((l) => l.id);
    const post = (groups) =>
      request(app).post(`/api/bills/${bill.id}/splits`).set(auth(cashierToken)).send({ mode: 'items', groups });

    const incomplete = await post([[a], [b]]);
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.code).toBe('SPLIT_INCOMPLETE');

    const ok = await post([[a], [b, c]]);
    expect(ok.status).toBe(201);
    expect(cents(ok.body.splits.reduce((s, x) => s + x.amount, 0))).toBe(ok.body.total);
  });
});

describe('Payments', () => {
  it('cash payment returns the change, closes the bill and frees the table', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 2 }]);
    const bill = (await createBill(cashierToken, table1.id)).body; // 5.25
    const res = await pay(cashierToken, bill.id, { method: 'cash', amountGiven: 10 });
    expect(res.status).toBe(201);
    expect(res.body.payment.change).toBe(4.75);
    expect(res.body.closed).toBe(true);
    expect(await tableStatus(table1.id)).toBe('free');
    expect((await db('bills').where({ id: bill.id }).first()).status).toBe('paid');
    const kitchen = await request(app).get('/api/kitchen/orders').set(auth(kitchenToken));
    expect(kitchen.body).toHaveLength(0);
  });

  it('partial payment leaves the remaining amount open on the table', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 2 }]);
    const bill = (await createBill(cashierToken, table1.id)).body; // 5.25
    const part = await pay(cashierToken, bill.id, { method: 'cash', amount: 2, amountGiven: 2 });
    expect(part.body.closed).toBe(false);
    expect(part.body.bill.remaining).toBe(3.25);
    expect(await tableStatus(table1.id)).toBe('paying');

    const rest = await pay(cashierToken, bill.id, { method: 'cash', amountGiven: 3.25 });
    expect(rest.body.closed).toBe(true);
    expect(await tableStatus(table1.id)).toBe('free');
  });

  it('the table stays open while any split is unpaid', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 2 }]);
    const bill = (await createBill(cashierToken, table1.id)).body;
    const split = await request(app).post(`/api/bills/${bill.id}/splits`).set(auth(cashierToken))
      .send({ mode: 'equal', people: 2 });
    const [s1, s2] = split.body.splits;

    const noSplit = await pay(cashierToken, bill.id, { method: 'cash', amountGiven: 10 });
    expect(noSplit.status).toBe(400);
    expect(noSplit.body.code).toBe('SPLIT_REQUIRED');

    const first = await pay(cashierToken, bill.id, { method: 'cash', splitId: s1.id, amountGiven: 5 });
    expect(first.body.closed).toBe(false);
    expect(await tableStatus(table1.id)).toBe('paying');
    const again = await pay(cashierToken, bill.id, { method: 'cash', splitId: s1.id, amountGiven: 5 });
    expect(again.body.code).toBe('SPLIT_PAID');

    const second = await pay(cashierToken, bill.id, { method: 'cash', splitId: s2.id, amountGiven: 5 });
    expect(second.body.closed).toBe(true);
    expect(await tableStatus(table1.id)).toBe('free');
  });

  it('mobile money: a declined number is refused, a good one pays and writes an SMS', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const bill = (await createBill(cashierToken, table1.id)).body;

    const declined = await pay(cashierToken, bill.id, { method: 'evc_plus', phone: '252615550000' });
    expect(declined.status).toBe(402);
    expect(declined.body.code).toBe('PAYMENT_DECLINED');
    expect(await db('payments')).toHaveLength(0);

    const ok = await pay(cashierToken, bill.id, { method: 'evc_plus', phone: '252615550101' });
    expect(ok.status).toBe(201);
    expect(ok.body.payment.reference).toMatch(/^EVC_PLUS-/);
    expect(ok.body.closed).toBe(true);
    const sms = await db('sms_outbox');
    expect(sms).toHaveLength(1);
    expect(sms[0].to_phone).toBe('252615550101');
  });

  it('cash must cover the amount', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 2 }]);
    const bill = (await createBill(cashierToken, table1.id)).body;
    const res = await pay(cashierToken, bill.id, { method: 'cash', amountGiven: 1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_ENOUGH_CASH');
    expect(await db('payments')).toHaveLength(0);
  });
});

describe('Bill permissions and settings', () => {
  it('a waiter cannot pay, and cannot bill another waiter\'s table', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const other = await createBill(waiter2Token, table1.id);
    expect(other.status).toBe(403);
    expect(other.body.code).toBe('NOT_YOUR_TABLE');

    const bill = (await createBill(waiter1Token, table1.id)).body;
    const res = await pay(waiter1Token, bill.id, { method: 'cash', amountGiven: 10 });
    expect(res.status).toBe(403);
  });

  it('the manager sets the service charge and new bills use it', async () => {
    const denied = await request(app).put('/api/bills/service-charge').set(auth(waiter1Token)).send({ pct: 10 });
    expect(denied.status).toBe(403);

    const res = await request(app).put('/api/bills/service-charge').set(auth(managerToken)).send({ pct: 10 });
    expect(res.status).toBe(200);
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 2 }]);
    const bill = (await createBill(cashierToken, table1.id)).body;
    expect(bill.service_charge).toBe(0.5);
    expect(bill.total).toBe(5.5);
  });

  it('two "create bill" clicks at the same time make only one bill', async () => {
    await servedOrder([{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const [a, b] = await Promise.all([createBill(cashierToken, table1.id), createBill(cashierToken, table1.id)]);
    expect(a.body.id).toBe(b.body.id);
    expect(Number((await db('bills').where({ table_id: table1.id }).count({ c: 'id' }).first()).c)).toBe(1);
  });
});
