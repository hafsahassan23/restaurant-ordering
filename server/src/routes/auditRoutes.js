const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const auditService = require('../services/auditService');

/** GET /api/audit-logs  (manager only) -> latest 100 sensitive actions */
router.get('/', authenticate, authorize('manager'), async (req, res) => {
  res.json(await auditService.latest(100));
});

module.exports = router;