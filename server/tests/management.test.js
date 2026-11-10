import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db, loginAs, auth, dishId, customerOrder, confirm, servedOrder, resetState } from './helpers.js';

let managerToken, cashierToken, waiter1Token, waiter2Token, kitchenToken, table1, table2, table5;

const call = (method, token, path, body) => {
  const r = request(app)[method](path).set(auth(token));
  return body === undefined ? r : r.send(body);
};
const getMenu = async () => (await request(app).get('/api/public/menu')).body;
const findDish = (menu, name) => menu.flatMap((c) => c.dishes).find((d) => d.name_en === name);
const categoryId = async (name) => (await db('menu_categories').where({ name_en: name }).first()).id;
const eggStock = async () => Number((await db('ingredients').where({ name_en: 'Eggs' }).first()).stock_qty);
const newUser = (over = {}) => ({
  full_name: 'Sagal Cabdi Yusuf',
  username: `u${Date.now()}${Math.floor(Math.random() * 1000)}`,
  password: 'Sagal@2026',
  role: 'waiter',
  ...over,
});

beforeAll(async () => {
  await db.seed.run();
  managerToken = await loginAs('manager', 'Manager@123');
  cashierToken = await loginAs('cashier', 'Cashier@123');
  waiter1Token = await loginAs('waiter1', 'Waiter@123');
  waiter2Token = await loginAs('waiter2', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  table1 = await db('dining_tables').where({ number: 1 }).first(); // waiter1
  table2 = await db('dining_tables').where({ number: 2 }).first(); // waiter1
  table5 = await db('dining_tables').where({ number: 5 }).first(); // waiter2
});

beforeEach(resetState);

afterAll(async () => {
  await db.destroy();
});

describe('Staff accounts', () => {
  it('the manager creates a user who can log in; duplicates and weak passwords are refused', async () => {
    const body = newUser();
    const res = await call('post', managerToken, '/api/users', body);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('waiter');
    expect(res.body.password_hash).toBeUndefined();
    expect(await loginAs(body.username, body.password)).toBeTruthy();

    const dup = await call('post', managerToken, '/api/users', body);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('USERNAME_TAKEN');

    const weak = await call('post', managerToken, '/api/users', newUser({ password: 'abc' }));
    expect(weak.status).toBe(400);
  });

  it('only the manager manages users', async () => {
    expect((await call('get', waiter1Token, '/api/users')).status).toBe(403);
    expect((await call('post', cashierToken, '/api/users', newUser())).status).toBe(403);
  });

  it('a disabled user is locked out at once, and a manager cannot disable themselves', async () => {
    const body = newUser({ role: 'kitchen' });
    const created = (await call('post', managerToken, '/api/users', body)).body;
    const token = await loginAs(body.username, body.password);
    expect((await call('get', token, '/api/auth/me')).status).toBe(200);

    expect((await call('patch', managerToken, `/api/users/${created.id}`, { is_active: false })).status).toBe(200);
    expect((await call('get', token, '/api/auth/me')).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ username: body.username, password: body.password });
    expect(login.status).toBe(401);

    const manager = await db('users').where({ username: 'manager' }).first();
    const self = await call('patch', managerToken, `/api/users/${manager.id}`, { is_active: false });
    expect(self.status).toBe(409);
    expect(self.body.code).toBe('SELF_CHANGE');
  });

  it('resetting a password replaces the old one', async () => {
    const body = newUser();
    const created = (await call('post', managerToken, '/api/users', body)).body;
    const res = await call('post', managerToken, `/api/users/${created.id}/reset-password`, { password: 'Nuur@2027x' });
    expect(res.status).toBe(200);
    const old = await request(app).post('/api/auth/login').send({ username: body.username, password: body.password });
    expect(old.status).toBe(401);
    expect(await loginAs(body.username, 'Nuur@2027x')).toBeTruthy();
  });
});

