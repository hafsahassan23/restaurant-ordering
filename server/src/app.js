


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');
const AppError = require('./utils/AppError');

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/public', require('./routes/publicRoutes'));   
app.use('/api', require('./routes/orderRoutes'));           
app.use('/api/stock', require('./routes/stockRoutes'));    

app.use('/api/bills', require('./routes/billRoutes'));          
app.use('/api/sms-outbox', require('./routes/smsRoutes'));   

app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/menu-admin', require('./routes/menuAdminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin/tables', require('./routes/tableAdminRoutes'));
app.use('/api/menu-admin', require('./routes/catalogRoutes')); // second router on the same prefix

// General rate limit for the whole API (login has a stricter one of its own)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests', code: 'RATE_LIMIT' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));

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