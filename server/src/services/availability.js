const EPS = 1e-9; // protects against floating point errors (0.3 / 0.1)

/** How many portions the stock allows: the scarcest ingredient decides. No recipe = 0. */
exports.dishPortions = (rows) => {
  if (rows.length === 0) return 0;
  return Math.min(...rows.map((r) => Math.floor(Number(r.stock_qty) / Number(r.qty_per_portion) + EPS)));
};

/** A modifier is available when stock covers all its ingredients. */
exports.modifierAvailable = (rows) => rows.every((r) => Number(r.stock_qty) + EPS >= Number(r.qty));

/** Why a dish cannot be ordered (null = available). */
exports.unavailableReason = (dish, hasRecipe, portions) => {
  if (!hasRecipe) return 'no_recipe';
  if (dish.force_unavailable) return 'override';
  if (!dish.is_available) return 'manual';
  if (portions < 1) return 'out_of_stock';
  return null;
};