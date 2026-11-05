const db = require('../db');

exports.recipeFor = (dishId) => db('recipes').where({ dish_id: dishId });
exports.modifierIngredients = (modifierIds) =>
  modifierIds.length ? db('modifier_ingredients').whereIn('modifier_id', modifierIds) : Promise.resolve([]);

/** Lock ingredient rows until the transaction ends (always in id order, to avoid deadlocks). */
exports.lockIngredients = (ids, trx) => trx('ingredients').whereIn('id', ids).orderBy('id').forUpdate();
exports.setStock = (id, qty, trx) => trx('ingredients').where({ id }).update({ stock_qty: qty });
exports.setCost = (id, cost, trx) => trx('ingredients').where({ id }).update({ cost_per_unit: cost });
exports.insertMovement = (row, trx = db) => trx('stock_movements').insert(row);
exports.relabelSaleAsWaste = (orderItemId, trx) =>
  trx('stock_movements').where({ order_item_id: orderItemId, reason: 'sale' }).update({ reason: 'waste' });
exports.listIngredients = () => db('ingredients').orderBy('name_en');
exports.recentMovements = (limit = 100) =>
  db('stock_movements')
    .join('ingredients', 'stock_movements.ingredient_id', 'ingredients.id')
    .select('stock_movements.*', 'ingredients.name_en', 'ingredients.name_so', 'ingredients.unit')
    .orderBy('stock_movements.id', 'desc')
    .limit(limit);