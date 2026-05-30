import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { closeTestApp, initTestApp, resetDatabase, signupAndToken } from './testHelper.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { runRetention } from '../services/retentionService.js';

test.before(async () => {
  await initTestApp();
});

test.after(async () => {
  await closeTestApp();
});

test.beforeEach(async () => {
  await resetDatabase();
});

test('retention removes only eligible old messages', async () => {
  const app = await initTestApp();
  const a = await signupAndToken(app, { username: 'ret_a' });
  const b = await signupAndToken(app, { username: 'ret_b' });

  const chat = await Chat.create({
    participants: [new mongoose.Types.ObjectId(a.user.id), new mongoose.Types.ObjectId(b.user.id)],
    participantKey: [a.user.id, b.user.id].sort().join(':'),
    chatType: 'direct',
  });

  const oldDate = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
  const newDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  await Message.create({
    chat: chat._id,
    sender: a.user.id,
    text: 'old message',
    createdAt: oldDate,
    readBy: [a.user.id],
  });
  await Message.create({
    chat: chat._id,
    sender: a.user.id,
    text: 'new message',
    createdAt: newDate,
    readBy: [a.user.id],
  });

  const result = await runRetention({ retentionDays: 7, dryRun: false });
  assert.equal(result.deletedCount, 1);

  const remaining = await Message.find({}).lean();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].text, 'new message');
});
