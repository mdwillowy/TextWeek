import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri);
  console.log('MongoDB connected successfully');
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function pingDB() {
  if (!isDbConnected()) {
    return false;
  }

  await mongoose.connection.db.admin().ping();
  return true;
}
