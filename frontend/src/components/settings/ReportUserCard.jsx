import { useState } from 'react';
import { reportUser } from '../../api/moderation';

function ReportUserCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleToggle() {
    setMessage('');
    setError('');
    setIsOpen((prev) => !prev);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    const normalizedUsername = username.trim().replace(/^@/, '');
    if (!normalizedUsername) {
      setError('Username is required');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await reportUser({
        username: normalizedUsername,
        reason: reason.trim(),
        details: details.trim(),
      });
      setMessage(response?.message || 'Report submitted');
      setUsername('');
      setReason('');
      setDetails('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to submit report');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <div>
          <h2>Report User</h2>
          <p>Send a report to admins for review.</p>
        </div>
        <button className="btn-primary report-toggle" type="button" onClick={handleToggle}>
          {isOpen ? 'Close' : 'Report'}
        </button>
      </div>

      {isOpen && (
        <>
          <form className="report-form" onSubmit={handleSubmit}>
            <label className="settings-field">
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                autoComplete="off"
              />
            </label>

            <label className="settings-field">
              <span>Reason</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Short reason"
              />
            </label>

            <label className="settings-field">
              <span>Details (optional)</span>
              <textarea
                rows={3}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Add any additional context"
              />
            </label>

            <div className="settings-card-actions settings-card-actions--full">
              <button className="btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>

          {message && <p className="save-message">{message}</p>}
          {error && <p className="submit-error">{error}</p>}
        </>
      )}
    </section>
  );
}

export default ReportUserCard;
