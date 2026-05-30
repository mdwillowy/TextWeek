import mongoose from 'mongoose';
import { body, param } from 'express-validator';

export const reportUserValidator = [
  body('targetUserId').custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('targetUserId must be a valid user id');
    }
    return true;
  }),
  body('reason').trim().isLength({ min: 4, max: 120 }).withMessage('reason must be 4-120 characters'),
  body('details').optional().trim().isLength({ max: 1000 }).withMessage('details cannot exceed 1000 characters'),
];

export const blockTargetValidator = [
  param('targetUserId').custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('targetUserId must be a valid user id');
    }
    return true;
  }),
];
