import { body } from 'express-validator';

export const updateSettingsValidator = [
  body('showOnlineStatus')
    .optional()
    .isBoolean()
    .withMessage('showOnlineStatus must be a boolean'),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('theme must be light, dark, or system'),
  body().custom((value) => {
    const keys = Object.keys(value || {});
    const allowed = ['showOnlineStatus', 'theme'];
    const invalid = keys.filter((key) => !allowed.includes(key));
    if (invalid.length > 0) {
      throw new Error(`Unsupported fields: ${invalid.join(', ')}`);
    }
    return true;
  }),
];

export const requestDeletionValidator = [
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('password is required'),
];
