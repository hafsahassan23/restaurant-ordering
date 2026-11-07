const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const catalog = require('../services/catalogService');

router.use(authenticate, authorize('manager'));

const name = z.string().trim().min(2).max(120);

// ---- categories
const categorySchema = z.object({ name_so: name, name_en: name, sort_order: z.number().int().min(0).max(999).optional() });

/** POST /api/menu-admin/categories { name_so, name_en, sort_order? } */
router.post('/categories', async (req, res) => {
  res.status(201).json(await catalog.createCategory(categorySchema.parse(req.body), req.user, req.ip));
});
/** PATCH /api/menu-admin/categories/:id */
router.patch('/categories/:id', async (req, res) => {
  res.json(await catalog.updateCategory(idParam(req.params.id), categorySchema.partial().parse(req.body), req.user, req.ip));
});
/** DELETE /api/menu-admin/categories/:id (only empty categories) */
router.delete('/categories/:id', async (req, res) => {
  res.json(await catalog.deleteCategory(idParam(req.params.id), req.user, req.ip));
});

// ---- dishes
const dishSchema = z.object({
  category_id: z.number().int().positive(),
  name_so: name,
  name_en: name,
  description_so: z.string().trim().max(500).optional(),
  description_en: z.string().trim().max(500).optional(),
  price: z.number().positive().max(10000),
  photo_url: z.string().trim().max(255).regex(/^(https?:\/\/|\/)/).optional().or(z.literal('')),
  prep_minutes: z.number().int().min(1).max(240).default(10),
});

/** POST /api/menu-admin/dishes -> new dish (unavailable until it has a recipe and is switched on) */
router.post('/dishes', async (req, res) => {
  res.status(201).json(await catalog.createDish(dishSchema.parse(req.body), req.user, req.ip));
});
/** PUT /api/menu-admin/dishes/:id -> replace the dish details */
router.put('/dishes/:id', async (req, res) => {
  res.json(await catalog.updateDish(idParam(req.params.id), dishSchema.parse(req.body), req.user, req.ip));
});
/** DELETE /api/menu-admin/dishes/:id (only dishes never ordered) */
router.delete('/dishes/:id', async (req, res) => {
  res.json(await catalog.deleteDish(idParam(req.params.id), req.user, req.ip));
});
/** GET /api/menu-admin/dishes/:id/detail -> dish with modifier groups, modifiers and their ingredients */
router.get('/dishes/:id/detail', async (req, res) => {
  res.json(await catalog.getDishDetail(idParam(req.params.id)));
});

// ---- modifier groups
const groupSchema = z.object({
  name_so: name,
  name_en: name,
  is_required: z.boolean().default(false),
  min_select: z.number().int().min(0).max(20).default(0),
  max_select: z.number().int().min(1).max(20).default(1),
})
  .refine((g) => g.min_select <= g.max_select, { message: 'min_select must not be above max_select', path: ['min_select'] })
  .refine((g) => !g.is_required || g.min_select >= 1, { message: 'A required group needs min_select of at least 1', path: ['min_select'] });

/** POST /api/menu-admin/dishes/:id/groups */
router.post('/dishes/:id/groups', async (req, res) => {
  res.status(201).json(await catalog.createGroup(idParam(req.params.id), groupSchema.parse(req.body), req.user, req.ip));
});
/** PUT /api/menu-admin/groups/:id */
router.put('/groups/:id', async (req, res) => {
  res.json(await catalog.updateGroup(idParam(req.params.id), groupSchema.parse(req.body), req.user, req.ip));
});
/** DELETE /api/menu-admin/groups/:id */
router.delete('/groups/:id', async (req, res) => {
  res.json(await catalog.deleteGroup(idParam(req.params.id), req.user, req.ip));
});

// ---- modifiers
const modifierSchema = z.object({
  name_so: name,
  name_en: name,
  price_delta: z.number().min(-100).max(100).default(0),
  ingredients: z
    .array(z.object({ ingredientId: z.number().int().positive(), qty: z.number().positive().max(1000) }))
    .max(20)
    .default([])
    .refine((a) => new Set(a.map((i) => i.ingredientId)).size === a.length, { message: 'Duplicate ingredient' }),
});

/** POST /api/menu-admin/groups/:id/modifiers { name_so, name_en, price_delta, ingredients } */
router.post('/groups/:id/modifiers', async (req, res) => {
  res.status(201).json(await catalog.createModifier(idParam(req.params.id), modifierSchema.parse(req.body), req.user, req.ip));
});
/** PUT /api/menu-admin/modifiers/:id */
router.put('/modifiers/:id', async (req, res) => {
  res.json(await catalog.updateModifier(idParam(req.params.id), modifierSchema.parse(req.body), req.user, req.ip));
});
/** DELETE /api/menu-admin/modifiers/:id */
router.delete('/modifiers/:id', async (req, res) => {
  res.json(await catalog.deleteModifier(idParam(req.params.id), req.user, req.ip));
});

module.exports = router;