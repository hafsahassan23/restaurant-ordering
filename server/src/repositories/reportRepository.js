const db = require('../db');

const paidInRange = (query, from, to) =>
  query.where('bills.status', 'paid').whereRaw('DATE(bills.updated_at) BETWEEN ? AND ?', [from, to]);

exports.dailySales = (from, to) =>
  paidInRange(db('bills'), from, to)
    .select(db.raw("DATE_FORMAT(bills.updated_at, '%Y-%m-%d') as day"))
    .sum({ total: 'bills.total' })
    .count({ bills: 'bills.id' })
    .groupByRaw("DATE_FORMAT(bills.updated_at, '%Y-%m-%d')")
    .orderBy('day');

exports.salesByDish = (from, to) =>
  paidInRange(
    db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .join('bills', 'orders.bill_id', 'bills.id')
      .join('dishes', 'order_items.dish_id', 'dishes.id')
      .join('menu_categories', 'dishes.category_id', 'menu_categories.id')
      .whereNot('order_items.status', 'cancelled'),
    from, to
  )
    .select('dishes.id as dish_id', 'dishes.name_so', 'dishes.name_en',
      'menu_categories.id as category_id', 'menu_categories.name_so as category_name_so',
      'menu_categories.name_en as category_name_en')
    .sum({ qty: 'order_items.quantity' })
    .select(db.raw('SUM(order_items.unit_price * order_items.quantity) as revenue'))
    .groupBy('dishes.id', 'dishes.name_so', 'dishes.name_en', 'menu_categories.id',
      'menu_categories.name_so', 'menu_categories.name_en')
    .orderBy('revenue', 'desc');

/** Average seconds from "confirmed by waiter" to "ready" in the kitchen. */
exports.avgPrepSeconds = async (from, to) => {
  const row = await db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .whereNotNull('order_items.ready_at')
    .whereNotNull('orders.confirmed_at')
    .whereRaw('DATE(order_items.ready_at) BETWEEN ? AND ?', [from, to])
    .select(db.raw('AVG(TIMESTAMPDIFF(SECOND, orders.confirmed_at, order_items.ready_at)) as avg_seconds'))
    .first();
  return row && row.avg_seconds != null ? Number(row.avg_seconds) : null;
};

/** Ingredient cost of one portion of each dish, from its recipe. */
exports.dishCosts = () =>
  db('dishes')
    .leftJoin('recipes', 'recipes.dish_id', 'dishes.id')
    .leftJoin('ingredients', 'recipes.ingredient_id', 'ingredients.id')
    .select('dishes.id as dish_id', 'dishes.name_so', 'dishes.name_en', 'dishes.price')
    .select(db.raw('COALESCE(SUM(recipes.qty_per_portion * ingredients.cost_per_unit), 0) as cost'))
    .groupBy('dishes.id', 'dishes.name_so', 'dishes.name_en', 'dishes.price');