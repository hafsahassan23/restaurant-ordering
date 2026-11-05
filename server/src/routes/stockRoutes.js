const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const stockService = require('../services/stockService');

router.use(authenticate, authorize('manager'));

/** GET /api/stock/ingredients -> stock levels with a "low" flag */
router.get('/ingredients', async (req, res) => res.json(await stockService.listIngredients()));

/** GET /api/stock/movements -> latest movements (sale, delivery, waste, adjustment) */
router.get('/movements', async (req, res) => res.json(await stockService.recentMovements(100)));

const movementSchema = z.object({
  ingredientId: z.number().int().positive(),
  qty: z.number().finite(),
  reason: z.enum(['delivery', 'waste', 'adjustment']),
  unitCost: z.number().min(0).optional(),
  note: z.string().max(255).optional(),
}).refine((v) => v.qty !== 0, { message: 'qty must not be 0', path: ['qty'] });

/** POST /api/stock/movements -> record a delivery (with cost), waste or adjustment */
router.post('/movements', async (req, res) => {
  const body = movementSchema.parse(req.body);
  res.json(await stockService.recordMovement({ ...body, user: req.user, ip: req.ip }));
});

module.exports = router;