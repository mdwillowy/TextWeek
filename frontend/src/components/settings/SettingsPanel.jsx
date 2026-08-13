import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../../socket/socketClient';
import { requestAccountDeletion, updateMySettings } from '../../api/settings';
import {
  getActivePushSubscription,
  getNotificationPermissionState,
  subscribeToTextweekPush,
  supportsBrowserPush,
  unsubscribeFromTextweekPush,
} from '../../services/textweekPushManager';
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
      isPrivate: Boolean(user?.isPrivate),
    }),
    [user?.settings?.readReceiptsEnabled, user?.settings?.showOnlineStatus, user?.settings?.theme, user?.isPrivate]
  );
  const [settings, setSettings] = useState(settingsFromUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function syncPushState() {
      if (!supportsBrowserPush()) {
        setPushEnabled(false);
        return;
      }

      const permissionState = getNotificationPermissionState();
      if (permissionState !== 'granted') {
        setPushEnabled(false);
        return;
      }

      const activeSubscription = await getActivePushSubscription();
      setPushEnabled(Boolean(activeSubscription));
    }

    void syncPushState();
  }, []);

  useEffect(() => {
    if (!user) return;
    setSettings(settingsFromUser);
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

  async function handleTogglePushNotifications() {
    if (!supportsBrowserPush()) {
      setError('This browser does not support push notifications.');
      return;
    }

    setMessage('');
    setError('');
    setIsTogglingPush(true);

    try {
      if (pushEnabled) {
        const removed = await unsubscribeFromTextweekPush();
        if (removed) {
          setPushEnabled(false);
          setMessage('Browser notifications disabled.');
        } else {
          setError('No browser notification subscription was active.');
        }
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      await subscribeToTextweekPush({ vapidPublicKey });
      setPushEnabled(true);
      setMessage('Browser notifications enabled.');
    } catch (err) {
      setError(err?.message || 'Unable to update browser notifications.');
    } finally {
      setIsTogglingPush(false);
    }
  }

  async function handleSaveSettings(nextSettings = settings) {
    const previousShowOnlineStatus = user?.settings?.showOnlineStatus ?? true;
    const previousReadReceipts = user?.settings?.readReceiptsEnabled ?? true;
    const nextPayload = {
      showOnlineStatus: Boolean(nextSettings.showOnlineStatus),
      readReceipts: Boolean(nextSettings.readReceiptsEnabled ?? nextSettings.readReceipts),
      isPrivate: Boolean(nextSettings.isPrivate),
      themeMode: nextSettings.theme || nextSettings.themeMode || 'system',
    };
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await updateMySettings(nextPayload);
      const nextUser = response?.data?.user || response?.user || null;

      if (nextUser) {
        setUser((prev) => {
          const previous = prev || {};
          const incoming = nextUser || {};
          const mergedSettings = {
            ...(previous.settings || {}),
            ...(incoming.settings || {}),
            readReceiptsEnabled:
              incoming.settings?.readReceiptsEnabled ??
              previous.settings?.readReceiptsEnabled ??
              Boolean(nextSettings.readReceiptsEnabled ?? nextSettings.readReceipts),
            showOnlineStatus:
              incoming.settings?.showOnlineStatus ??
              previous.settings?.showOnlineStatus ??
              Boolean(nextSettings.showOnlineStatus),
            theme: incoming.settings?.theme ?? previous.settings?.theme ?? (nextSettings.theme || 'system'),
          };

          return {
            ...previous,
            ...incoming,
            isPrivate: Boolean(incoming.isPrivate ?? previous.isPrivate ?? nextSettings.isPrivate),
            settings: mergedSettings,
          };
        });
      }

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
      setMessage('Settings updated.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(next) {
    const nextSettings = { ...settings, ...next };
    setSettings(nextSettings);
    void handleSaveSettings(nextSettings);
  }

  const rootClassName = mode === 'modal' ? 'dashboard-settings-block' : 'settings-panel';

  return (
    <section className={rootClassName}>
      <PrivacySettings settings={settings} onChange={handleChange} isSaving={isSaving} />

      <section className="settings-card">
        <div className="settings-card-head settings-card-head--inline-status">
          <h2>Browser Notifications</h2>
          <span className={`settings-notification-status ${pushEnabled ? 'is-enabled' : 'is-disabled'}`} aria-live="polite">
            <span className="settings-notification-status-dot" aria-hidden="true" />
            {pushEnabled ? 'On' : 'Off'}
          </span>
        </div>

        <div className="settings-card-head settings-card-head--compact">
          <p>Receive native browser alerts when someone sends you a direct message while the app is in the background.</p>
          <div className="settings-card-actions settings-card-actions--inline">
            <button
              className="btn-primary btn-primary--thin"
              onClick={handleTogglePushNotifications}
              disabled={isTogglingPush}
              type="button"
            >
              {isTogglingPush ? 'Updating...' : pushEnabled ? 'Disable Notifications' : 'Enable Notifications'}
            </button>
          </div>
        </div>
      </section>

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