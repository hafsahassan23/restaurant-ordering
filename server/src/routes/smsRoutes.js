const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const smsRepository = require('../repositories/smsRepository');
const smsService = { latest: (n) => smsRepository.latest(n) };

/** GET /api/sms-outbox -> simulated SMS messages (manager only) */
router.get('/', authenticate, authorize('manager'), async (req, res) => {
  res.json(await smsService.latest(100));
});

module.exports = router;