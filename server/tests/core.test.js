import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db, loginAs, auth } from './helpers.js';

let managerToken, waiter1Token, waiter2Token, kitchenToken, table1, table2;

const dishId = async (name) => (await db('dishes').where({ name_en: name }).first()).id;
const modifierId = async (name) => (await db('modifiers').where({ name_en: name }).first()).id;
const stock = async (name) => Number((await db('ingredients').where({ name_en: name }).first()).stock_qty);
const setStock = (name, qty) => db('ingredients').where({ name_en: name }).update({ stock_qty: qty });
const findDish = (menu, name) => menu.flatMap((c) => c.dishes).find((d) => d.name_en === name);

const getMenu = async () => (await request(app).get('/api/public/menu')).body;
const customerOrder = (table, items) =>
  request(app).post('/api/public/orders').send({ tableToken: table.token, items });
const confirm = (token, orderId) =>
  request(app).post(`/api/orders/${orderId}/confirm`).set(auth(token));

/** Clean orders and refill stock so every test starts from the same state. */
async function resetState() {
  await db('stock_movements').whereNotNull('order_item_id').del();
  await db('order_item_modifiers').del();
  await db('order_items').del();
  await db('orders').del();
  await db('dining_tables').update({ status: 'free', is_closed: false });
  await db('ingredients').update({ stock_qty: 100 });
  await db('dishes').update({ is_available: true, force_unavailable: false });
}

