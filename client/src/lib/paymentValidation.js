/**
 * Client copy of server/src/utils/paymentValidation.js for instant feedback while typing.
 * The server validates everything again; keep both files in sync.
 */
export const PROVIDERS = {
  evc_plus: { name: 'EVC Plus', network: 'Hormuud', prefixes: ['61', '77'] },
  edahab: { name: 'eDahab', network: 'Somtel', prefixes: ['62', '65'] },
  zaad: { name: 'ZAAD', network: 'Telesom', prefixes: ['63'] },
  // WAAFI is a wallet app that works across these networks
  waafi: { name: 'WAAFI', network: 'Hormuud / Telesom / Somtel', prefixes: ['61', '77', '63', '62', '65'] },
};

export const MOBILE_METHODS = Object.keys(PROVIDERS);
export const METHODS = [...MOBILE_METHODS, 'qr', 'card'];

/**
 * Turn what the cashier typed into a 9-digit national number.
 * Accepts spaces, dashes, dots, brackets, "+252", "00252", "252" or a leading "0".
 * Output: "619011723" or null when it cannot be a Somali mobile number.
 */
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let d = raw.trim().replace(/[\s\-.()]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.startsWith('00252')) d = d.slice(5);
  else if (d.startsWith('252') && d.length === 12) d = d.slice(3);
  else if (d.startsWith('0') && d.length === 10) d = d.slice(1);
  return /^\d{9}$/.test(d) ? d : null;
}

/** "Fake" subscriber numbers: all the same digit (1111111) or a straight run (1234567, 7654321). */
export function looksFake(subscriber) {
  if (/^(\d)\1+$/.test(subscriber)) return true;
  const digits = subscriber.split('').map(Number);
  const up = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  const down = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
  return up || down;
}

/** Which provider(s) a national number belongs to, e.g. "62..." -> ["edahab", "waafi"]. */
export const providersFor = (national) => MOBILE_METHODS.filter((m) => PROVIDERS[m].prefixes.includes(national.slice(0, 2)));

/**
 * Validate a mobile money number for one method.
 * Output: { ok: true, national, international } or { ok: false, code, expected?, suggestion? }.
 * Codes: PHONE_REQUIRED, PHONE_FORMAT, PHONE_PROVIDER, PHONE_FAKE.
 */
export function validatePhone(method, raw) {
  if (!raw || !String(raw).trim()) return { ok: false, code: 'PHONE_REQUIRED' };
  const national = normalizePhone(String(raw));
  if (!national) return { ok: false, code: 'PHONE_FORMAT' };
  const provider = PROVIDERS[method];
  if (!provider.prefixes.includes(national.slice(0, 2))) {
    const other = providersFor(national).find((m) => m !== 'waafi');
    return { ok: false, code: 'PHONE_PROVIDER', expected: provider.prefixes, suggestion: other || null };
  }
  if (looksFake(national.slice(2))) return { ok: false, code: 'PHONE_FAKE' };
  return { ok: true, national, international: `252${national}` };
}

/** "61****723": enough for the cashier to recognise it, not enough to reuse it. */
export const maskPhone = (national) => `${national.slice(0, 2)}****${national.slice(-3)}`;

/** Luhn checksum used by every card network. */
export function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function cardBrand(digits) {
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'CARD';
}

/**
 * Validate demo card details. Nothing here is stored except the masked label.
 * Input: { number, expiry ("MM/YY" or "MM/YYYY"), cvv, name }, now (for tests).
 * Output: { ok: true, brand, last4, masked } or { ok: false, code, field }.
 * Codes: CARD_NAME, CARD_NUMBER, CARD_EXPIRY, CARD_EXPIRED, CARD_CVV.
 */
export function validateCard(card, now = new Date()) {
  const c = card || {};
  const name = String(c.name || '').trim();
  if (name.length < 2 || name.length > 60 || !/^[\p{L}][\p{L} .'-]*$/u.test(name)) {
    return { ok: false, code: 'CARD_NAME', field: 'name' };
  }
  const digits = String(c.number || '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits) || !luhnValid(digits)) return { ok: false, code: 'CARD_NUMBER', field: 'number' };

  const m = /^(\d{2})\s*\/\s*(\d{2}|\d{4})$/.exec(String(c.expiry || '').trim());
  if (!m) return { ok: false, code: 'CARD_EXPIRY', field: 'expiry' };
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, code: 'CARD_EXPIRY', field: 'expiry' };
  // A card is valid until the end of its expiry month
  if (new Date(year, month, 1) <= now) return { ok: false, code: 'CARD_EXPIRED', field: 'expiry' };
  if (year > now.getFullYear() + 20) return { ok: false, code: 'CARD_EXPIRY', field: 'expiry' };

  if (!/^\d{3,4}$/.test(String(c.cvv || ''))) return { ok: false, code: 'CARD_CVV', field: 'cvv' };
  const brand = cardBrand(digits);
  const last4 = digits.slice(-4);
  return { ok: true, brand, last4, masked: `${brand} •••• ${last4}` };
}
