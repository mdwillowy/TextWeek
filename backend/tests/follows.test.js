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

test('follow/unfollow remains idempotent', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'follow_a' });
  const b = await signupAndToken(app, { username: 'follow_b' });

  const firstFollow = await request(app)
    .post(`/api/follows/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(firstFollow.status, 201);

  const secondFollow = await request(app)
    .post(`/api/follows/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(secondFollow.status, 200);
  assert.match(secondFollow.body.message, /Already following/i);

  const firstUnfollow = await request(app)
    .delete(`/api/follows/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(firstUnfollow.status, 200);

  const secondUnfollow = await request(app)
    .delete(`/api/follows/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(secondUnfollow.status, 200);
  assert.match(secondUnfollow.body.message, /Already not following/i);
});
