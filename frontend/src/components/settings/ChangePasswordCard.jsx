import { useState } from 'react';
import { changePassword } from '../../api/settings';

const passwordRule = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function ChangePasswordCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetForm() {
    setIsVerified(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function handleToggle() {
    setMessage('');
    setError('');
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        resetForm();
      }
      return next;
    });
  }

  function handleContinue(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!currentPassword.trim()) {
      setError('Current password is required');
      return;
    }

    setIsVerified(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!currentPassword.trim()) {
      setError('Current password is required');
      return;
    }
    if (!newPassword.trim()) {
      setError('New password is required');
      return;
    }
    if (newPassword.length < 8 || !passwordRule.test(newPassword)) {
      setError('New password must be at least 8 characters and include a letter and number');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await changePassword({ currentPassword, newPassword });
      setMessage(response?.message || 'Password updated successfully');
      resetForm();
      setIsOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update password');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="settings-card password-change">
      <div className="settings-card-head">
        <div>
          <h2>Change Password</h2>
          <p>Verify your current password before setting a new one.</p>
        </div>
        <button className="btn-primary password-change-toggle" type="button" onClick={handleToggle}>
          {isOpen ? 'Close' : 'Change'}
        </button>
      </div>

      {isOpen && (
        <form className="password-change-form" onSubmit={isVerified ? handleSubmit : handleContinue}>
          <div className="settings-form-row">
            <label className="settings-field">
              <span>Current Password</span>
              <div className="password-field-wrap">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowCurrent((prev) => !prev)}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  title={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? (
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
                  <span className="sr-only">{showCurrent ? 'Hide password' : 'Show password'}</span>
                </button>
              </div>
            </label>

            {!isVerified && (
              <button className="btn-primary" type="submit" disabled={isSubmitting}>
                Continue
              </button>
            )}
          </div>

          {isVerified && (
            <>
              <label className="settings-field">
                <span>New Password</span>
                <div className="password-field-wrap">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNew((prev) => !prev)}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    title={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? (
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
                    <span className="sr-only">{showNew ? 'Hide password' : 'Show password'}</span>
                  </button>
                </div>
              </label>

              <label className="settings-field">
                <span>Confirm New Password</span>
                <div className="password-field-wrap">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    title={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? (
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
                    <span className="sr-only">{showConfirm ? 'Hide password' : 'Show password'}</span>
                  </button>
                </div>
              </label>
            </>
          )}

          {isVerified && (
            <div className="password-change-actions">
              <button className="btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}
        </form>
      )}

      {message && <p className="save-message">{message}</p>}
      {error && <p className="submit-error">{error}</p>}
    </section>
  );
}

export default ChangePasswordCard;
