const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const tableAdminService = require('../services/tableAdminService');

router.use(authenticate, authorize('manager'));

const fields = {
  number: z.number().int().min(1).max(999),
  area: z.string().trim().min(2).max(50),
  seats: z.number().int().min(1).max(50),
};

/** POST /api/admin/tables { number, area, seats, assignedWaiterId? } */
router.post('/', async (req, res) => {
  const body = z.object({ ...fields, assignedWaiterId: z.number().int().positive().optional() }).parse(req.body);
  res.status(201).json(await tableAdminService.create(body, req.user, req.ip));
});

const patchSchema = z.object({
  number: fields.number.optional(),
  area: fields.area.optional(),
  seats: fields.seats.optional(),
  is_closed: z.boolean().optional(),
  assigned_waiter_id: z.number().int().positive().nullable().optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });

/** PATCH /api/admin/tables/:id { number?, area?, seats?, is_closed?, assigned_waiter_id? } */
router.patch('/:id', async (req, res) => {
  res.json(await tableAdminService.update(idParam(req.params.id), patchSchema.parse(req.body), req.user, req.ip));
});

/** POST /api/admin/tables/:id/regenerate-qr -> table with a new token */
router.post('/:id/regenerate-qr', async (req, res) => {
  res.json(await tableAdminService.regenerateQr(idParam(req.params.id), req.user, req.ip));
});

/** DELETE /api/admin/tables/:id (only tables without history) */
router.delete('/:id', async (req, res) => {
  res.json(await tableAdminService.remove(idParam(req.params.id), req.user, req.ip));
});

module.exports = router;