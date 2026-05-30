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

test('key bundle validates upload and fetches by user', async () => {
  const app = await initTestApp();
  const user = await signupAndToken(app, { username: 'keys_user' });

  const invalid = await request(app)
    .put('/api/keys/bundle')
    .set('Authorization', `Bearer ${user.token}`)
    .send({});
  assert.equal(invalid.status, 400);

  const bundle = {
    identityPublicKey: 'identity_public_key_example_12345',
    signedPreKey: {
      keyId: 1,
      publicKey: 'signed_prekey_public',
      signature: 'signed_prekey_signature',
    },
    oneTimePreKeys: [{ keyId: 2, publicKey: 'otk_public', signature: '', used: false }],
  };

  const put = await request(app)
    .put('/api/keys/bundle')
    .set('Authorization', `Bearer ${user.token}`)
    .send(bundle);
  assert.equal(put.status, 200);

  const get = await request(app)
    .get(`/api/keys/bundle/${user.user.id}`)
    .set('Authorization', `Bearer ${user.token}`)
    .send();
  assert.equal(get.status, 200);
  assert.equal(get.body.data.bundle.userId, user.user.id);
});
