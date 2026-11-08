/** Rows of { ingredientId, qty } as typed in a form, converted to the API shape (empty rows are dropped). */
export const toIngredientPayload = (rows) =>
  rows
    .filter((r) => r.ingredientId && Number(r.qty) > 0)
    .map((r) => ({ ingredientId: Number(r.ingredientId), qty: Number(r.qty) }));