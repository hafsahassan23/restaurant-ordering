const smsRepository = require('../repositories/smsRepository');

/**
 * SMS adapter. The simulated version writes to the in-app outbox (sms_outbox table).
 * A real SMS provider would be called here instead.
 */
exports.send = async ({ to, message }) => {
  await smsRepository.insert({ to_phone: to, message, status: 'sent' });
};