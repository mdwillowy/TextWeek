import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  fullName: '',
  dateOfBirth: '',
  gender: 'prefer_not_to_say',
  username: '',
  password: '',
  phoneNumber: '',
};

function SignupForm() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const helper = useMemo(
    () => ({
      username: 'Use 3-20 lowercase letters, numbers, dots, or underscores.',
      password: 'Must be at least 8 characters with at least one letter and one number.',
      phoneNumber: 'Optional for now. Use international format (example: +15551234567).',
    }),
    []
  );

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setServerError('');

    try {
      await signup({ ...form, username: form.username.toLowerCase().trim() });
      navigate('/home');
    } catch (err) {
      const payload = err?.response?.data;
      if (payload?.errors) {
        const mapped = {};
        payload.errors.forEach((item) => {
          mapped[item.field] = item.message;
        });
        setErrors(mapped);
      } else {
        if (!err?.response) {
          setServerError('Cannot reach server. Check that backend is running and CLIENT_ORIGIN matches your frontend URL.');
        } else {
          setServerError(payload?.message || 'Unable to create account right now.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label>
        Full name
        <input
          value={form.fullName}
          onChange={(e) => setField('fullName', e.target.value)}
          placeholder="Enter your full name"
          required
        />
      </label>
      {errors.fullName && <p className="field-error">{errors.fullName}</p>}

      <label>
        Date of birth
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => setField('dateOfBirth', e.target.value)}
          required
        />
      </label>
      {errors.dateOfBirth && <p className="field-error">{errors.dateOfBirth}</p>}

      <label>
        Gender
        <select value={form.gender} onChange={(e) => setField('gender', e.target.value)} required>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </label>
      {errors.gender && <p className="field-error">{errors.gender}</p>}

      <label>
        Username
        <input
          value={form.username}
          onChange={(e) => setField('username', e.target.value)}
          placeholder="Choose your username"
          autoCapitalize="off"
          required
        />
      </label>
      <p className="field-helper">{helper.username}</p>
      {errors.username && <p className="field-error">{errors.username}</p>}

      <label>
        Password
        <div className="password-field-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="Create a strong password"
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="password-toggle-icon">
                <path
                  d="M2.2 3.3a1 1 0 0 1 1.4-1.4l17.1 17.1a1 1 0 1 1-1.4 1.4l-2.7-2.7A11.7 11.7 0 0 1 12 18.5C6.8 18.5 2.9 14.8 1.2 12.4a1 1 0 0 1 0-1.2c.9-1.4 2.7-3.5 5.4-5l-4.4-4.4Zm12.9 12.9-1.8-1.8a3.5 3.5 0 0 1-4.7-4.7L7.2 8.3A10.6 10.6 0 0 0 3.2 12c1.5 1.9 4.7 4.5 8.8 4.5 1 0 2.1-.1 3.1-.3Zm-5.1-8.6 4.4 4.4a3.5 3.5 0 0 0-4.4-4.4Zm2-3.1c5.2 0 9.1 3.7 10.8 6.1a1 1 0 0 1 0 1.2 17 17 0 0 1-3.5 3.8l-1.5-1.5a14 14 0 0 0 2.9-2.9c-1.5-2-4.7-4.7-8.8-4.7-.7 0-1.4.1-2.1.2L8 5.1c1.2-.4 2.6-.6 4-.6Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="password-toggle-icon">
                <path
                  d="M12 5.5c5.2 0 9.1 3.7 10.8 6.1a1 1 0 0 1 0 1.2c-1.7 2.4-5.6 6.1-10.8 6.1S2.9 15.2 1.2 12.8a1 1 0 0 1 0-1.2C2.9 9.2 6.8 5.5 12 5.5Zm0 11.4c4.1 0 7.3-2.7 8.8-4.7-1.5-2-4.7-4.7-8.8-4.7S4.7 10.2 3.2 12.2c1.5 2 4.7 4.7 8.8 4.7Zm0-8.4a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Zm0 2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z"
                  fill="currentColor"
                />
              </svg>
            )}
            <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
          </button>
        </div>
      </label>
      <p className="field-helper">{helper.password}</p>
      {errors.password && <p className="field-error">{errors.password}</p>}

      <label>
        Phone number (optional)
        <input
          value={form.phoneNumber}
          onChange={(e) => setField('phoneNumber', e.target.value)}
          placeholder="+15551234567"
        />
      </label>
      <p className="field-helper">{helper.phoneNumber}</p>
      {errors.phoneNumber && <p className="field-error">{errors.phoneNumber}</p>}

      {serverError && <p className="submit-error">{serverError}</p>}

      <button className="btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}

export default SignupForm;
