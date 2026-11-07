const db = require('../db');

const count = async (query) => Number((await query.count({ c: '*' }).first()).c);

// ---- categories
exports.findCategory = (id) => db('menu_categories').where({ id }).first();
exports.categoryNameTaken = async (name_so, name_en, exceptId = null) => {
  const q = db('menu_categories').where((b) => b.where({ name_so }).orWhere({ name_en }));
  if (exceptId) q.whereNot({ id: exceptId });
  return Boolean(await q.first());
};
exports.insertCategory = (row) => db('menu_categories').insert(row).then(([id]) => id);
exports.updateCategory = (id, patch) => db('menu_categories').where({ id }).update(patch);
exports.deleteCategory = (id) => db('menu_categories').where({ id }).del();
exports.dishesInCategory = (id) => count(db('dishes').where({ category_id: id }));

// ---- dishes (flags and recipe live in menuRepository / stockRepository)
exports.dishNameTaken = async (categoryId, name_so, name_en, exceptId = null) => {
  const q = db('dishes').where({ category_id: categoryId }).where((b) => b.where({ name_en }).orWhere({ name_so }));
  if (exceptId) q.whereNot({ id: exceptId });
  return Boolean(await q.first());
};
exports.insertDish = (row) => db('dishes').insert(row).then(([id]) => id);
exports.deleteDish = (id) => db('dishes').where({ id }).del();
exports.dishOrderCount = (id) => count(db('order_items').where({ dish_id: id }));

// ---- modifier groups and modifiers
exports.findGroup = (id) => db('modifier_groups').where({ id }).first();
exports.groupsOfDish = (dishId) => db('modifier_groups').where({ dish_id: dishId }).orderBy('id');
exports.insertGroup = (row) => db('modifier_groups').insert(row).then(([id]) => id);
exports.updateGroup = (id, patch) => db('modifier_groups').where({ id }).update(patch);
exports.deleteGroup = (id) => db('modifier_groups').where({ id }).del();
exports.groupUsage = (groupId) =>
  count(db('order_item_modifiers').join('modifiers', 'order_item_modifiers.modifier_id', 'modifiers.id').where('modifiers.group_id', groupId));

exports.findModifier = (id) => db('modifiers').where({ id }).first();
exports.modifiersOfDish = (dishId) =>
  db('modifiers').join('modifier_groups', 'modifiers.group_id', 'modifier_groups.id')
    .where('modifier_groups.dish_id', dishId).select('modifiers.*').orderBy('modifiers.id');
exports.insertModifier = (row, trx = db) => trx('modifiers').insert(row).then(([id]) => id);
exports.updateModifier = (id, patch, trx = db) => trx('modifiers').where({ id }).update(patch);
exports.deleteModifier = (id) => db('modifiers').where({ id }).del();
exports.modifierUsage = (id) => count(db('order_item_modifiers').where({ modifier_id: id }));
exports.modifierIngredientsOf = (ids) =>
  (ids.length ? db('modifier_ingredients').whereIn('modifier_id', ids) : Promise.resolve([]));
exports.replaceModifierIngredients = async (modifierId, rows, trx = db) => {
  await trx('modifier_ingredients').where({ modifier_id: modifierId }).del();
  for (const row of rows) await trx('modifier_ingredients').insert({ ...row, modifier_id: modifierId });
};