import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db, loginAs, auth, dishId, servedOrder, resetState } from './helpers.js';

let managerToken, cashierToken, waiter1Token, kitchenToken, table1;

const findDish = (menu, name) => menu.flatMap((c) => c.dishes).find((d) => d.name_en === name);
const getMenu = async () => (await request(app).get('/api/public/menu')).body;
const summary = (token, qs = '') => request(app).get(`/api/reports/summary${qs}`).set(auth(token));

beforeAll(async () => {
  await db.seed.run();
  managerToken = await loginAs('manager', 'Manager@123');
  cashierToken = await loginAs('cashier', 'Cashier@123');
  waiter1Token = await loginAs('waiter1', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  table1 = await db('dining_tables').where({ number: 1 }).first();
});

beforeEach(resetState);

afterAll(async () => {
  await db.destroy();
});

describe('Reports', () => {
  it('sales come from paid bills: total, by dish and by category', async () => {
    await servedOrder({ table: table1, waiterToken: waiter1Token, kitchenToken, items: [{ dishId: await dishId('Fried eggs'), quantity: 2 }] });
    const bill = (await request(app).post(`/api/bills/table/${table1.id}`).set(auth(cashierToken))).body;
    await request(app).post(`/api/bills/${bill.id}/payments`).set(auth(cashierToken)).send({ method: 'cash', amountGiven: 10 });

    const res = await summary(managerToken);
    expect(res.status).toBe(200);
    expect(res.body.totals.sales).toBe(5.25);
    expect(res.body.totals.bills).toBe(1);
    expect(res.body.by_dish[0].name_en).toBe('Fried eggs');
    expect(res.body.by_dish[0].qty).toBe(2);
    expect(res.body.by_dish[0].revenue).toBe(5);
    expect(res.body.by_category[0].name_en).toBe('Breakfast');
    expect(res.body.daily).toHaveLength(1);
  });

  it('food cost % is computed from the recipe and dishes above 40% are flagged', async () => {
    let eggs = (await summary(managerToken)).body.food_cost.find((d) => d.name_en === 'Fried eggs');
    expect(eggs.pct).toBe(18); // (2 x 0.20 + 0.01 x 3.00 + 0.02 x 1.00) / 2.50
    expect(eggs.high).toBe(false);

    const row = await db('ingredients').where({ name_en: 'Eggs' }).first();
    await request(app).post('/api/stock/movements').set(auth(managerToken))
      .send({ ingredientId: row.id, qty: 1, reason: 'delivery', unitCost: 3 }); // eggs became expensive

    eggs = (await summary(managerToken)).body.food_cost.find((d) => d.name_en === 'Fried eggs');
    expect(eggs.high).toBe(true);
    expect(eggs.pct).toBeGreaterThan(40);
  });

  it('only the manager can read reports, and the date range is validated', async () => {
    expect((await summary(waiter1Token)).status).toBe(403);
    const bad = await summary(managerToken, '?from=2026-11-10&to=2026-11-01');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION');
  });
});

describe('Menu administration', () => {
  it('a dish without a recipe cannot be made available', async () => {
    const eggs = await dishId('Fried eggs');
    const original = (await request(app).get(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken))).body;
    try {
      await request(app).put(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken)).send({ items: [] });
      const res = await request(app).patch(`/api/menu-admin/dishes/${eggs}`).set(auth(managerToken)).send({ is_available: true });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('NO_RECIPE');
      expect(findDish(await getMenu(), 'Fried eggs').unavailable_reason).toBe('no_recipe');
    } finally {
      await request(app).put(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken))
        .send({ items: original.map((r) => ({ ingredientId: r.ingredient_id, qty: Number(r.qty_per_portion) })) });
    }
  });

  it('changing a recipe changes availability for new orders', async () => {
    const eggs = await dishId('Fried eggs');
    const original = (await request(app).get(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken))).body;
    const eggRow = await db('ingredients').where({ name_en: 'Eggs' }).first();
    try {
      await request(app).put(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken))
        .send({ items: [{ ingredientId: eggRow.id, qty: 500 }] }); // 100 eggs in stock, 500 needed per portion
      expect(findDish(await getMenu(), 'Fried eggs').available).toBe(false);
    } finally {
      await request(app).put(`/api/menu-admin/dishes/${eggs}/recipe`).set(auth(managerToken))
        .send({ items: original.map((r) => ({ ingredientId: r.ingredient_id, qty: Number(r.qty_per_portion) })) });
    }
    expect(findDish(await getMenu(), 'Fried eggs').available).toBe(true);
  });

  it('the manager can force a dish unavailable even with stock; others cannot', async () => {
    const eggs = await dishId('Fried eggs');
    const denied = await request(app).patch(`/api/menu-admin/dishes/${eggs}`).set(auth(waiter1Token)).send({ force_unavailable: true });
    expect(denied.status).toBe(403);

    const res = await request(app).patch(`/api/menu-admin/dishes/${eggs}`).set(auth(managerToken)).send({ force_unavailable: true });
    expect(res.status).toBe(200);
    const dish = findDish(await getMenu(), 'Fried eggs');
    expect(dish.available).toBe(false);
    expect(dish.unavailable_reason).toBe('override');
  });
});