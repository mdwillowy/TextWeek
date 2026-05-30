import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

let mongo;
let app;
let connected = false;
let userCounter = 0;

export async function initTestApp() {
  if (app && connected) {
    return app;
  }

  if (!mongo) {
    mongo = await MongoMemoryServer.create();
  }

  process.env.NODE_ENV = 'test';
  process.env.PORT = process.env.PORT || '5099';
  process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'a8f39c6e1d4b57f9c2a0d1e4f6b8c3d5e7f9a1b2c4d6e8f0a2b4c6d8e0f1a3b';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'b9e27d4c1a6f8b3d5c7a9e1f2d4b6c8a0f1e3d5c7b9a2d4f6c8e0a2b4d6f8c1';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.INTERNAL_JOB_TOKEN =
    process.env.INTERNAL_JOB_TOKEN || 'c7a9e1f3d5b7c9a1e3f5d7b9c1a3e5f7d9b1c3a5e7f9d1b3c5a7e9f1d3b5c7a';

  const { connectDB } = await import('../config/db.js');
  await connectDB();
  connected = true;

  const module = await import('../app.js');
  app = module.default;
  return app;
}

export async function resetDatabase() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
  }
}

export async function closeTestApp() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongo) {
    await mongo.stop();
    mongo = null;
  }

  app = null;
  connected = false;
}

export async function signupAndToken(application, partial = {}) {
  userCounter += 1;
  const username = partial.username || `user_${Date.now()}_${userCounter}`;

  const payload = {
    fullName: partial.fullName || `Test User ${userCounter}`,
    dateOfBirth: partial.dateOfBirth || '2000-01-01',
    gender: partial.gender || 'other',
    username,
    password: partial.password || 'Password123',
    phoneNumber: partial.phoneNumber,
  };

  const res = await request(application).post('/api/auth/signup').send(payload);
  return {
    response: res,
    token: res.body?.data?.accessToken,
    user: res.body?.data?.user,
    payload,
  };
}
