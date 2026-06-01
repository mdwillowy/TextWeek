import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ProfileCard from '../components/profile/ProfileCard';
import FollowListModal from '../components/profile/FollowListModal';
import UserSearch from '../components/search/UserSearch';
import ChatStack from '../components/chat/ChatStack';
import SettingsPanel from '../components/settings/SettingsPanel';
import AdminDashboard from './AdminDashboard';

function HomePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [followMode, setFollowMode] = useState('followers');
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [activeDashboardModal, setActiveDashboardModal] = useState('');

  async function handleSaveProfile(payload) {
    setIsSaving(true);
    setSaveMessage('');
    setActionError('');

    try {
      const { avatarFile, ...updates } = payload;
      let latestUser = user;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const uploadResponse = await api.post('/users/me/avatar', formData);
        latestUser = uploadResponse?.data?.data?.user || latestUser;

        // If a file is uploaded and URL was not changed by user, keep uploaded URL.
        if (updates.avatarUrl === user.avatarUrl || updates.avatarUrl === '') {
          delete updates.avatarUrl;
        }
      }

      // Backend validator expects absolute URLs for manual avatarUrl values.
      if (typeof updates.avatarUrl === 'string' && updates.avatarUrl.startsWith('/')) {
        delete updates.avatarUrl;
      }

      // Send only changed fields to avoid unnecessary validator failures.
      const changedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined && value !== null)
      );

      if (typeof changedUpdates.fullName === 'string' && changedUpdates.fullName === user.fullName) {
        delete changedUpdates.fullName;
      }
      if (typeof changedUpdates.bio === 'string' && changedUpdates.bio === (user.bio || '')) {
        delete changedUpdates.bio;
      }
      if (typeof changedUpdates.gender === 'string' && changedUpdates.gender === user.gender) {
        delete changedUpdates.gender;
      }
      if (typeof changedUpdates.avatarUrl === 'string' && changedUpdates.avatarUrl === (user.avatarUrl || '')) {
        delete changedUpdates.avatarUrl;
      }

      if (Object.keys(changedUpdates).length === 0) {
        setSaveMessage('Profile updated successfully.');
        setUser(latestUser);
        return;
      }

      const response = await api.patch('/users/me', changedUpdates);
      const patchedUser = response?.data?.data?.user;
      setUser(patchedUser || latestUser);
      setSaveMessage('Profile updated successfully.');
    } catch (err) {
      setSaveMessage(err?.response?.data?.message || 'Unable to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!user) {
    return <div className="screen-loader">Loading profile...</div>;
  }

  async function handleLogout() {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (!confirmed) return;

    try {
      await logout();
      navigate('/');
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Unable to log out right now.');
    }
  }

  function openDashboardModal(type) {
    setActiveDashboardModal(type);
  }

  function closeDashboardModal() {
    setActiveDashboardModal('');
  }

  function handleOpenFollowList(mode) {
    setFollowMode(mode);
    setIsFollowModalOpen(true);
  }

  return (
    <div className="app-page app-page--app">
      <main className="home-shell">
        <header className="home-topbar chat-topbar">
          <div>
            <Link className="site-brand user-handle-brand" to="/home">
              {user.fullName || `@${user.username}`}
            </Link>
          </div>
          <div className="topbar-actions site-nav topbar-actions-home">
            <button
              className="btn-ghost topbar-action-btn topbar-action-link"
              onClick={() => openDashboardModal('search')}
              aria-label="Search users"
              title="Search users"
            >
              Search
            </button>
            {isAdmin ? (
              <button
                className="btn-ghost topbar-action-btn topbar-action-link"
                onClick={() => openDashboardModal('admin')}
              >
                Admin
              </button>
            ) : null}
            <button className="btn-ghost topbar-action-btn topbar-action-link" onClick={() => openDashboardModal('settings')}>
              Settings
            </button>
            <button className="btn-primary topbar-action-btn topbar-action-btn--strong" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <ProfileCard
          user={user}
          onSaveProfile={handleSaveProfile}
          onOpenFollowList={handleOpenFollowList}
          isSaving={isSaving}
        />
        {saveMessage && <p className="save-message">{saveMessage}</p>}
        {actionError && <p className="submit-error">{actionError}</p>}

        <ChatStack />

        {isFollowModalOpen && (
          <FollowListModal
            mode={followMode}
            userId={user.id}
            onClose={() => setIsFollowModalOpen(false)}
          />
        )}

        {activeDashboardModal && typeof document !== 'undefined'
          ? createPortal(
              <section className="dashboard-overlay" role="presentation" onClick={closeDashboardModal}>
                <article className="dashboard-card landing-modal" onClick={(event) => event.stopPropagation()}>
                  <header className="dashboard-modal-head landing-modal-header">
                    <h3>
                      {activeDashboardModal === 'settings'
                        ? 'Settings'
                        : activeDashboardModal === 'admin'
                          ? 'Admin Dashboard'
                          : 'Search users'}
                    </h3>
                    <button className="landing-modal-close" type="button" onClick={closeDashboardModal} aria-label="Close">
                      <span aria-hidden="true">x</span>
                    </button>
                  </header>

                  <div className="landing-modal-body dashboard-modal-body">
                    {activeDashboardModal === 'search' && <UserSearch hideHeading />}
                    {activeDashboardModal === 'settings' && <SettingsPanel mode="modal" />}
                    {activeDashboardModal === 'admin' && <AdminDashboard />}
                  </div>
                </article>
              </section>,
              document.body
            )
          : null}
      </main>
    </div>
  );
}

export default HomePage;
