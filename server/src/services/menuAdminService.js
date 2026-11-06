const db = require('../db');
const AppError = require('../utils/AppError');
const menuRepository = require('../repositories/menuRepository');
const stockRepository = require('../repositories/stockRepository');
const auditService = require('./auditService');
const realtime = require('../realtime');

async function mustFindDish(dishId) {
  const dish = await menuRepository.findDish(dishId);
  if (!dish) throw new AppError(404, 'Dish not found', 'NOT_FOUND');
  return dish;
}

/** Available switch and "force unavailable" override. A dish needs a recipe to be made available. */
exports.setFlags = async (dishId, flags, user, ip) => {
  await mustFindDish(dishId);
  if (flags.is_available === true && (await stockRepository.recipeFor(dishId)).length === 0) {
    throw new AppError(409, 'A dish needs a recipe before it can be made available', 'NO_RECIPE');
  }
  await menuRepository.updateDish(dishId, flags);
  await auditService.log({ userId: user.id, action: 'DISH_FLAGS_CHANGED', entity: 'dish', entityId: dishId, details: flags, ip });
  realtime.emitAll('menu:updated', {});
  return { id: dishId, ...flags };
};

exports.getRecipe = async (dishId) => {
  await mustFindDish(dishId);
  return stockRepository.recipeFor(dishId);
};

/** Replace the recipe of a dish. Old orders keep their own snapshot, so only new orders are affected. */
exports.setRecipe = async (dishId, items, user, ip) => {
  await mustFindDish(dishId);
  const found = await stockRepository.findIngredients(items.map((i) => i.ingredientId));
  if (found.length !== items.length) throw new AppError(400, 'Unknown ingredient', 'INVALID_INGREDIENT');

  await db.transaction((trx) =>
    stockRepository.replaceRecipe(dishId, items.map((i) => ({ ingredient_id: i.ingredientId, qty_per_portion: i.qty })), trx)
  );
  await auditService.log({ userId: user.id, action: 'RECIPE_CHANGED', entity: 'dish', entityId: dishId, details: { items }, ip });
  realtime.emitAll('menu:updated', {});
  return stockRepository.recipeFor(dishId);
};