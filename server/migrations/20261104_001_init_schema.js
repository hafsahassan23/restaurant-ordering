exports.up = async (knex) => {
  await knex.schema.createTable('roles', (t) => {
    t.increments('id');
    t.string('name', 30).notNullable().unique(); // manager, cashier, waiter, kitchen
  });

  await knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('full_name', 100).notNullable();
    t.string('username', 50).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.integer('role_id').unsigned().notNullable().references('id').inTable('roles');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('dining_tables', (t) => {
    t.increments('id');
    t.integer('number').notNullable().unique();
    t.string('area', 50);
    t.integer('seats').notNullable().defaultTo(4);
    t.string('token', 64).notNullable().unique();
    t.enu('status', ['free', 'ordering', 'waiting_food', 'eating', 'paying']).notNullable().defaultTo('free');
    t.boolean('is_closed').notNullable().defaultTo(false);
    t.integer('assigned_waiter_id').unsigned().references('id').inTable('users');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('menu_categories', (t) => {
    t.increments('id');
    t.string('name_so', 100).notNullable();
    t.string('name_en', 100).notNullable().unique();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('dishes', (t) => {
    t.increments('id');
    t.integer('category_id').unsigned().notNullable().references('id').inTable('menu_categories');
    t.string('name_so', 120).notNullable();
    t.string('name_en', 120).notNullable();
    t.text('description_so');
    t.text('description_en');
    t.decimal('price', 10, 2).notNullable();
    t.string('photo_url', 255);
    t.integer('prep_minutes').notNullable().defaultTo(10);
    t.boolean('is_available').notNullable().defaultTo(false); // manager switch
    t.boolean('force_unavailable').notNullable().defaultTo(false); // manager override
    t.unique(['category_id', 'name_en']);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('modifier_groups', (t) => {
    t.increments('id');
    t.integer('dish_id').unsigned().notNullable().references('id').inTable('dishes').onDelete('CASCADE');
    t.string('name_so', 100).notNullable();
    t.string('name_en', 100).notNullable();
    t.boolean('is_required').notNullable().defaultTo(false);
    t.integer('min_select').notNullable().defaultTo(0);
    t.integer('max_select').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('modifiers', (t) => {
    t.increments('id');
    t.integer('group_id').unsigned().notNullable().references('id').inTable('modifier_groups').onDelete('CASCADE');
    t.string('name_so', 100).notNullable();
    t.string('name_en', 100).notNullable();
    t.decimal('price_delta', 10, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable('ingredients', (t) => {
    t.increments('id');
    t.string('name_so', 100).notNullable();
    t.string('name_en', 100).notNullable().unique();
    t.string('unit', 20).notNullable(); // kg, L, pcs
    t.decimal('cost_per_unit', 10, 4).notNullable().defaultTo(0);
    t.decimal('stock_qty', 12, 3).notNullable().defaultTo(0);
    t.decimal('min_level', 12, 3).notNullable().defaultTo(0);
  });

  await knex.schema.createTable('recipes', (t) => {
    t.increments('id');
    t.integer('dish_id').unsigned().notNullable().references('id').inTable('dishes').onDelete('CASCADE');
    t.integer('ingredient_id').unsigned().notNullable().references('id').inTable('ingredients');
    t.decimal('qty_per_portion', 12, 4).notNullable();
    t.unique(['dish_id', 'ingredient_id']);
  });

  await knex.schema.createTable('modifier_ingredients', (t) => {
    t.increments('id');
    t.integer('modifier_id').unsigned().notNullable().references('id').inTable('modifiers').onDelete('CASCADE');
    t.integer('ingredient_id').unsigned().notNullable().references('id').inTable('ingredients');
    t.decimal('qty', 12, 4).notNullable();
    t.unique(['modifier_id', 'ingredient_id']);
  });

  await knex.schema.createTable('orders', (t) => {
    t.increments('id');
    t.integer('table_id').unsigned().notNullable().references('id').inTable('dining_tables');
    t.enu('status', ['pending_confirmation', 'confirmed', 'closed']).notNullable().defaultTo('pending_confirmation');
    t.integer('created_by').unsigned().references('id').inTable('users'); // null = customer
    t.integer('confirmed_by').unsigned().references('id').inTable('users');
    t.timestamp('confirmed_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('order_items', (t) => {
    t.increments('id');
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.integer('dish_id').unsigned().notNullable().references('id').inTable('dishes');
    t.string('dish_name_so', 120).notNullable(); // snapshot
    t.string('dish_name_en', 120).notNullable(); // snapshot
    t.integer('quantity').notNullable().defaultTo(1);
    t.decimal('unit_price', 10, 2).notNullable(); // snapshot incl. modifiers
    t.string('notes', 255);
    t.enu('status', ['pending', 'ordered', 'cooking', 'ready', 'served', 'cancelled']).notNullable().defaultTo('pending');
    t.string('cancel_reason', 255);
    t.boolean('is_waste').notNullable().defaultTo(false);
    t.text('recipe_snapshot'); // JSON: ingredients deducted for this item
    t.timestamp('cooking_at').nullable();
    t.timestamp('ready_at').nullable();
    t.timestamp('served_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('order_item_modifiers', (t) => {
    t.increments('id');
    t.integer('order_item_id').unsigned().notNullable().references('id').inTable('order_items').onDelete('CASCADE');
    t.integer('modifier_id').unsigned().references('id').inTable('modifiers');
    t.string('name_so', 100).notNullable();
    t.string('name_en', 100).notNullable();
    t.decimal('price_delta', 10, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable('stock_movements', (t) => {
    t.increments('id');
    t.integer('ingredient_id').unsigned().notNullable().references('id').inTable('ingredients');
    t.decimal('change_qty', 12, 3).notNullable(); // negative = deducted
    t.enu('reason', ['sale', 'delivery', 'waste', 'adjustment']).notNullable();
    t.decimal('unit_cost', 10, 4).nullable();
    t.integer('order_item_id').unsigned().references('id').inTable('order_items');
    t.integer('user_id').unsigned().references('id').inTable('users');
    t.string('note', 255);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('bills', (t) => {
    t.increments('id');
    t.integer('table_id').unsigned().notNullable().references('id').inTable('dining_tables');
    t.decimal('subtotal', 10, 2).notNullable().defaultTo(0);
    t.decimal('service_charge_pct', 5, 2).notNullable().defaultTo(0);
    t.decimal('service_charge', 10, 2).notNullable().defaultTo(0);
    t.decimal('total', 10, 2).notNullable().defaultTo(0);
    t.enu('status', ['open', 'paid']).notNullable().defaultTo('open');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('bill_splits', (t) => {
    t.increments('id');
    t.integer('bill_id').unsigned().notNullable().references('id').inTable('bills').onDelete('CASCADE');
    t.string('label', 60).notNullable();
    t.decimal('amount', 10, 2).notNullable();
    t.enu('status', ['unpaid', 'paid']).notNullable().defaultTo('unpaid');
  });

  await knex.schema.createTable('payments', (t) => {
    t.increments('id');
    t.integer('bill_id').unsigned().notNullable().references('id').inTable('bills');
    t.integer('split_id').unsigned().references('id').inTable('bill_splits');
    t.enu('method', ['cash', 'evc_plus', 'zaad', 'edahab']).notNullable();
    t.decimal('amount', 10, 2).notNullable();
    t.decimal('amount_given', 10, 2).nullable();
    t.decimal('change_given', 10, 2).nullable();
    t.string('reference', 60);
    t.integer('cashier_id').unsigned().references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id');
    t.integer('user_id').unsigned().references('id').inTable('users');
    t.string('action', 80).notNullable();
    t.string('entity', 50);
    t.integer('entity_id');
    t.text('details');
    t.string('ip', 45);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sms_outbox', (t) => {
    t.increments('id');
    t.string('to_phone', 30).notNullable();
    t.text('message').notNullable();
    t.string('status', 20).notNullable().defaultTo('sent');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('settings', (t) => {
    t.string('key', 50).primary();
    t.string('value', 255).notNullable();
  });
};

exports.down = async (knex) => {
  const tables = [
    'settings', 'sms_outbox', 'audit_logs', 'payments', 'bill_splits', 'bills',
    'stock_movements', 'order_item_modifiers', 'order_items', 'orders',
    'modifier_ingredients', 'recipes', 'ingredients', 'modifiers', 'modifier_groups',
    'dishes', 'menu_categories', 'dining_tables', 'users', 'roles',
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
};