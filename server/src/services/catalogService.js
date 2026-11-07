const db = require('../db');
const AppError = require('../utils/AppError');
const catalogRepository = require('../repositories/catalogRepository');
const menuRepository = require('../repositories/menuRepository');
const stockRepository = require('../repositories/stockRepository');
const auditService = require('./auditService');
const realtime = require('../realtime');

const changed = () => realtime.emitAll('menu:updated', {});
const audit = (user, action, entity, entityId, details, ip) =>
  auditService.log({ userId: user.id, action, entity, entityId, details, ip });
const found = (row, what) => {
  if (!row) throw new AppError(404, `${what} not found`, 'NOT_FOUND');
  return row;
};

// ---------- categories
exports.createCategory = async (body, user, ip) => {
  if (await catalogRepository.categoryNameTaken(body.name_so, body.name_en)) {
    throw new AppError(409, 'Category name already exists', 'CATEGORY_NAME_TAKEN');
  }
  const id = await catalogRepository.insertCategory({
    name_so: body.name_so, name_en: body.name_en, sort_order: body.sort_order ?? 99,
  });
  await audit(user, 'CATEGORY_CREATED', 'category', id, body, ip);
  changed();
  return { id };
};

exports.updateCategory = async (id, patch, user, ip) => {
  const current = found(await catalogRepository.findCategory(id), 'Category');
  const next = { name_so: patch.name_so ?? current.name_so, name_en: patch.name_en ?? current.name_en };
  if (await catalogRepository.categoryNameTaken(next.name_so, next.name_en, id)) {
    throw new AppError(409, 'Category name already exists', 'CATEGORY_NAME_TAKEN');
  }
  await catalogRepository.updateCategory(id, patch);
  await audit(user, 'CATEGORY_UPDATED', 'category', id, patch, ip);
  changed();
  return { id };
};

exports.deleteCategory = async (id, user, ip) => {
  found(await catalogRepository.findCategory(id), 'Category');
  if ((await catalogRepository.dishesInCategory(id)) > 0) {
    throw new AppError(409, 'Move or delete the dishes of this category first', 'CATEGORY_NOT_EMPTY');
  }
  await catalogRepository.deleteCategory(id);
  await audit(user, 'CATEGORY_DELETED', 'category', id, null, ip);
  changed();
  return { ok: true };
};

// ---------- dishes
const dishRow = (b) => ({
  category_id: b.category_id, name_so: b.name_so, name_en: b.name_en,
  description_so: b.description_so || '', description_en: b.description_en || '',
  price: b.price, photo_url: b.photo_url || null, prep_minutes: b.prep_minutes,
});

/** New dishes start unavailable: they need a recipe before they can be made Available. */
exports.createDish = async (body, user, ip) => {
  found(await catalogRepository.findCategory(body.category_id), 'Category');
  if (await catalogRepository.dishNameTaken(body.category_id, body.name_so, body.name_en)) {
    throw new AppError(409, 'A dish with this name already exists in the category', 'DISH_NAME_TAKEN');
  }
  const id = await catalogRepository.insertDish({ ...dishRow(body), is_available: false, force_unavailable: false });
  await audit(user, 'DISH_CREATED', 'dish', id, { name: body.name_en, price: body.price }, ip);
  changed();
  return { id };
};

exports.updateDish = async (id, body, user, ip) => {
  found(await menuRepository.findDish(id), 'Dish');
  found(await catalogRepository.findCategory(body.category_id), 'Category');
  if (await catalogRepository.dishNameTaken(body.category_id, body.name_so, body.name_en, id)) {
    throw new AppError(409, 'A dish with this name already exists in the category', 'DISH_NAME_TAKEN');
  }
  await menuRepository.updateDish(id, dishRow(body));
  await audit(user, 'DISH_UPDATED', 'dish', id, { name: body.name_en, price: body.price }, ip);
  changed();
  return { id };
};

/** A dish that was ever ordered cannot be deleted (history); switch it off instead. */
exports.deleteDish = async (id, user, ip) => {
  found(await menuRepository.findDish(id), 'Dish');
  if ((await catalogRepository.dishOrderCount(id)) > 0) {
    throw new AppError(409, 'This dish has order history, switch it off instead', 'IN_USE');
  }
  await catalogRepository.deleteDish(id);
  await audit(user, 'DISH_DELETED', 'dish', id, null, ip);
  changed();
  return { ok: true };
};

