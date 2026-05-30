import { body, query } from 'express-validator';

export const updateProfileValidator = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Full name must be between 2 and 80 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Bio must be 200 characters or fewer'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Please choose a valid gender option'),
  body('avatarUrl')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Avatar URL is too long')
    .custom((value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Avatar URL must be a valid URL');
      }
    }),
  body().custom((value) => {
    const keys = Object.keys(value || {});
    const allowed = ['fullName', 'bio', 'gender', 'avatarUrl'];
    const invalid = keys.filter((k) => !allowed.includes(k));

    if (invalid.length > 0) {
      throw new Error(`Unsupported fields: ${invalid.join(', ')}`);
    }

    return true;
  }),
];

export const searchUsersValidator = [
  query('username')
    .trim()
    .notEmpty()
    .withMessage('username query is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('username query must be between 1 and 20 characters')
    .customSanitizer((v) => v.toLowerCase()),
];
