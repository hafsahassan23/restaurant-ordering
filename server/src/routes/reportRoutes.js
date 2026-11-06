const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const reportService = require('../services/reportService');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z
  .object({ from: date.optional(), to: date.optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'from must not be after to', path: ['from'] });

/** GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD (manager only) */
router.get('/summary', authenticate, authorize('manager'), async (req, res) => {
  res.json(await reportService.summary(querySchema.parse(req.query)));
});

module.exports = router;