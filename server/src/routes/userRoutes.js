const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { idParam } = require('../utils/validate');
const userService = require('../services/userService');

router.use(authenticate, authorize('manager'));

const ROLES = ['manager', 'cashier', 'waiter', 'kitchen'];
const password = z.string().min(8).max(100)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a digit');

const createSchema = z.object({
  full_name: z.string().trim().min(3).max(100),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,50}$/, 'Use 3-50 letters, digits, . _ -'),
  password,
  role: z.enum(ROLES),
});

const updateSchema = z.object({
  full_name: z.string().trim().min(3).max(100).optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });

/** GET /api/users -> all staff accounts (never includes password hashes) */
router.get('/', async (req, res) => res.json(await userService.list()));

/** POST /api/users { full_name, username, password, role } */
router.post('/', async (req, res) => {
  res.status(201).json(await userService.create(createSchema.parse(req.body), req.user, req.ip));
});

/** PATCH /api/users/:id { full_name?, role?, is_active? } */
router.patch('/:id', async (req, res) => {
  res.json(await userService.update(idParam(req.params.id), updateSchema.parse(req.body), req.user, req.ip));
});

/** POST /api/users/:id/reset-password { password } */
router.post('/:id/reset-password', async (req, res) => {
  const body = z.object({ password }).parse(req.body);
  res.json(await userService.resetPassword(idParam(req.params.id), body.password, req.user, req.ip));
});

module.exports = router;