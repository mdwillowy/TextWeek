import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../../socket/socketClient';
import { requestAccountDeletion, updateMySettings } from '../../api/settings';
import ChangePasswordCard from './ChangePasswordCard';
import PrivacySettings from './PrivacySettings';
import DangerZone from './DangerZone';
import ReportUserCard from './ReportUserCard';

function SettingsPanel({ mode = 'page' }) {
  const { user, accessToken, setUser, logoutAll } = useAuth();
  const settingsFromUser = useMemo(
    () => ({
      readReceiptsEnabled: user?.settings?.readReceiptsEnabled ?? true,
      showOnlineStatus: user?.settings?.showOnlineStatus ?? true,
      theme: user?.settings?.theme || 'system',
    }),
    [user?.settings?.readReceiptsEnabled, user?.settings?.showOnlineStatus, user?.settings?.theme]
  );
  const [settings, setSettings] = useState(settingsFromUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lastSavedRef = useRef(settingsFromUser);
  const autoSaveTimerRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setSettings(settingsFromUser);
    lastSavedRef.current = settingsFromUser;
  }, [user, settingsFromUser]);

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

  async function handleSaveSettings(nextSettings = settings) {
    const previousShowOnlineStatus = user?.settings?.showOnlineStatus ?? true;
    const previousReadReceipts = user?.settings?.readReceiptsEnabled ?? true;
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await updateMySettings({
        readReceiptsEnabled: nextSettings.readReceiptsEnabled,
        showOnlineStatus: nextSettings.showOnlineStatus,
        theme: nextSettings.theme,
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
            ...nextSettings,
          },
        };
      });
      lastSavedRef.current = nextSettings;
      const presenceChanged = previousShowOnlineStatus !== nextSettings.showOnlineStatus;
      const readReceiptsChanged = previousReadReceipts !== nextSettings.readReceiptsEnabled;
      if (presenceChanged || readReceiptsChanged) {
        const socket = getSocket();
        if (socket?.connected) {
          disconnectSocket();
        }
        if (accessToken) {
          connectSocket(accessToken);
        }
      }
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!user) return undefined;

    const lastSaved = lastSavedRef.current || {};
    const isDirty =
      settings.readReceiptsEnabled !== lastSaved.readReceiptsEnabled ||
      settings.showOnlineStatus !== lastSaved.showOnlineStatus ||
      settings.theme !== lastSaved.theme;

    if (!isDirty || isSaving) {
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveSettings(settings);
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [settings, user, isSaving]);

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

      <ChangePasswordCard />

      <div className="settings-section-divider" aria-hidden="true" />

      <section className="settings-card">
        <div className="settings-card-head">
          <div>
            <h2>Session Security</h2>
            <p>Sign out other devices if you suspect a compromised session.</p>
          </div>
          <div className="settings-card-actions settings-card-actions--full">
            <button className="btn-primary" onClick={handleLogoutAllSessions} disabled={isLoggingOutAll}>
              {isLoggingOutAll ? 'Processing...' : 'Log Out All Sessions'}
            </button>
          </div>
        </div>
      </section>

      <div className="settings-section-divider" aria-hidden="true" />

      <DangerZone
        onRequestDeletion={requestAccountDeletion}
        requestedAt={user.deletionRequestedAt}
        actionButtonClassName="btn-primary"
      />

      <div className="settings-section-divider" aria-hidden="true" />

      <ReportUserCard />
    </section>
  );
}

export default SettingsPanel;