const router = require('express').Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts, try again later', code: 'RATE_LIMIT' },
});

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

/** POST /api/auth/login  body: { username, password }  -> { token, user } */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  res.json(await authService.login(username, password, req.ip));
});

/** GET /api/auth/me -> current user */
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

module.exports = router;