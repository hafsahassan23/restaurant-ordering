const menuRepository = require('../repositories/menuRepository');
const availability = require('./availability');

const groupBy = (rows, key) => {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  }
  return map;
};

/** Full menu: categories > dishes > modifier groups > modifiers, with live availability. */
exports.getMenu = async () => {
  const d = await menuRepository.loadMenuData();
  const recipesByDish = groupBy(d.recipes, 'dish_id');
  const groupsByDish = groupBy(d.groups, 'dish_id');
  const modsByGroup = groupBy(d.modifiers, 'group_id');
  const ingByMod = groupBy(d.modifierIngredients, 'modifier_id');

  const dishes = d.dishes.map((dish) => {
    const recipe = recipesByDish.get(dish.id) || [];
    const modifier_groups = (groupsByDish.get(dish.id) || []).map((g) => ({
      id: g.id, name_so: g.name_so, name_en: g.name_en,
      is_required: !!g.is_required, min_select: g.min_select, max_select: g.max_select,
      modifiers: (modsByGroup.get(g.id) || []).map((m) => ({
        id: m.id, name_so: m.name_so, name_en: m.name_en,
        price_delta: Number(m.price_delta),
        available: availability.modifierAvailable(ingByMod.get(m.id) || []),
      })),
    }));

    let reason = availability.unavailableReason(dish, recipe.length > 0, availability.dishPortions(recipe));
    // A required group where every choice is out of stock blocks the whole dish
    const blocked = modifier_groups.some((g) => g.is_required && !g.modifiers.some((m) => m.available));
    if (!reason && blocked) reason = 'out_of_stock';

    return {
      id: dish.id, category_id: dish.category_id,
      name_so: dish.name_so, name_en: dish.name_en,
      description_so: dish.description_so, description_en: dish.description_en,
      price: Number(dish.price), photo_url: dish.photo_url, prep_minutes: dish.prep_minutes,
      available: reason === null, unavailable_reason: reason, modifier_groups,
    };
  });

  const byCategory = groupBy(dishes, 'category_id');
  return d.categories.map((c) => ({
    id: c.id, name_so: c.name_so, name_en: c.name_en, dishes: byCategory.get(c.id) || [],
  }));
};

/** Map of dishId -> dish (used to validate new orders). */
exports.getDishMap = async () => {
  const map = new Map();
  (await exports.getMenu()).forEach((c) => c.dishes.forEach((dish) => map.set(dish.id, dish)));
  return map;
};