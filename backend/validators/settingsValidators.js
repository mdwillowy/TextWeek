import { body } from 'express-validator';

export const updateSettingsValidator = [
  body('readReceiptsEnabled')
    .optional()
    .isBoolean()
    .withMessage('readReceiptsEnabled must be a boolean'),
  body('showOnlineStatus')
    .optional()
    .isBoolean()
    .withMessage('showOnlineStatus must be a boolean'),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('theme must be light, dark, or system'),
  body('themeMode')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('themeMode must be light, dark, or system'),
  body('readReceipts')
    .optional()
    .isBoolean()
    .withMessage('readReceipts must be a boolean'),
  body('readReceiptsEnabled')
    .optional()
    .isBoolean()
    .withMessage('readReceiptsEnabled must be a boolean'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body().custom((value) => {
    const keys = Object.keys(value || {});
    const allowed = ['readReceipts', 'readReceiptsEnabled', 'showOnlineStatus', 'theme', 'themeMode', 'isPrivate'];
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

export const changePasswordValidator = [
  body('currentPassword')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('currentPassword is required'),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('newPassword must be at least 8 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .withMessage('newPassword must include at least one letter and one number'),
  body().custom((value) => {
    const keys = Object.keys(value || {});
    const allowed = ['currentPassword', 'newPassword'];
    const invalid = keys.filter((key) => !allowed.includes(key));
    if (invalid.length > 0) {
      throw new Error(`Unsupported fields: ${invalid.join(', ')}`);
    }
    return true;
  }),
];
