const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const billService = require('../services/billService');

const STAFF = ['cashier', 'waiter', 'manager'];

/** GET /api/bills/service-charge -> { pct } */
router.get('/service-charge', authenticate, authorize(...STAFF), async (req, res) => {
  res.json({ pct: await billService.getServiceCharge() });
});

/** PUT /api/bills/service-charge { pct } (manager only) */
router.put('/service-charge', authenticate, authorize('manager'), async (req, res) => {
  const { pct } = z.object({ pct: z.number().min(0).max(30) }).parse(req.body);
  res.json({ pct: await billService.setServiceCharge(pct, req.user, req.ip) });
});

/** GET /api/bills/table/:tableId -> open bill of the table, or null */
router.get('/table/:tableId', authenticate, authorize(...STAFF), async (req, res) => {
  res.json(await billService.openBillForTable(idParam(req.params.tableId)));
});

/** POST /api/bills/table/:tableId -> create the bill (201) or return the open one (200) */
router.post('/table/:tableId', authenticate, authorize(...STAFF), async (req, res) => {
  const { bill, created } = await billService.createBill(idParam(req.params.tableId), req.user, req.ip);
  res.status(created ? 201 : 200).json(bill);
});

/** GET /api/bills/:id -> bill (also used for the receipt) */
router.get('/:id', authenticate, authorize(...STAFF), async (req, res) => {
  res.json(await billService.getBillView(idParam(req.params.id)));
});

const splitSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('equal'), people: z.number().int().min(2).max(20) }),
  z.object({
    mode: z.literal('items'),
    groups: z.array(z.array(z.number().int().positive()).min(1)).min(2).max(20),
  }),
]);

/** POST /api/bills/:id/splits  { mode: 'equal', people } or { mode: 'items', groups: [[itemId,...],...] } */
router.post('/:id/splits', authenticate, authorize(...STAFF), async (req, res) => {
  const body = splitSchema.parse(req.body);
  res.status(201).json(await billService.createSplits(idParam(req.params.id), body, req.user, req.ip));
});

const paySchema = z.object({
  method: z.enum(['cash', 'evc_plus', 'zaad', 'edahab']),
  splitId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  amountGiven: z.number().positive().optional(),
  phone: z.string().regex(/^\+?\d{7,15}$/).optional(),
});

/** POST /api/bills/:id/payments (cashier or manager) */
router.post('/:id/payments', authenticate, authorize('cashier', 'manager'), async (req, res) => {
  const body = paySchema.parse(req.body);
  res.status(201).json(await billService.pay(idParam(req.params.id), body, req.user, req.ip));
});

module.exports = router;