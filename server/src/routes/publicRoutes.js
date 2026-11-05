const router = require('express').Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const menuService = require('../services/menuService');
const tableService = require('../services/tableService');
const orderService = require('../services/orderService');
const { itemsSchema } = require('../utils/orderSchemas');

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many orders, slow down', code: 'RATE_LIMIT' },
});

/** GET /api/public/menu -> categories with live availability */
router.get('/menu', async (req, res) => res.json(await menuService.getMenu()));

/** GET /api/public/table/:token -> { number, area, is_closed } */
router.get('/table/:token', async (req, res) => {
  const t = await tableService.getByToken(req.params.token);
  res.json({ number: t.number, area: t.area, is_closed: !!t.is_closed });
});

/** GET /api/public/table/:token/orders -> open orders of that table (shared by all phones) */
router.get('/table/:token/orders', async (req, res) => {
  const t = await tableService.getByToken(req.params.token);
  res.json(await orderService.ordersForTable(t.id));
});

/** POST /api/public/orders { tableToken, items } -> pending order (waiter must confirm) */
router.post('/orders', orderLimiter, async (req, res) => {
  const body = z.object({ tableToken: z.string().min(8).max(64), items: itemsSchema }).parse(req.body);
  const table = await tableService.getByToken(body.tableToken);
  res.status(201).json(await orderService.createOrder({ table, items: body.items, ip: req.ip }));
});

module.exports = router;