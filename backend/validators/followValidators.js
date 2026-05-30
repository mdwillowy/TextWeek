import mongoose from 'mongoose';
import { param, query } from 'express-validator';

function objectIdValidator(fieldName) {
  return param(fieldName).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid user id');
    }
    return true;
  });
}

export const targetUserIdValidator = [objectIdValidator('targetUserId')];
export const followerUserIdValidator = [objectIdValidator('followerUserId')];

export const followListValidator = [
  objectIdValidator('userId'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50'),
];

export const followStatusValidator = [objectIdValidator('userId')];
