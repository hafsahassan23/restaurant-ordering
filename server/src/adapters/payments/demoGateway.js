/**
 * DEMO payment provider. No money moves and no real provider is called.
 * Same interface a real integration must implement (see ./index.js):
 *   chargeMobile({ method, phone, amount })  -> { ok, reference } | { ok: false, reference, reason }
 *   chargeCard({ brand, last4, amount })      -> same
 *   newReference(method)                     -> unique transaction reference
 *
 * Demo rules, so failures can be shown on purpose:
 *   - a mobile number ending in 0000 is declined ("insufficient balance")
 *   - card 4000 0000 0000 0002 is declined ("card declined")
 */
const crypto = require('crypto');

const PREFIX = { evc_plus: 'EVC', edahab: 'EDH', zaad: 'ZAD', waafi: 'WFI', qr: 'QR', card: 'CRD' };

/** e.g. "EVC-20261110-7F3A9C21": method, date, 8 random hex characters. */
exports.newReference = (method) => {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${PREFIX[method] || 'PAY'}-${day}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

exports.chargeMobile = async ({ method, phone }) => {
  const reference = exports.newReference(method);
  if (phone.endsWith('0000')) return { ok: false, reference, reason: 'Insufficient balance (demo)' };
  return { ok: true, reference };
};

exports.chargeCard = async ({ last4, number }) => {
  const reference = exports.newReference('card');
  if (number === '4000000000000002' || last4 === '0002') return { ok: false, reference, reason: 'Card declined (demo)' };
  return { ok: true, reference };
};

exports.mode = 'demo';
