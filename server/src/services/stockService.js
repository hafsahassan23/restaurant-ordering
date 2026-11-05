const db = require('../db');
const AppError = require('../utils/AppError');
const stockRepository = require('../repositories/stockRepository');
const auditService = require('./auditService');
const realtime = require('../realtime');

const EPS = 1e-9;
const round3 = (n) => Math.round(n * 1000) / 1000;
const partsOf = (item) => JSON.parse(item.recipe_snapshot || '[]');

/**
 * Snapshot of what ONE portion consumes: recipe + chosen modifiers.
 * Saved on the order item, so later recipe changes only affect future orders.
 */
exports.buildSnapshot = async (dishId, modifierIds) => {
  const merged = new Map();
  const add = (id, qty) => merged.set(id, (merged.get(id) || 0) + Number(qty));
  (await stockRepository.recipeFor(dishId)).forEach((r) => add(r.ingredient_id, r.qty_per_portion));
  (await stockRepository.modifierIngredients(modifierIds)).forEach((r) => add(r.ingredient_id, r.qty));
  return [...merged.entries()].map(([ingredient_id, qty]) => ({ ingredient_id, qty }));
};

/**
 * Deduct stock for items being sent to the kitchen. Must run inside a transaction.
 * Rows are locked (FOR UPDATE), so two orders competing for the last portion
 * are processed one after the other: the second one fails with 409.
 */
exports.deductForItems = async (items, trx, userId) => {
  const totals = new Map();
  for (const item of items) {
    for (const p of partsOf(item)) {
      totals.set(p.ingredient_id, (totals.get(p.ingredient_id) || 0) + p.qty * item.quantity);
    }
  }
  if (totals.size === 0) return;

  const rows = await stockRepository.lockIngredients([...totals.keys()], trx);
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Check everything first, so nothing is written if one ingredient is short
  for (const [id, need] of totals) {
    const row = byId.get(id);
    if (!row || Number(row.stock_qty) + EPS < need) {
      throw new AppError(409, `Not enough stock: ${row ? row.name_en : id}`, 'INSUFFICIENT_STOCK');
    }
  }
  for (const [id, need] of totals) {
    await stockRepository.setStock(id, round3(Number(byId.get(id).stock_qty) - need), trx);
  }
  for (const item of items) {
    for (const p of partsOf(item)) {
      await stockRepository.insertMovement({
        ingredient_id: p.ingredient_id,
        change_qty: -round3(p.qty * item.quantity),
        reason: 'sale',
        unit_cost: byId.get(p.ingredient_id).cost_per_unit,
        order_item_id: item.id,
        user_id: userId,
      }, trx);
    }
  }
};

/** Give stock back when an item is cancelled before cooking started. */
exports.restoreForItem = async (item, trx, userId) => {
  const parts = partsOf(item);
  if (parts.length === 0) return;
  const rows = await stockRepository.lockIngredients(parts.map((p) => p.ingredient_id), trx);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const p of parts) {
    const back = p.qty * item.quantity;
    await stockRepository.setStock(p.ingredient_id, round3(Number(byId.get(p.ingredient_id).stock_qty) + back), trx);
    await stockRepository.insertMovement({
      ingredient_id: p.ingredient_id, change_qty: round3(back), reason: 'adjustment',
      order_item_id: item.id, user_id: userId, note: 'Cancelled before cooking',
    }, trx);
  }
};

/** Item cancelled while cooking: ingredients stay deducted, movements become "waste". */
exports.markWaste = (orderItemId, trx) => stockRepository.relabelSaleAsWaste(orderItemId, trx);

/**
 * Manager records a delivery, waste or adjustment. Stock never goes below zero.
 */
exports.recordMovement = async ({ ingredientId, qty, reason, unitCost, note, user, ip }) => {
  const change = reason === 'delivery' ? Math.abs(qty) : reason === 'waste' ? -Math.abs(qty) : qty;

  const result = await db.transaction(async (trx) => {
    const [row] = await stockRepository.lockIngredients([ingredientId], trx);
    if (!row) throw new AppError(404, 'Ingredient not found', 'NOT_FOUND');
    const newQty = round3(Number(row.stock_qty) + change);
    if (newQty < 0) throw new AppError(409, 'Stock cannot go below zero', 'NEGATIVE_STOCK');

    await stockRepository.setStock(ingredientId, newQty, trx);
    if (reason === 'delivery' && unitCost != null) await stockRepository.setCost(ingredientId, unitCost, trx);
    await stockRepository.insertMovement({
      ingredient_id: ingredientId, change_qty: change, reason,
      unit_cost: unitCost != null ? unitCost : row.cost_per_unit,
      user_id: user.id, note: note || null,
    }, trx);
    return { id: ingredientId, stock_qty: newQty };
  });

  await auditService.log({
    userId: user.id, action: `STOCK_${reason.toUpperCase()}`, entity: 'ingredient',
    entityId: ingredientId, details: { change, unitCost }, ip,
  });
  realtime.emitAll('menu:updated', {}); // dishes may have become available again
  return result;
};

/** Ingredients with a "low" flag (below minimum level). */
exports.listIngredients = async () =>
  (await stockRepository.listIngredients()).map((i) => ({
    ...i,
    stock_qty: Number(i.stock_qty),
    min_level: Number(i.min_level),
    cost_per_unit: Number(i.cost_per_unit),
    low: Number(i.stock_qty) < Number(i.min_level),
  }));

exports.recentMovements = (limit) => stockRepository.recentMovements(limit);