beforeAll(async () => {
  await db.seed.run();
  managerToken = await loginAs('manager', 'Manager@123');
  waiter1Token = await loginAs('waiter1', 'Waiter@123');
  waiter2Token = await loginAs('waiter2', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  table1 = await db('dining_tables').where({ number: 1 }).first(); // waiter1
  table2 = await db('dining_tables').where({ number: 2 }).first(); // waiter1
});

beforeEach(resetState);

afterAll(async () => {
  await db.destroy();
});

describe('Orders and stock deduction', () => {
  it('a customer order waits for the waiter and does not touch stock', async () => {
    const eggs = await dishId('Fried eggs');
    const res = await customerOrder(table1, [{ dishId: eggs, quantity: 2 }]);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending_confirmation');
    expect(await stock('Eggs')).toBe(100);

    const kitchen = await request(app).get('/api/kitchen/orders').set(auth(kitchenToken));
    expect(kitchen.body).toHaveLength(0);
  });

  it('confirming sends the order to the kitchen and selling 10 portions deducts the right amounts', async () => {
    const eggs = await dishId('Fried eggs'); // recipe: 2 eggs, 0.01 L oil, 0.02 kg detail
    const order = await customerOrder(table1, [{ dishId: eggs, quantity: 10 }]);
    const res = await confirm(waiter1Token, order.body.id);
    expect(res.status).toBe(200);

    expect(await stock('Eggs')).toBe(80);
    expect(await stock('Oil')).toBeCloseTo(99.9, 3);
    expect(await stock('detail')).toBeCloseTo(99.8, 3);

    const sales = await db('stock_movements').where({ reason: 'sale' });
    expect(sales).toHaveLength(3);

    const kitchen = await request(app).get('/api/kitchen/orders').set(auth(kitchenToken));
    expect(kitchen.body).toHaveLength(1);
    expect(kitchen.body[0].items[0].status).toBe('ordered');
  });

  it('modifier ingredients are deducted together with the recipe', async () => {
    const dish = await dishId('Rice with meat');
    const res = await request(app).post('/api/orders').set(auth(waiter1Token)).send({
      tableId: table1.id,
      items: [{ dishId: dish, quantity: 2, modifierIds: [await modifierId('Goat'), await modifierId('Extra rice')] }],
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    // rice: (0.25 recipe + 0.15 extra) x 2 portions = 0.8 ; goat meat: 0.2 x 2 = 0.4
    expect(await stock('Rice')).toBeCloseTo(99.2, 3);
    expect(await stock('Goat meat')).toBeCloseTo(99.6, 3);
  });

  it('a dish becomes unavailable when an ingredient runs out and returns after a delivery', async () => {
    await setStock('Eggs', 1); // one portion needs 2 eggs
    let dish = findDish(await getMenu(), 'Fried eggs');
    expect(dish.available).toBe(false);
    expect(dish.unavailable_reason).toBe('out_of_stock');

    const eggsRow = await db('ingredients').where({ name_en: 'Eggs' }).first();
    const delivery = await request(app).post('/api/stock/movements').set(auth(managerToken))
      .send({ ingredientId: eggsRow.id, qty: 24, reason: 'delivery', unitCost: 0.2 });
    expect(delivery.status).toBe(200);

    dish = findDish(await getMenu(), 'Fried eggs');
    expect(dish.available).toBe(true);
  });

  it('an unavailable dish cannot be ordered', async () => {
    await setStock('Eggs', 0);
    const res = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DISH_UNAVAILABLE');
  });

  it('a required modifier group must be chosen', async () => {
    const res = await customerOrder(table1, [{ dishId: await dishId('Rice with meat'), quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MODIFIER_REQUIRED');
  });

  it('two waiters confirming at the same time: only one gets the last portion', async () => {
    const eggs = await dishId('Fried eggs');
    const a = await customerOrder(table1, [{ dishId: eggs, quantity: 1 }]);
    const b = await customerOrder(table2, [{ dishId: eggs, quantity: 1 }]);
    await setStock('Eggs', 2); // exactly one portion left

    const results = await Promise.all([
      confirm(waiter1Token, a.body.id),
      confirm(waiter1Token, b.body.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stock('Eggs')).toBe(0);
  });

  it('if one ingredient is short at confirmation, nothing is deducted and the order stays pending', async () => {
    const eggs = await dishId('Fried eggs');
    const rice = await dishId('Rice with meat');
    const order = await customerOrder(table1, [
      { dishId: eggs, quantity: 1 },
      { dishId: rice, quantity: 1, modifierIds: [await modifierId('Goat')] },
    ]);
    await setStock('Goat meat', 0.1); // not enough for 0.2

    const res = await confirm(waiter1Token, order.body.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await stock('Eggs')).toBe(100);
    const row = await db('orders').where({ id: order.body.id }).first();
    expect(row.status).toBe('pending_confirmation');
  });
});

describe('Roles, tables and item status', () => {
  it('item status only moves forward, one step, by the right role', async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    await confirm(waiter1Token, order.body.id);
    const itemId = (await db('order_items').first()).id;
    const patch = (token, status) =>
      request(app).patch(`/api/items/${itemId}/status`).set(auth(token)).send({ status });

    expect((await patch(kitchenToken, 'ready')).status).toBe(409);   // cannot skip "cooking"
    expect((await patch(kitchenToken, 'cooking')).status).toBe(200);
    expect((await patch(kitchenToken, 'cooking')).status).toBe(409); // cannot repeat
    expect((await patch(kitchenToken, 'ready')).status).toBe(200);
    expect((await patch(kitchenToken, 'served')).status).toBe(403);  // only a waiter serves
    expect((await patch(waiter1Token, 'served')).status).toBe(200);

    const table = await db('dining_tables').where({ id: table1.id }).first();
    expect(table.status).toBe('eating');
  });

  it("a waiter cannot confirm orders of another waiter's table", async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const res = await confirm(waiter2Token, order.body.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_YOUR_TABLE');
  });

  it('cancelling a cooking item keeps the stock deducted and marks it as waste', async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    await confirm(waiter1Token, order.body.id);
    const itemId = (await db('order_items').first()).id;
    await request(app).patch(`/api/items/${itemId}/status`).set(auth(kitchenToken)).send({ status: 'cooking' });

    const res = await request(app).post(`/api/items/${itemId}/cancel`).set(auth(managerToken))
      .send({ reason: 'Customer left' });
    expect(res.status).toBe(200);

    const item = await db('order_items').where({ id: itemId }).first();
    expect(item.status).toBe('cancelled');
    expect(item.is_waste).toBeTruthy();
    expect(await stock('Eggs')).toBe(98);
    const movements = await db('stock_movements').where({ order_item_id: itemId });
    expect(movements.every((m) => m.reason === 'waste')).toBe(true);
  });

  it('cancelling before cooking gives the stock back', async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    await confirm(waiter1Token, order.body.id);
    const itemId = (await db('order_items').first()).id;

    await request(app).post(`/api/items/${itemId}/cancel`).set(auth(managerToken)).send({ reason: 'Wrong order' });
    expect(await stock('Eggs')).toBe(100);
    const back = await db('stock_movements').where({ reason: 'adjustment' });
    expect(back).toHaveLength(3);
  });

  it('a closed table refuses customer orders', async () => {
    await db('dining_tables').where({ id: table1.id }).update({ is_closed: true });
    const res = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TABLE_CLOSED');
  });

  it('a fake table token is rejected', async () => {
    const res = await request(app).post('/api/public/orders').send({
      tableToken: 'x'.repeat(32), items: [{ dishId: await dishId('Fried eggs'), quantity: 1 }],
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVALID_TABLE');
  });

  it('only the manager can record stock movements', async () => {
    const res = await request(app).post('/api/stock/movements').set(auth(waiter1Token))
      .send({ ingredientId: 1, qty: 5, reason: 'delivery' });
    expect(res.status).toBe(403);
  });
});