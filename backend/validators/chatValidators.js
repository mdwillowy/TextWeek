import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

export const directChatValidator = [
  param('otherUserId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid user id');
    }
    return true;
  }),
];

export const chatIdValidator = [
  param('chatId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid chat id');
    }
    return true;
  }),
];

export const getMessagesValidator = [
  ...chatIdValidator,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query('before').optional().isISO8601().withMessage('before must be a valid ISO date'),
];

export const sendMessageValidator = [
  ...chatIdValidator,
  body('encryptionMode')
    .optional()
    .isIn(['plain', 'e2ee'])
    .withMessage('encryptionMode must be plain or e2ee'),
  body('text')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Message cannot exceed 2000 characters'),
  body('replyToMessageId')
    .optional()
    .custom((value) => {
      if (!isObjectId(value)) {
        throw new Error('replyToMessageId must be a valid message id');
      }
      return true;
    }),
  body().custom((value) => {
    const mode = value.encryptionMode === 'e2ee' ? 'e2ee' : 'plain';

    if (mode === 'plain' && !String(value.text || '').trim()) {
      throw new Error('Message text is required in plain mode');
    }

    if (mode === 'e2ee') {
      if (!String(value.encryptedPayload || '').trim()) {
        throw new Error('encryptedPayload is required in e2ee mode');
      }
      if (!String(value.nonce || '').trim()) {
        throw new Error('nonce is required in e2ee mode');
      }
    }

    return true;
  }),
];

export const editMessageValidator = [
  ...chatIdValidator,
  param('messageId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid message id');
    }
    return true;
  }),
  body('text')
    .exists()
    .withMessage('text is required')
    .bail()
    .isString()
    .withMessage('text must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('text must be 1-2000 characters'),
];

export const reactMessageValidator = [
  ...chatIdValidator,
  param('messageId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid message id');
    }
    return true;
  }),
  body('emoji')
    .exists()
    .withMessage('emoji is required')
    .bail()
    .isString()
    .withMessage('emoji must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 16 })
    .withMessage('emoji must be 1-16 characters'),
];

export const deleteMessageValidator = [
  ...chatIdValidator,
  param('messageId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid message id');
    }
    return true;
  }),
];
