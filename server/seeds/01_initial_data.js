/**
 * Seed data: roles, demo users, tables, menu, ingredients, recipes, modifiers.
 * Safe to re-run: it clears the tables first.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Insert rows one by one and return a map { key: id }
async function insertMap(knex, table, rows, key) {
  const map = {};
  for (const row of rows) {
    const [id] = await knex(table).insert(row);
    map[row[key]] = id;
  }
  return map;
}

exports.seed = async (knex) => {
  // Delete in reverse dependency order so foreign keys do not block us
   const clearOrder = [
    'settings', 'sms_outbox', 'audit_logs', 'payments', 'bill_splits',
    'stock_movements', 'order_item_modifiers', 'order_items', 'orders', 'bills',
    'modifier_ingredients', 'recipes', 'ingredients', 'modifiers', 'modifier_groups',
    'dishes', 'menu_categories', 'dining_tables', 'users', 'roles',
  ];
  for (const t of clearOrder) await knex(t).del();

  // Roles and users
  const roles = await insertMap(
    knex, 'roles',
    ['manager', 'cashier', 'waiter', 'kitchen'].map((name) => ({ name })),
    'name'
  );

  const users = [
    ['Axmed Cali Nuur', 'manager', 'Manager@123', 'manager'],
    ['Hodan Maxamed Jaamac', 'cashier', 'Cashier@123', 'cashier'],
    ['Cabdi Warsame Faarax', 'waiter1', 'Waiter@123', 'waiter'],
    ['Ifrah Nuur Xasan', 'waiter2', 'Waiter@123', 'waiter'],
    ['Mustafe Yuusuf Dahir', 'kitchen', 'Kitchen@123', 'kitchen'],
  ];
  const userIds = {};
  for (const [full_name, username, pw, role] of users) {
    const [id] = await knex('users').insert({
      full_name, username,
      password_hash: await bcrypt.hash(pw, 10),
      role_id: roles[role],
    });
    userIds[username] = id;
  }

  // Settings
  await knex('settings').insert([
    { key: 'restaurant_name', value: 'Restoran Banaadir' },
    { key: 'service_charge_pct', value: '5' },
    { key: 'currency', value: 'USD' },
  ]);

  // Tables (each with a random QR token)
  const tables = [
    [1, 'Hoolka weyn', 4], [2, 'Hoolka weyn', 4], [3, 'Hoolka weyn', 6],
    [4, 'Hoolka weyn', 2], [5, 'Barxadda', 4], [6, 'Barxadda', 4],
    [7, 'Barxadda', 8], [8, 'VIP', 6],
  ];
  for (const [number, area, seats] of tables) {
    await knex('dining_tables').insert({
      number, area, seats,
      token: crypto.randomBytes(16).toString('hex'),
      assigned_waiter_id: number <= 4 ? userIds.waiter1 : userIds.waiter2,
    });
  }

  // Categories
  const cats = await insertMap(knex, 'menu_categories', [
    { name_so: 'Quraac', name_en: 'Breakfast', sort_order: 1 },
    { name_so: 'Cuntooyinka waaweyn', name_en: 'Main dishes', sort_order: 2 },
    { name_so: 'Cabitaanno', name_en: 'Drinks', sort_order: 3 },
  ], 'name_en');

  // Ingredients (name_en, name_so, unit, cost, stock, min)
  const ingData = [
    ['Rice', 'Bariis', 'kg', 1.2, 50, 10],
    ['Goat meat', 'Hilib riyo', 'kg', 7.0, 30, 5],
    ['Camel meat', 'Hilib geel', 'kg', 6.5, 25, 5],
    ['Chicken', 'Digaag', 'kg', 4.5, 30, 5],
    ['Oil', 'Saliid', 'L', 3.0, 20, 3],
    ['Onion', 'Basal', 'kg', 1.0, 15, 3],
    ['Flour', 'Bur', 'kg', 0.9, 25, 5],
    ['Eggs', 'Ukun', 'pcs', 0.2, 120, 24],
    ['Milk', 'Caano', 'L', 1.1, 40, 8],
    ['Tea leaves', 'Shaaha', 'kg', 8.0, 5, 1],
    ['Sugar', 'Sonkor', 'kg', 1.0, 20, 4],
    ['Banana', 'Moos', 'kg', 1.2, 15, 3],
    ['Lemon', 'Liin', 'pcs', 0.15, 60, 10],
    ['Pasta', 'Baasto', 'kg', 1.5, 20, 4],
  ];
  const ing = await insertMap(knex, 'ingredients', ingData.map(
    ([name_en, name_so, unit, cost_per_unit, stock_qty, min_level]) =>
      ({ name_en, name_so, unit, cost_per_unit, stock_qty, min_level })
  ), 'name_en');

  // Initial delivery logged as stock movements (every movement is logged)
  for (const [name_en, , , cost, qty] of ingData) {
    await knex('stock_movements').insert({
      ingredient_id: ing[name_en], change_qty: qty, reason: 'delivery',
      unit_cost: cost, user_id: userIds.manager, note: 'Opening stock',
    });
  }

  // Dishes
  const dishData = [
    ['Breakfast', 'Ukun duban', 'Fried eggs', 2.5, 8],
    ['Breakfast', 'Canjeero', 'Canjeero with sugar', 2.0, 10],
    ['Main dishes', 'Bariis iyo hilib', 'Rice with meat', 6.0, 20],
    ['Main dishes', 'Baasto digaag', 'Chicken pasta', 5.0, 15],
    ['Drinks', 'Shaah caano', 'Milk tea', 1.0, 5],
    ['Drinks', 'Casiir moos', 'Banana juice', 2.0, 5],
    ['Drinks', 'Casiir liin', 'Lemon juice', 1.5, 5],
  ];
  const dishes = await insertMap(knex, 'dishes', dishData.map(
    ([cat, name_so, name_en, price, prep_minutes]) => ({
      category_id: cats[cat], name_so, name_en, price, prep_minutes,
      description_so: `${name_so} cusub oo diyaar ah`,
      description_en: `Freshly prepared ${name_en.toLowerCase()}`,
      is_available: true,
    })
  ), 'name_en');

  // Recipes: dish -> [[ingredient, qty per portion]]
  const recipes = {
    'Fried eggs': [['Eggs', 2], ['Oil', 0.01], ['Onion', 0.02]],
    'Canjeero with sugar': [['Flour', 0.1], ['Oil', 0.01], ['Sugar', 0.02]],
    'Rice with meat': [['Rice', 0.25], ['Oil', 0.02], ['Onion', 0.05]],
    'Chicken pasta': [['Pasta', 0.2], ['Chicken', 0.15], ['Oil', 0.02], ['Onion', 0.05]],
    'Milk tea': [['Tea leaves', 0.005], ['Milk', 0.15], ['Sugar', 0.02]],
    'Banana juice': [['Banana', 0.25], ['Sugar', 0.02], ['Milk', 0.1]],
    'Lemon juice': [['Lemon', 2], ['Sugar', 0.03]],
  };
  for (const [dish, items] of Object.entries(recipes)) {
    for (const [ingName, qty] of items) {
      await knex('recipes').insert({
        dish_id: dishes[dish], ingredient_id: ing[ingName], qty_per_portion: qty,
      });
    }
  }

  // Modifiers for "Rice with meat"
  const [meatGroup] = await knex('modifier_groups').insert({
    dish_id: dishes['Rice with meat'], name_so: 'Hilibka', name_en: 'Meat',
    is_required: true, min_select: 1, max_select: 1,
  });
  const [extrasGroup] = await knex('modifier_groups').insert({
    dish_id: dishes['Rice with meat'], name_so: 'Dheeraad', name_en: 'Extras',
    is_required: false, min_select: 0, max_select: 3,
  });

  const mods = [
    [meatGroup, 'Riyo', 'Goat', 0, 'Goat meat', 0.2],
    [meatGroup, 'Geel', 'Camel', 0.5, 'Camel meat', 0.2],
    [meatGroup, 'Digaag', 'Chicken', 0, 'Chicken', 0.2],
    [extrasGroup, 'Bariis dheeraad', 'Extra rice', 1.0, 'Rice', 0.15],
    [extrasGroup, 'Basal la\'aan', 'No onions', 0, null, 0],
  ];
  for (const [group_id, name_so, name_en, price_delta, ingName, qty] of mods) {
    const [modId] = await knex('modifiers').insert({ group_id, name_so, name_en, price_delta });
    if (ingName) {
      await knex('modifier_ingredients').insert({
        modifier_id: modId, ingredient_id: ing[ingName], qty,
      });
    }
  }
};