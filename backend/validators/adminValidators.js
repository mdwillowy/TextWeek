import mongoose from 'mongoose';
import { param } from 'express-validator';

export const userIdParamValidator = [
  param('userId').custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('userId must be a valid user id');
    }
    return true;
  }),
];
