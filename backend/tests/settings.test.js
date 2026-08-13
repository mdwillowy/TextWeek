import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeTestApp, initTestApp, resetDatabase, signupAndToken } from './testHelper.js';

test.before(async () => {
  await initTestApp();
});

test.after(async () => {
  await closeTestApp();
});

test.beforeEach(async () => {
  await resetDatabase();
});

test('settings update validates and persists', async () => {
  const app = await initTestApp();
  const user = await signupAndToken(app, { username: 'settings_user' });

  const invalid = await request(app)
    .patch('/api/users/me/settings')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ theme: 'neon' });
  assert.equal(invalid.status, 400);

  const valid = await request(app)
    .patch('/api/users/me/settings')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ showOnlineStatus: false, readReceipts: false, isPrivate: true, themeMode: 'dark' });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.data.user.settings.theme, 'dark');
  assert.equal(valid.body.data.user.settings.showOnlineStatus, false);
  assert.equal(valid.body.data.user.settings.readReceiptsEnabled, false);
  assert.equal(valid.body.data.user.isPrivate, true);
});

test('account deletion request requires password confirmation', async () => {
  const app = await initTestApp();
  const user = await signupAndToken(app, { username: 'delete_user' });

  const wrong = await request(app)
    .post('/api/users/me/request-deletion')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ password: 'WrongPass123' });
  assert.equal(wrong.status, 401);

  const ok = await request(app)
    .post('/api/users/me/request-deletion')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ password: 'Password123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body?.data?.deletionRequestedAt);
});
