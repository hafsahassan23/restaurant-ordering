/**
 * Simulated mobile money (EVC Plus, Zaad, eDahab).
 * Interface: charge({ method, phone, amount }) -> { ok, reference }.
 * A real provider would replace this file and keep the same interface.
 * Demo rule: a phone number ending in 0000 is declined.
 */
exports.METHODS = ['evc_plus', 'zaad', 'edahab'];

exports.charge = async ({ method, phone }) => {
  if (phone.endsWith('0000')) return { ok: false, reason: 'Declined (simulated)' };
  const reference = `${method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
  return { ok: true, reference };
};