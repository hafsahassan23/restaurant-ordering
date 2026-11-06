const db = require('../db');

/** Load everything needed to build the menu and compute availability. */
exports.loadMenuData = async () => {
  const categories = await db('menu_categories').orderBy('sort_order');
  const dishes = await db('dishes').orderBy('id');
  const recipes = await db('recipes')
    .join('ingredients', 'recipes.ingredient_id', 'ingredients.id')
    .select('recipes.dish_id', 'recipes.qty_per_portion', 'ingredients.stock_qty');
  const groups = await db('modifier_groups').orderBy('id');
  const modifiers = await db('modifiers').orderBy('id');
  const modifierIngredients = await db('modifier_ingredients')
    .join('ingredients', 'modifier_ingredients.ingredient_id', 'ingredients.id')
    .select('modifier_ingredients.modifier_id', 'modifier_ingredients.qty', 'ingredients.stock_qty');
  return { categories, dishes, recipes, groups, modifiers, modifierIngredients };
};

exports.findDish = (id) => db('dishes').where({ id }).first();
exports.updateDish = (id, patch) => db('dishes').where({ id }).update(patch);