describe('Tables and QR codes', () => {
  it('creates a table, refuses a duplicate number, and regenerating the QR kills the old one', async () => {
    const res = await call('post', managerToken, '/api/admin/tables', { number: 30, area: 'Terrace', seats: 6 });
    expect(res.status).toBe(201);
    expect(res.body.token).toHaveLength(32);
    const dup = await call('post', managerToken, '/api/admin/tables', { number: 30, area: 'Terrace', seats: 4 });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('TABLE_NUMBER_TAKEN');

    const oldToken = res.body.token;
    expect((await request(app).get(`/api/public/table/${oldToken}`)).status).toBe(200);
    const fresh = await call('post', managerToken, `/api/admin/tables/${res.body.id}/regenerate-qr`);
    expect(fresh.body.token).not.toBe(oldToken);
    expect((await request(app).get(`/api/public/table/${oldToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/public/table/${fresh.body.token}`)).status).toBe(200);
  });

  it('only an active waiter can be assigned, and only the assigned waiter can confirm', async () => {
    const table = (await call('post', managerToken, '/api/admin/tables', { number: 31, area: 'Terrace', seats: 4 })).body;
    const cashier = await db('users').where({ username: 'cashier' }).first();
    const waiter2 = await db('users').where({ username: 'waiter2' }).first();

    const bad = await call('patch', managerToken, `/api/admin/tables/${table.id}`, { assigned_waiter_id: cashier.id });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('NOT_A_WAITER');

    await call('patch', managerToken, `/api/admin/tables/${table.id}`, { assigned_waiter_id: waiter2.id });
    const order = await customerOrder(table, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    expect((await confirm(waiter1Token, order.body.id)).status).toBe(403);
    expect((await confirm(waiter2Token, order.body.id)).status).toBe(200);
  });

  it('a table can be closed; a table with history cannot be deleted, an unused one can', async () => {
    const used = (await call('post', managerToken, '/api/admin/tables', { number: 32, area: 'VIP', seats: 4 })).body;
    await call('patch', managerToken, `/api/admin/tables/${used.id}`, { is_closed: true });
    expect((await request(app).get(`/api/public/table/${used.token}`)).body.is_closed).toBe(true);
    await call('patch', managerToken, `/api/admin/tables/${used.id}`, { is_closed: false });

    await customerOrder(used, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    const blocked = await call('delete', managerToken, `/api/admin/tables/${used.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('TABLE_IN_USE');

    const unused = (await call('post', managerToken, '/api/admin/tables', { number: 33, area: 'VIP', seats: 2 })).body;
    expect((await call('delete', managerToken, `/api/admin/tables/${unused.id}`)).status).toBe(200);
  });
});

describe('Menu management', () => {
  it('categories: names are unique, and only empty categories can be deleted', async () => {
    const body = { name_so: 'Macmacaan', name_en: 'Desserts' };
    const created = await call('post', managerToken, '/api/menu-admin/categories', body);
    expect(created.status).toBe(201);
    const dup = await call('post', managerToken, '/api/menu-admin/categories', body);
    expect(dup.status).toBe(409);

    const breakfast = await categoryId('Breakfast');
    const blocked = await call('delete', managerToken, `/api/menu-admin/categories/${breakfast}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('CATEGORY_NOT_EMPTY');
    expect((await call('delete', managerToken, `/api/menu-admin/categories/${created.body.id}`)).status).toBe(200);
  });

  it('dish rules: price above 0, unique name inside a category, new dishes need a recipe', async () => {
    const breakfast = await categoryId('Breakfast');
    const drinks = await categoryId('Drinks');
    const dish = { category_id: breakfast, name_so: 'Sambuusa', name_en: 'Samosa', price: 1.5, prep_minutes: 8 };

    const zero = await call('post', managerToken, '/api/menu-admin/dishes', { ...dish, price: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.code).toBe('VALIDATION');

    expect((await call('post', managerToken, '/api/menu-admin/dishes', dish)).status).toBe(201);
    const dup = await call('post', managerToken, '/api/menu-admin/dishes', dish);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DISH_NAME_TAKEN');
    expect((await call('post', managerToken, '/api/menu-admin/dishes', { ...dish, category_id: drinks })).status).toBe(201);

    const listed = findDish(await getMenu(), 'Samosa');
    expect(listed.available).toBe(false);
    expect(listed.unavailable_reason).toBe('no_recipe');
  });

  it('a new dish with a recipe and a required modifier sells correctly and deducts modifier ingredients', async () => {
    const eggs = await db('ingredients').where({ name_en: 'Eggs' }).first();
    const dish = (await call('post', managerToken, '/api/menu-admin/dishes', {
      category_id: await categoryId('Main dishes'), name_so: 'Saxan tijaabo', name_en: 'Test plate', price: 4, prep_minutes: 5,
    })).body;
    await call('put', managerToken, `/api/menu-admin/dishes/${dish.id}/recipe`, { items: [{ ingredientId: eggs.id, qty: 1 }] });
    expect((await call('patch', managerToken, `/api/menu-admin/dishes/${dish.id}`, { is_available: true })).status).toBe(200);

    const base = { name_so: 'Cabbir', name_en: 'Size', is_required: true, min_select: 1, max_select: 1 };
    const badGroup = await call('post', managerToken, `/api/menu-admin/dishes/${dish.id}/groups`, { ...base, min_select: 2 });
    expect(badGroup.status).toBe(400);
    const group = (await call('post', managerToken, `/api/menu-admin/dishes/${dish.id}/groups`, base)).body;
    const modifier = (await call('post', managerToken, `/api/menu-admin/groups/${group.id}/modifiers`, {
      name_so: 'Weyn', name_en: 'Large', price_delta: 1.5, ingredients: [{ ingredientId: eggs.id, qty: 1 }],
    })).body;

    const missing = await customerOrder(table1, [{ dishId: dish.id, quantity: 1 }]);
    expect(missing.body.code).toBe('MODIFIER_REQUIRED');

    const order = await customerOrder(table1, [{ dishId: dish.id, quantity: 1, modifierIds: [modifier.id] }]);
    expect(order.status).toBe(201);
    expect(Number(order.body.items[0].unit_price)).toBe(5.5);
    await confirm(waiter1Token, order.body.id);
    expect(await eggStock()).toBe(98); // recipe 1 egg + modifier 1 egg
  });

  it('a dish that was ordered cannot be deleted, an unused one can', async () => {
    const eggsDish = await dishId('Fried eggs');
    await customerOrder(table1, [{ dishId: eggsDish, quantity: 1 }]);
    const blocked = await call('delete', managerToken, `/api/menu-admin/dishes/${eggsDish}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('IN_USE');

    const fresh = (await call('post', managerToken, '/api/menu-admin/dishes', {
      category_id: await categoryId('Drinks'), name_so: 'Casiir cusub', name_en: 'New juice', price: 2,
    })).body;
    expect((await call('delete', managerToken, `/api/menu-admin/dishes/${fresh.id}`)).status).toBe(200);
  });
});

describe('Moving orders and bill history', () => {
  it('a waiter moves an order to another of their tables; other rules are enforced', async () => {
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1 }]);
    await confirm(waiter1Token, order.body.id);
    const move = (toTableId) => call('post', waiter1Token, `/api/orders/${order.body.id}/move`, { toTableId });

    const same = await move(table1.id);
    expect(same.status).toBe(400);
    expect(same.body.code).toBe('SAME_TABLE');
    const foreign = await move(table5.id);
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('NOT_YOUR_TABLE');

    const ok = await move(table2.id);
    expect(ok.status).toBe(200);
    expect(ok.body.table_number).toBe(2);
    expect((await db('dining_tables').where({ id: table1.id }).first()).status).toBe('free');
    expect((await db('dining_tables').where({ id: table2.id }).first()).status).toBe('waiting_food');
    const there = await request(app).get(`/api/public/table/${table2.token}/orders`);
    expect(there.body).toHaveLength(1);
  });

  it('the cashier can list paid bills to show a receipt again; a waiter cannot', async () => {
    await servedOrder({ table: table1, waiterToken: waiter1Token, kitchenToken, items: [{ dishId: await dishId('Fried eggs'), quantity: 1 }] });
    const bill = (await call('post', cashierToken, `/api/bills/table/${table1.id}`)).body;
    await call('post', cashierToken, `/api/bills/${bill.id}/payments`, { method: 'evc_plus', phone: '619011723', idempotencyKey: `history-${Date.now()}` });

    const list = await call('get', cashierToken, '/api/bills?status=paid');
    expect(list.status).toBe(200);
    expect(list.body.map((b) => b.id)).toContain(bill.id);
    expect((await call('get', waiter1Token, '/api/bills')).status).toBe(403);
  });
});