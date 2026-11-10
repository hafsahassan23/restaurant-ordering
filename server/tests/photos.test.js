import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app, db, loginAs, auth } from './helpers.js';

// Smallest valid PNG (1x1 pixel)
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const created = [];
let managerToken, waiterToken;

beforeAll(async () => {
  managerToken = await loginAs('manager', 'Manager@123');
  waiterToken = await loginAs('waiter1', 'Waiter@123');
});

afterAll(async () => {
  for (const url of created) fs.rmSync(path.resolve('uploads', url.replace('/uploads/', '')), { force: true });
  await db.destroy();
});

describe('Dish photo upload', () => {
  it('the manager uploads a photo; it is stored, served, and can be saved on a dish', async () => {
    const res = await request(app)
      .post('/api/menu-admin/photos')
      .set(auth(managerToken))
      .send({ dataUrl: `data:image/png;base64,${PNG}` });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/dishes\/[a-f0-9]{24}\.png$/);
    created.push(res.body.url);

    const file = await request(app).get(res.body.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const dish = await db('dishes').first();
    const save = await request(app)
      .put(`/api/menu-admin/dishes/${dish.id}`)
      .set(auth(managerToken))
      .send({
        category_id: dish.category_id, name_so: dish.name_so, name_en: dish.name_en,
        price: Number(dish.price), prep_minutes: dish.prep_minutes, photo_url: res.body.url,
      });
    expect(save.status).toBe(200);
  });

  it('a file that is not really an image is refused', async () => {
    const fake = Buffer.from('<script>alert(1)</script>').toString('base64');
    const res = await request(app)
      .post('/api/menu-admin/photos')
      .set(auth(managerToken))
      .send({ dataUrl: `data:image/png;base64,${fake}` });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHOTO_INVALID');
  });

  it('only the manager can upload photos', async () => {
    const res = await request(app)
      .post('/api/menu-admin/photos')
      .set(auth(waiterToken))
      .send({ dataUrl: `data:image/png;base64,${PNG}` });
    expect(res.status).toBe(403);
  });
});
