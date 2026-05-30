import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requestAccountDeletion, updateMySettings } from '../../api/settings';
import PrivacySettings from './PrivacySettings';
import DangerZone from './DangerZone';

function SettingsPanel({ mode = 'page' }) {
  const { user, setUser, logoutAll } = useAuth();
  const [settings, setSettings] = useState(
    user?.settings || {
      showOnlineStatus: true,
      theme: 'system',
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return <div className="screen-loader">Loading settings...</div>;
  }

  async function handleLogoutAllSessions() {
    const confirmed = window.confirm('Log out all active sessions for this account?');
    if (!confirmed) return;

    setMessage('');
    setError('');
    setIsLoggingOutAll(true);
    try {
      await logoutAll();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to log out all sessions');
    } finally {
      setIsLoggingOutAll(false);
    }
  }

  function handleChange(next) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await updateMySettings({
        showOnlineStatus: settings.showOnlineStatus,
        theme: settings.theme,
      });
      const nextUser = response?.data?.user || response?.user;
      setUser((prev) => {
        const previous = prev || {};
        const incoming = nextUser || {};
        return {
          ...previous,
          ...incoming,
          settings: {
            ...(previous.settings || {}),
            ...(incoming.settings || {}),
            ...settings,
          },
        };
      });
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  const rootClassName = mode === 'modal' ? 'dashboard-settings-block' : 'settings-panel';

  return (
    <section className={rootClassName}>
      <PrivacySettings settings={settings} onChange={handleChange} onSave={handleSaveSettings} isSaving={isSaving} />

      {(message || error) && (
        <section className="settings-card">
          {message && <p className="save-message">{message}</p>}
          {error && <p className="submit-error">{error}</p>}
        </section>
      )}

      <div className="settings-section-divider" aria-hidden="true" />

      <section className="settings-card">
        <h2>Privacy Explainer</h2>
        <p>Encrypted chats store ciphertext, nonce, AAD, and key metadata. Message plaintext is decrypted in the client.</p>
        <p>Service metadata still exists for operations: participant IDs, timestamps, and delivery/read state.</p>
        <p>Retention policy: messages are permanently deleted after 7 days by scheduled cleanup.</p>
      </section>

      <div className="settings-section-divider" aria-hidden="true" />

      <section className="settings-card">
        <h2>Session Security</h2>
        <p>Use this if your account was signed in on another device or browser.</p>
        <button className="btn-primary" onClick={handleLogoutAllSessions} disabled={isLoggingOutAll}>
          {isLoggingOutAll ? 'Processing...' : 'Logout All Sessions'}
        </button>
      </section>

      <DangerZone
        onRequestDeletion={requestAccountDeletion}
        requestedAt={user.deletionRequestedAt}
        actionButtonClassName="btn-primary"
      />
    </section>
  );
}

export default SettingsPanel;