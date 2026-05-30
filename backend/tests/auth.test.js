import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeTestApp, initTestApp, resetDatabase } from './testHelper.js';

test.before(async () => {
  await initTestApp();
});

test.after(async () => {
  await closeTestApp();
});

test.beforeEach(async () => {
  await resetDatabase();
});

test('auth signup/login/refresh flow', async () => {
  const app = await initTestApp();
  const signupPayload = {
    fullName: 'Auth User',
    dateOfBirth: '2000-01-01',
    gender: 'other',
    username: 'auth_user',
    password: 'Password123',
  };

  const signup = await request(app).post('/api/auth/signup').send(signupPayload);
  assert.equal(signup.status, 201);
  assert.equal(signup.body.success, true);
  assert.ok(signup.body?.data?.accessToken);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: signupPayload.username, password: signupPayload.password });
  assert.equal(login.status, 200);
  assert.equal(login.body.success, true);
  assert.ok(login.headers['set-cookie']);

  const refreshCookie = login.headers['set-cookie'][0];
  const refresh = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).send({});
  assert.equal(refresh.status, 200);
  assert.equal(refresh.body.success, true);
  assert.ok(refresh.body?.data?.accessToken);

  const logoutAll = await request(app)
    .post('/api/auth/logout-all')
    .set('Authorization', `Bearer ${login.body?.data?.accessToken}`)
    .send({});
  assert.equal(logoutAll.status, 200);

  const refreshAfterRevoke = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).send({});
  assert.equal(refreshAfterRevoke.status, 419);
});
