import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setServerError('');
    setIsSubmitting(true);

    try {
      const payload = {
        password,
      };

      if (identity.includes('+') || /^\d/.test(identity)) {
        payload.phoneNumber = identity.trim();
      } else {
        payload.username = identity.toLowerCase().trim();
      }

      await login(payload);
      navigate('/home');
    } catch (err) {
      const apiError = err?.response?.data;
      if (apiError?.errors) {
        const mapped = {};
        apiError.errors.forEach((item) => {
          mapped[item.field] = item.message;
        });
        setErrors(mapped);
      } else {
        setServerError(apiError?.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label>
        Username or phone number
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="username or +15551234567"
          required
        />
      </label>
      {(errors.username || errors.phoneNumber) && (
        <p className="field-error">{errors.username || errors.phoneNumber}</p>
      )}

      <label>
        Password
        <div className="password-field-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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
      {errors.password && <p className="field-error">{errors.password}</p>}

      {serverError && <p className="submit-error">{serverError}</p>}

      <button className="btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}

export default LoginForm;
