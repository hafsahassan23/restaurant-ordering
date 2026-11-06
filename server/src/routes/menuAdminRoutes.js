const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const menuAdminService = require('../services/menuAdminService');

router.use(authenticate, authorize('manager'));

const flagsSchema = z
  .object({ is_available: z.boolean().optional(), force_unavailable: z.boolean().optional() })
  .refine((v) => v.is_available !== undefined || v.force_unavailable !== undefined, { message: 'Nothing to change' });

/** PATCH /api/menu-admin/dishes/:id { is_available?, force_unavailable? } */
router.patch('/dishes/:id', async (req, res) => {
  res.json(await menuAdminService.setFlags(idParam(req.params.id), flagsSchema.parse(req.body), req.user, req.ip));
});

/** GET /api/menu-admin/dishes/:id/recipe */
router.get('/dishes/:id/recipe', async (req, res) => {
  res.json(await menuAdminService.getRecipe(idParam(req.params.id)));
});

const recipeSchema = z.object({
  items: z
    .array(z.object({ ingredientId: z.number().int().positive(), qty: z.number().positive().max(1000) }))
    .max(30)
    .refine((a) => new Set(a.map((i) => i.ingredientId)).size === a.length, { message: 'Duplicate ingredient' }),
});

/** PUT /api/menu-admin/dishes/:id/recipe { items: [{ ingredientId, qty }] } */
router.put('/dishes/:id/recipe', async (req, res) => {
  const { items } = recipeSchema.parse(req.body);
  res.json(await menuAdminService.setRecipe(idParam(req.params.id), items, req.user, req.ip));
});

module.exports = router;