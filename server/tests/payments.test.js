/**
 * Demo payments: phone rules per provider, card checks, QR flow, duplicates, and what is stored.
 * All transactions are simulated; these tests make sure only validated payments ever succeed.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import { app, db, loginAs, auth, dishId, servedOrder, resetState } from './helpers.js';

const require = createRequire(import.meta.url);
const v = require('../src/utils/paymentValidation.js');

let cashierToken, waiterToken, kitchenToken, table1;
let seq = 0;
const key = () => `pay-${Date.now()}-${seq++}`;
const pay = (billId, body) => request(app).post(`/api/bills/${billId}/payments`).set(auth(cashierToken)).send({ idempotencyKey: key(), ...body });
const nextYear = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');
const goodCard = { number: '4242 4242 4242 4242', expiry: `12/${nextYear}`, cvv: '123', name: 'Hodan Maxamed' };

async function openBill(qty = 2) {
  await servedOrder({ table: table1, waiterToken, kitchenToken, items: [{ dishId: await dishId('Fried eggs'), quantity: qty }] });
  return (await request(app).post(`/api/bills/table/${table1.id}`).set(auth(cashierToken))).body;
}

beforeAll(async () => {
  cashierToken = await loginAs('cashier', 'Cashier@123');
  waiterToken = await loginAs('waiter1', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  table1 = await db('dining_tables').where({ number: 1 }).first();
});
beforeEach(resetState);
afterAll(() => db.destroy());

describe('Phone number rules (Somalia)', () => {
  it('accepts the supported demo numbers for their own provider, in any common format', () => {
    expect(v.validatePhone('evc_plus', '619011723').ok).toBe(true);
    expect(v.validatePhone('evc_plus', '771843297').ok).toBe(true);
    expect(v.validatePhone('edahab', '629011723').ok).toBe(true);
    expect(v.validatePhone('zaad', '634567891').ok).toBe(true);
    expect(v.validatePhone('waafi', '619011723').ok).toBe(true);
    expect(v.validatePhone('evc_plus', '+252 61 901 1723').national).toBe('619011723');
    expect(v.validatePhone('evc_plus', '00252619011723').national).toBe('619011723');
    expect(v.validatePhone('evc_plus', '0619011723').national).toBe('619011723');
  });

  it('rejects fake, short and wrong-provider numbers with a clear code', () => {
    expect(v.validatePhone('evc_plus', '12345678').code).toBe('PHONE_FORMAT');
    expect(v.validatePhone('evc_plus', '111111111').code).toBe('PHONE_PROVIDER');
    expect(v.validatePhone('evc_plus', '611111111').code).toBe('PHONE_FAKE');
    expect(v.validatePhone('evc_plus', '611234567').code).toBe('PHONE_FAKE');
    expect(v.validatePhone('evc_plus', '61901172a').code).toBe('PHONE_FORMAT');
    expect(v.validatePhone('evc_plus', '').code).toBe('PHONE_REQUIRED');
    const wrong = v.validatePhone('evc_plus', '629011723');
    expect(wrong.code).toBe('PHONE_PROVIDER');
    expect(wrong.suggestion).toBe('edahab');
    expect(v.validatePhone('edahab', '619011723').code).toBe('PHONE_PROVIDER');
    expect(v.validatePhone('zaad', '619011723').code).toBe('PHONE_PROVIDER');
  });
});

describe('Card rules', () => {
  it('checks Luhn, expiry, CVV and name', () => {
    expect(v.validateCard(goodCard).ok).toBe(true);
    expect(v.validateCard(goodCard).masked).toBe('VISA •••• 4242');
    expect(v.validateCard({ ...goodCard, number: '4242 4242 4242 4241' }).code).toBe('CARD_NUMBER');
    expect(v.validateCard({ ...goodCard, expiry: '01/20' }).code).toBe('CARD_EXPIRED');
    expect(v.validateCard({ ...goodCard, expiry: '13/30' }).code).toBe('CARD_EXPIRY');
    expect(v.validateCard({ ...goodCard, cvv: '12' }).code).toBe('CARD_CVV');
    expect(v.validateCard({ ...goodCard, name: ' ' }).code).toBe('CARD_NAME');
    // still valid during its expiry month
    const now = new Date(2026, 10, 15);
    expect(v.validateCard({ ...goodCard, expiry: '11/26' }, now).ok).toBe(true);
    expect(v.validateCard({ ...goodCard, expiry: '10/26' }, now).code).toBe('CARD_EXPIRED');
  });
});

describe('Payment flow (demo)', () => {
  it('rejects 12345678 on the server and records nothing', async () => {
    const bill = await openBill();
    const res = await pay(bill.id, { method: 'evc_plus', phone: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHONE_FORMAT');
    expect(await db('payments')).toHaveLength(0);
    expect((await db('bills').where({ id: bill.id }).first()).status).toBe('open');
  });

  it('only EVC Plus, eDahab, ZAAD, WAAFI, QR and card exist', async () => {
    const bill = await openBill();
    for (const method of ['cash', 'paypal']) {
      const res = await pay(bill.id, { method });
      expect(res.status).toBe(400);
      expect(['CASH_NOT_ALLOWED', 'METHOD_NOT_ALLOWED']).toContain(res.body.code);
    }
    expect(await db('payments')).toHaveLength(0);
  });

  it('a valid card pays; only the brand and last 4 digits are stored, never the number or CVV', async () => {
    const bill = await openBill();
    const bad = await pay(bill.id, { method: 'card', card: { ...goodCard, cvv: '1' } });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('CARD_CVV');

    const res = await pay(bill.id, { method: 'card', card: goodCard });
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('SUCCESS');
    expect(res.body.closed).toBe(true);
    const row = await db('payments').first();
    expect(row.payer_masked).toBe('VISA •••• 4242');
    expect(JSON.stringify(row)).not.toContain('4242424242424242');
    expect(JSON.stringify(row)).not.toContain('"123"');
    const audit = await db('audit_logs').where({ action: 'PAYMENT' }).first();
    expect(audit.details).not.toContain('4242 4242');
  });

  it('the demo decline card fails and the bill stays open', async () => {
    const bill = await openBill();
    const res = await pay(bill.id, { method: 'card', card: { ...goodCard, number: '4000 0000 0000 0002' } });
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('PAYMENT_DECLINED');
    expect((await db('payments').first()).status).toBe('FAILED');
    expect((await db('bills').where({ id: bill.id }).first()).status).toBe('open');
  });

  it('the same submission sent twice pays only once', async () => {
    const bill = await openBill();
    const body = { method: 'evc_plus', phone: '619011723', idempotencyKey: key() };
    const [a, b] = await Promise.all([
      request(app).post(`/api/bills/${bill.id}/payments`).set(auth(cashierToken)).send(body),
      request(app).post(`/api/bills/${bill.id}/payments`).set(auth(cashierToken)).send(body),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect([a.body.duplicate, b.body.duplicate].sort()).toEqual([false, true]);
    expect(await db('payments').where({ status: 'SUCCESS' })).toHaveLength(1);
    const refs = new Set([a.body.payment?.reference, b.body.payment?.reference].filter(Boolean));
    expect(refs.size).toBe(1);
  });

  it('QR: showing the code never pays; the result decides SUCCESS or FAILED, once', async () => {
    const bill = await openBill();
    const started = await request(app).post(`/api/bills/${bill.id}/qr`).set(auth(cashierToken)).send({ idempotencyKey: key() });
    expect(started.status).toBe(201);
    const pending = started.body.pending_payment;
    expect(pending.status).toBe('PENDING');
    expect(pending.reference).toMatch(/^QR-\d{8}-[A-F0-9]{8}$/);
    expect(pending.payload).toContain(`ref=${pending.reference}`);
    expect(pending.payload).toContain(`bill=${bill.id}`);
    expect(pending.payload).toContain('amount=5.25');
    expect(started.body.paid).toBe(0);
    expect(started.body.status).toBe('open');

    // nothing else can be paid while the QR is open
    const blocked = await pay(bill.id, { method: 'evc_plus', phone: '619011723' });
    expect(blocked.body.code).toBe('PAYMENT_PENDING');

    const failed = await request(app).post(`/api/bills/qr/${pending.reference}/result`).set(auth(cashierToken)).send({ outcome: 'failed' });
    expect(failed.body.status).toBe('FAILED');
    expect(failed.body.bill.status).toBe('open');
    const twice = await request(app).post(`/api/bills/qr/${pending.reference}/result`).set(auth(cashierToken)).send({ outcome: 'success' });
    expect(twice.status).toBe(409);

    const again = await request(app).post(`/api/bills/${bill.id}/qr`).set(auth(cashierToken)).send({ idempotencyKey: key() });
    const ref2 = again.body.pending_payment.reference;
    expect(ref2).not.toBe(pending.reference);
    const ok = await request(app).post(`/api/bills/qr/${ref2}/result`).set(auth(cashierToken)).send({ outcome: 'success' });
    expect(ok.body.status).toBe('SUCCESS');
    expect(ok.body.closed).toBe(true);
    expect(ok.body.bill.payments).toHaveLength(1);
  });

  it('every payment gets a unique reference', async () => {
    const bill = await openBill(4);
    const refs = [];
    for (let i = 0; i < 3; i++) refs.push((await pay(bill.id, { method: 'evc_plus', phone: '619011723', amount: 1 })).body.payment.reference);
    expect(new Set(refs).size).toBe(3);
  });
});