/** Dish with its modifier groups, modifiers and their ingredients (for the editor). */
exports.getDishDetail = async (id) => {
  const dish = found(await menuRepository.findDish(id), 'Dish');
  const groups = await catalogRepository.groupsOfDish(id);
  const mods = await catalogRepository.modifiersOfDish(id);
  const ings = await catalogRepository.modifierIngredientsOf(mods.map((m) => m.id));
  return {
    ...dish,
    price: Number(dish.price),
    groups: groups.map((g) => ({
      ...g,
      is_required: !!g.is_required,
      modifiers: mods.filter((m) => m.group_id === g.id).map((m) => ({
        ...m,
        price_delta: Number(m.price_delta),
        ingredients: ings.filter((i) => i.modifier_id === m.id)
          .map((i) => ({ ingredient_id: i.ingredient_id, qty: Number(i.qty) })),
      })),
    })),
  };
};

// ---------- modifier groups and modifiers
exports.createGroup = async (dishId, body, user, ip) => {
  found(await menuRepository.findDish(dishId), 'Dish');
  const id = await catalogRepository.insertGroup({ dish_id: dishId, ...body });
  await audit(user, 'MODIFIER_GROUP_CREATED', 'modifier_group', id, body, ip);
  changed();
  return { id };
};

exports.updateGroup = async (id, body, user, ip) => {
  found(await catalogRepository.findGroup(id), 'Group');
  await catalogRepository.updateGroup(id, body);
  await audit(user, 'MODIFIER_GROUP_UPDATED', 'modifier_group', id, body, ip);
  changed();
  return { id };
};

exports.deleteGroup = async (id, user, ip) => {
  found(await catalogRepository.findGroup(id), 'Group');
  if ((await catalogRepository.groupUsage(id)) > 0) {
    throw new AppError(409, 'These choices were used in past orders', 'IN_USE');
  }
  await catalogRepository.deleteGroup(id);
  await audit(user, 'MODIFIER_GROUP_DELETED', 'modifier_group', id, null, ip);
  changed();
  return { ok: true };
};

async function checkIngredients(items) {
  const rows = await stockRepository.findIngredients(items.map((i) => i.ingredientId));
  if (rows.length !== items.length) throw new AppError(400, 'Unknown ingredient', 'INVALID_INGREDIENT');
}

const ingredientRows = (items) => items.map((i) => ({ ingredient_id: i.ingredientId, qty: i.qty }));

/** A modifier can add to the price and consume ingredients (extra rice uses rice). */
exports.createModifier = async (groupId, body, user, ip) => {
  found(await catalogRepository.findGroup(groupId), 'Group');
  await checkIngredients(body.ingredients);
  const id = await db.transaction(async (trx) => {
    const modifierId = await catalogRepository.insertModifier(
      { group_id: groupId, name_so: body.name_so, name_en: body.name_en, price_delta: body.price_delta }, trx);
    await catalogRepository.replaceModifierIngredients(modifierId, ingredientRows(body.ingredients), trx);
    return modifierId;
  });
  await audit(user, 'MODIFIER_CREATED', 'modifier', id, { name: body.name_en, price_delta: body.price_delta }, ip);
  changed();
  return { id };
};

exports.updateModifier = async (id, body, user, ip) => {
  found(await catalogRepository.findModifier(id), 'Modifier');
  await checkIngredients(body.ingredients);
  await db.transaction(async (trx) => {
    await catalogRepository.updateModifier(
      id, { name_so: body.name_so, name_en: body.name_en, price_delta: body.price_delta }, trx);
    await catalogRepository.replaceModifierIngredients(id, ingredientRows(body.ingredients), trx);
  });
  await audit(user, 'MODIFIER_UPDATED', 'modifier', id, { name: body.name_en }, ip);
  changed();
  return { id };
};

exports.deleteModifier = async (id, user, ip) => {
  found(await catalogRepository.findModifier(id), 'Modifier');
  if ((await catalogRepository.modifierUsage(id)) > 0) {
    throw new AppError(409, 'This choice was used in past orders', 'IN_USE');
  }
  await catalogRepository.deleteModifier(id);
  await audit(user, 'MODIFIER_DELETED', 'modifier', id, null, ip);
  changed();
  return { ok: true };
};