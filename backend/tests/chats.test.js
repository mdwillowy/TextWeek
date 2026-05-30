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

test('direct chat create-or-return-existing', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'chat_a' });
  const b = await signupAndToken(app, { username: 'chat_b' });

  const first = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(first.status, 200);

  const second = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(second.status, 200);

  assert.equal(first.body.data.chat.id, second.body.data.chat.id);
});

test('message send requires auth and participant membership', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'sender_a' });
  const b = await signupAndToken(app, { username: 'sender_b' });
  const c = await signupAndToken(app, { username: 'sender_c' });

  const chatOpen = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  const chatId = chatOpen.body.data.chat.id;

  const unauth = await request(app).post(`/api/chats/${chatId}/messages`).send({ text: 'hello' });
  assert.equal(unauth.status, 401);

  const outsider = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${c.token}`)
    .send({ text: 'blocked' });
  assert.equal(outsider.status, 403);

  const ok = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'valid message' });
  assert.equal(ok.status, 201);
});

test('message send returns directional blocked errors', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'block_sender_a' });
  const b = await signupAndToken(app, { username: 'block_sender_b' });

  const chatOpen = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  const chatId = chatOpen.body.data.chat.id;

  const blockedBySelf = await request(app)
    .post(`/api/moderation/blocks/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(blockedBySelf.status, 201);

  const selfSend = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'hello while self blocked' });
  assert.equal(selfSend.status, 403);
  assert.equal(selfSend.body.code, 'CHAT_BLOCKED_BY_SELF');
  assert.match(String(selfSend.body.message || ''), /unblock first/i);

  const unblock = await request(app)
    .delete(`/api/moderation/blocks/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  assert.equal(unblock.status, 200);

  const blockedByOther = await request(app)
    .post(`/api/moderation/blocks/${a.user.id}`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({});
  assert.equal(blockedByOther.status, 201);

  const otherSend = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'hello while blocked by other' });
  assert.equal(otherSend.status, 403);
  assert.equal(otherSend.body.code, 'CHAT_BLOCKED_BY_OTHER');
  assert.match(String(otherSend.body.message || ''), /blocked by this user/i);
});

test('message edit updates text and enforces ownership', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'edit_sender_a' });
  const b = await signupAndToken(app, { username: 'edit_sender_b' });

  const chatOpen = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  const chatId = chatOpen.body.data.chat.id;

  const sent = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'before edit' });
  assert.equal(sent.status, 201);
  const messageId = sent.body.data.message.id;

  const ownEdit = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'after edit' });
  assert.equal(ownEdit.status, 200);
  assert.equal(ownEdit.body.data.message.text, 'after edit');
  assert.ok(ownEdit.body.data.message.editedAt);

  const otherEdit = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ text: 'not allowed' });
  assert.equal(otherEdit.status, 403);
});

test('message reactions can be toggled per user', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'react_sender_a' });
  const b = await signupAndToken(app, { username: 'react_sender_b' });

  const chatOpen = await request(app)
    .post(`/api/chats/direct/${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({});
  const chatId = chatOpen.body.data.chat.id;

  const sent = await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ text: 'react target' });
  assert.equal(sent.status, 201);
  const messageId = sent.body.data.message.id;

  const addReaction = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}/reactions`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ emoji: '🔥' });
  assert.equal(addReaction.status, 200);
  assert.equal(addReaction.body.data.reacted, true);
  assert.equal(addReaction.body.data.message.reactions[0].emoji, '🔥');
  assert.equal(addReaction.body.data.message.reactions[0].count, 1);

  const removeReaction = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}/reactions`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ emoji: '🔥' });
  assert.equal(removeReaction.status, 200);
  assert.equal(removeReaction.body.data.reacted, false);
  assert.equal((removeReaction.body.data.message.reactions || []).length, 0);

  const addHeart = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}/reactions`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ emoji: '❤️' });
  assert.equal(addHeart.status, 200);
  assert.equal(addHeart.body.data.reacted, true);
  assert.equal(addHeart.body.data.message.reactions.length, 1);
  assert.equal(addHeart.body.data.message.reactions[0].emoji, '❤️');

  const switchToLaugh = await request(app)
    .patch(`/api/chats/${chatId}/messages/${messageId}/reactions`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ emoji: '😂' });
  assert.equal(switchToLaugh.status, 200);
  assert.equal(switchToLaugh.body.data.reacted, true);
  assert.equal(switchToLaugh.body.data.message.reactions.length, 1);
  assert.equal(switchToLaugh.body.data.message.reactions[0].emoji, '😂');
  assert.equal(switchToLaugh.body.data.message.reactions[0].count, 1);
});
