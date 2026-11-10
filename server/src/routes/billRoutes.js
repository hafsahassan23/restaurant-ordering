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

// Shape only; the payment rules (phone per provider, Luhn, expiry, CVV, no cash) are checked in the service
const paySchema = z.object({
  method: z.string().max(20),
  splitId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  phone: z.string().max(25).optional(),
  card: z.object({
    number: z.string().max(25),
    expiry: z.string().max(7),
    cvv: z.string().max(4),
    name: z.string().max(60),
  }).optional(),
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

/**
 * POST /api/bills/:id/payments (cashier or manager): demo payment by phone or card.
 * Body: { method: evc_plus|edahab|zaad|waafi|card, phone? | card?, splitId?, amount?, idempotencyKey }
 * 201 { payment: { reference, status: "SUCCESS", payer_masked }, closed, bill }
 * 400 invalid details (PHONE_FORMAT, PHONE_PROVIDER, PHONE_FAKE, CARD_*, CASH_NOT_ALLOWED) - nothing is recorded
 * 402 PAYMENT_DECLINED (recorded as FAILED, never counts) · 409 PAYMENT_PENDING while a QR payment is open
 */
router.post('/:id/payments', authenticate, authorize('cashier', 'manager'), async (req, res) => {
  const body = paySchema.parse(req.body);
  res.status(201).json(await billService.pay(idParam(req.params.id), body, req.user, req.ip));
});

const qrSchema = z.object({
  splitId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

/** POST /api/bills/:id/qr { splitId?, amount?, idempotencyKey } -> 201 bill with pending_payment { reference, amount, payload } */
router.post('/:id/qr', authenticate, authorize('cashier', 'manager'), async (req, res) => {
  const body = qrSchema.parse(req.body);
  res.status(201).json(await billService.startQr(idParam(req.params.id), body, req.user, req.ip));
});

/** POST /api/bills/qr/:reference/result { outcome: "success" | "failed" } -> simulate the customer's QR payment */
router.post('/qr/:reference/result', authenticate, authorize('cashier', 'manager'), async (req, res) => {
  const reference = z.string().regex(/^QR-\d{8}-[A-F0-9]{8}$/).parse(req.params.reference);
  const { outcome } = z.object({ outcome: z.enum(['success', 'failed']) }).parse(req.body);
  res.json(await billService.finishQr(reference, outcome, req.user, req.ip));
});
/** GET /api/bills?status=paid&limit=50 -> recent bills (cashier, manager) */
router.get('/', authenticate, authorize('cashier', 'manager'), async (req, res) => {
  const query = z.object({
    status: z.enum(['open', 'paid']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }).parse(req.query);
  res.json(await billService.listBills(query));
});
module.exports = router;
