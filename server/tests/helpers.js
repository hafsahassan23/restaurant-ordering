import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

export { app, db };

export const loginAs = async (username, password) =>
  (await request(app).post('/api/auth/login').send({ username, password })).body.token;

export const auth = (token) => ({ Authorization: `Bearer ${token}` });