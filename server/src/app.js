/**
 * Express application: security middleware, routes and the global error handler.
 * Order matters: CORS and rate limiting must run before any router, otherwise
 * routers answer first and those middlewares never apply.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');
const AppError = require('./utils/AppError');
const origins = require('./origins');
const { UPLOAD_ROOT } = require('./services/photoService');

const app = express();

app.use(helmet());
// Allowed origins: this computer and the restaurant's local network (phones scanning a QR code)
app.use(cors({ origin: origins }));

// Uploaded dish photos. The app runs on another port, so allow cross-origin <img> loading.
app.use(
  '/uploads',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(UPLOAD_ROOT, { maxAge: '7d', index: false, dotfiles: 'deny' }),
);

// General rate limit for the whole API (login and public orders have stricter ones of their own)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests', code: 'RATE_LIMIT' },
});
app.use('/api', apiLimiter);

// Photo upload has its own, larger body limit, so it is mounted before the global JSON parser
app.use('/api/menu-admin/photos', require('./routes/photoRoutes'));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/bills', require('./routes/billRoutes'));
app.use('/api/sms-outbox', require('./routes/smsRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/menu-admin', require('./routes/menuAdminRoutes'));
app.use('/api/menu-admin', require('./routes/catalogRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin/tables', require('./routes/tableAdminRoutes'));
app.use('/api', require('./routes/orderRoutes')); // /tables, /orders, /kitchen, /items

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

// Global error handler: the only place errors become JSON responses
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid input', code: 'VALIDATION',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error', code: 'SERVER_ERROR' });
});

module.exports = app;
