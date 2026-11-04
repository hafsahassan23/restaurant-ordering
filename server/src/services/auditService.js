const auditRepository = require('../repositories/auditRepository');

/**
 * Record who did what and when. Never throws: a logging
 * failure must not break the main action.
 */
exports.log = async ({ userId = null, action, entity = null, entityId = null, details = null, ip = null }) => {
  try {
    await auditRepository.insert({
      user_id: userId, action, entity, entity_id: entityId,
      details: details ? JSON.stringify(details) : null, ip,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

exports.latest = (limit) => auditRepository.latest(limit);