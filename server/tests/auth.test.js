import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

afterAll(async () => {
  await db.destroy(); // close the DB pool so the test process can exit
});

const login = (username, password) =>
  request(app).post('/api/auth/login').send({ username, password });

describe('Auth: login', () => {
  it('logs in with valid credentials and never returns the password hash', async () => {
    const res = await login('manager', 'Manager@123');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('manager');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login('manager', 'WrongPass@1');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown user with the same 401 message', async () => {
    const res = await login('nobody123', 'Whatever@1');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects invalid input with 400 (server-side validation)', async () => {
    const res = await login('a', '1');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });
});

describe('Auth: role-based access', () => {
  it('blocks requests without a token (401)', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it('allows the manager but blocks the waiter (403) on audit logs', async () => {
    const m = await login('manager', 'Manager@123');
    const w = await login('waiter1', 'Waiter@123');

    const okRes = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${m.body.token}`);
    expect(okRes.status).toBe(200);
    expect(Array.isArray(okRes.body)).toBe(true);

    const noRes = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${w.body.token}`);
    expect(noRes.status).toBe(403);
  });
});