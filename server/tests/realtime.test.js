/**
 * Real-time tests over a real Socket.IO server (core challenge: "an order placed at a table
 * appears on the kitchen screen within 1 second", and every screen hears about it).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import http from 'http';
import request from 'supertest';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { app, db, loginAs, auth, dishId, customerOrder, confirm, resetState } from './helpers.js';

// Same module instances the app uses (CommonJS require cache)
const require = createRequire(import.meta.url);
const realtime = require('../src/realtime.js');
const registerSockets = require('../src/sockets/index.js');

let server, io, url, waiterToken, kitchenToken, managerToken, table1;
const clients = [];

/** Open a socket and wait until it is connected (or refused). */
function openSocket(auth) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    clients.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Resolve with the payload of the next `event`, or fail after `ms`. */
const nextEvent = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });

beforeAll(async () => {
  server = http.createServer(app);
  io = new Server(server);
  realtime.setIo(io);
  registerSockets(io);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;

  await db.seed.run();
  waiterToken = await loginAs('waiter1', 'Waiter@123');
  kitchenToken = await loginAs('kitchen', 'Kitchen@123');
  managerToken = await loginAs('manager', 'Manager@123');
  table1 = await db('dining_tables').where({ number: 1 }).first(); // assigned to waiter1
});

beforeEach(resetState);

afterAll(async () => {
  clients.forEach((s) => s.disconnect());
  realtime.setIo(null);
  await new Promise((resolve) => io.close(resolve));
  await db.destroy();
});

describe('Real-time sync', () => {
  it('an order reaches the waiter at once and the kitchen within 1 second of confirmation', async () => {
    const waiter = await openSocket({ token: waiterToken });
    const kitchen = await openSocket({ token: kitchenToken });
    const items = [{ dishId: await dishId('Fried eggs'), quantity: 1, modifierIds: [] }];

    const pending = nextEvent(waiter, 'order:pending');
    const order = await customerOrder(table1, items);
    expect(order.status).toBe(201);
    expect((await pending).id).toBe(order.body.id);

    const started = Date.now();
    const onKitchen = nextEvent(kitchen, 'order:confirmed', 1000);
    expect((await confirm(waiterToken, order.body.id)).status).toBe(200);
    const view = await onKitchen;
    expect(view.id).toBe(order.body.id);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('phones at the table see item status changes live', async () => {
    const phone = await openSocket({ tableToken: table1.token });
    const order = await customerOrder(table1, [{ dishId: await dishId('Fried eggs'), quantity: 1, modifierIds: [] }]);
    await confirm(waiterToken, order.body.id);
    const item = await db('order_items').where({ order_id: order.body.id }).first();

    const update = nextEvent(phone, 'item:updated');
    await request(app).patch(`/api/items/${item.id}/status`).set(auth(kitchenToken)).send({ status: 'cooking' });
    expect(await update).toMatchObject({ itemId: item.id, status: 'cooking' });
  });

  it('a regenerated QR disconnects phones that used the old token', async () => {
    const table = await db('dining_tables').where({ number: 3 }).first();
    const phone = await openSocket({ tableToken: table.token });
    const dropped = nextEvent(phone, 'disconnect');

    const res = await request(app).post(`/api/admin/tables/${table.id}/regenerate-qr`).set(auth(managerToken));
    expect(res.status).toBe(200);
    await dropped;
    await expect(openSocket({ tableToken: table.token })).rejects.toThrow('unauthorized');
  });
});
