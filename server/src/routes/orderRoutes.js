const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const { itemsSchema } = require('../utils/orderSchemas');
const orderService = require('../services/orderService');
const tableService = require('../services/tableService');

/** GET /api/tables -> floor map data */
router.get('/tables', authenticate, authorize('waiter', 'cashier', 'manager'), async (req, res) => {
  res.json(await tableService.list());
});

/** GET /api/orders/pending -> customer orders waiting for a waiter */
router.get('/orders/pending', authenticate, authorize('waiter', 'manager'), async (req, res) => {
  res.json(await orderService.pendingOrders());
});

/** POST /api/orders { tableId, items } -> waiter enters an order directly (confirmed at once) */
router.post('/orders', authenticate, authorize('waiter', 'manager'), async (req, res) => {
  const body = z.object({ tableId: z.number().int().positive(), items: itemsSchema }).parse(req.body);
  const table = await tableService.getById(body.tableId);
  res.status(201).json(await orderService.createOrder({
    table, items: body.items, user: req.user, autoConfirm: true, ip: req.ip,
  }));
});

/** POST /api/orders/:id/confirm -> send to kitchen + deduct stock */
router.post('/orders/:id/confirm', authenticate, authorize('waiter', 'manager'), async (req, res) => {
  res.json(await orderService.confirmOrder(idParam(req.params.id), req.user, req.ip));
});

/** POST /api/orders/:id/reject { reason? } */
router.post('/orders/:id/reject', authenticate, authorize('waiter', 'manager'), async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(255).optional() }).parse(req.body || {});
  res.json(await orderService.rejectOrder(idParam(req.params.id), reason, req.user, req.ip));
});

/** GET /api/kitchen/orders -> open orders, oldest first (also reloads after reconnect) */
router.get('/kitchen/orders', authenticate, authorize('kitchen', 'waiter', 'manager'), async (req, res) => {
  res.json(await orderService.kitchenOrders());
});

/** PATCH /api/items/:id/status { status: cooking | ready | served } */
router.patch('/items/:id/status', authenticate, authorize('kitchen', 'waiter', 'manager'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['cooking', 'ready', 'served']) }).parse(req.body);
  res.json(await orderService.advanceItem(idParam(req.params.id), status, req.user));
});

/** POST /api/items/:id/cancel { reason } (manager only) */
router.post('/items/:id/cancel', authenticate, authorize('manager'), async (req, res) => {
  const { reason } = z.object({ reason: z.string().min(3).max(255) }).parse(req.body);
  res.json(await orderService.cancelItem(idParam(req.params.id), reason, req.user, req.ip));
});

module.exports = router;