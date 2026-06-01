import mongoose from 'mongoose';
import { body, param } from 'express-validator';

const usernameRegex = /^[a-z0-9._]{3,20}$/;

export const reportUserValidator = [
  body('targetUserId')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('targetUserId must be a valid user id');
      }
      return true;
    }),
  body('targetUsername')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer((value) => String(value || '').toLowerCase())
    .matches(usernameRegex)
    .withMessage('targetUsername must be a valid username'),
  body('reason').trim().isLength({ min: 4, max: 120 }).withMessage('reason must be 4-120 characters'),
  body('details').optional().trim().isLength({ max: 1000 }).withMessage('details cannot exceed 1000 characters'),
  body().custom((value) => {
    if (!value?.targetUserId && !value?.targetUsername) {
      throw new Error('targetUserId or targetUsername is required');
    }
    return true;
  }),
];

export const blockTargetValidator = [
  param('targetUserId').custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('targetUserId must be a valid user id');
    }
    return true;
  }),
];
