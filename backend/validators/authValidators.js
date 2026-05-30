import { body } from 'express-validator';

const usernameRegex = /^[a-z0-9._]{3,20}$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

function ageAtLeast13(value) {
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return false;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  const dayDiff = now.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 13;
}

export const signupValidator = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 80 })
    .withMessage('Full name must be between 2 and 80 characters'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom(ageAtLeast13)
    .withMessage('You must be at least 13 years old'),
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Please choose a valid gender option'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .customSanitizer((v) => v.toLowerCase())
    .matches(usernameRegex)
    .withMessage('Username must be 3-20 chars and contain only a-z, 0-9, . or _'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .withMessage('Password must include at least one letter and one number'),
  body('phoneNumber')
    .optional({ values: 'falsy' })
    .trim()
    .matches(phoneRegex)
    .withMessage('Phone number must be a valid international format'),
];

export const loginValidator = [
  body('password').notEmpty().withMessage('Password is required'),
  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer((v) => (v ? v.toLowerCase() : v))
    .matches(usernameRegex)
    .withMessage('Username must be valid'),
  body('phoneNumber')
    .optional({ values: 'falsy' })
    .trim()
    .matches(phoneRegex)
    .withMessage('Phone number must be valid'),
  body().custom((value) => {
    if (!value.username && !value.phoneNumber) {
      throw new Error('Please provide username or phone number');
    }
    return true;
  }),
];
