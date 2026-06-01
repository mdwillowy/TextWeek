import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePrivateImageUrl } from '../../hooks/usePrivateImageUrl';

function ProfileCard({ user, onSaveProfile, onOpenFollowList, isSaving }) {
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: user.fullName,
    bio: user.bio || '',
    gender: user.gender,
    avatarUrl: user.avatarUrl || '',
    avatarFile: null,
  });

  function beginEdit() {
    setForm({
      fullName: user.fullName,
      bio: user.bio || '',
      gender: user.gender,
      avatarUrl: user.avatarUrl || '',
      avatarFile: null,
    });
    setIsEditing(true);
  }

  async function submitEdit(event) {
    event.preventDefault();
    await onSaveProfile(form);
    setIsEditing(false);
  }

  function handleAvatarUrlChange(value) {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setForm((prev) => ({
      ...prev,
      avatarUrl: value,
      avatarFile: null,
    }));
  }

  function handleAvatarFileChange(file) {
    setForm((prev) => ({
      ...prev,
      avatarFile: file,
      avatarUrl: '',
    }));
  }

  function clearAvatarInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setForm((prev) => ({
      ...prev,
      avatarUrl: '',
      avatarFile: null,
    }));
  }

  const avatarInputValue = form.avatarFile ? form.avatarFile.name : form.avatarUrl;

  const modal = isEditing ? (
    <section className="dashboard-overlay" role="presentation" onClick={() => setIsEditing(false)}>
      <form className="profile-modal landing-modal" onSubmit={submitEdit} onClick={(event) => event.stopPropagation()}>
        <header className="landing-modal-header profile-modal-head">
          <h3>Edit profile</h3>
          <button className="landing-modal-close" type="button" onClick={() => setIsEditing(false)} aria-label="Close">
            <span aria-hidden="true">x</span>
          </button>
        </header>

        <div className="landing-modal-body profile-modal-body">

          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
          </label>

          <label>
            Bio
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            />
          </label>

          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>

          <label className="avatar-input-block">
            <span>Avatar (URL or file)</span>
            <div className="avatar-input-row">
              <input
                type="text"
                value={avatarInputValue}
                readOnly={Boolean(form.avatarFile)}
                onChange={(e) => handleAvatarUrlChange(e.target.value)}
                placeholder="Paste image URL or choose a file"
              />
              <input
                ref={fileInputRef}
                className="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn-secondary avatar-file-button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </button>
              {(form.avatarUrl || form.avatarFile) && (
                <button
                  type="button"
                  className="avatar-clear-button"
                  onClick={clearAvatarInput}
                  aria-label="Clear avatar input"
                >
                  <span aria-hidden="true">x</span>
                </button>
              )}
            </div>
            <small className="search-note">
              {form.avatarFile
                ? 'Clear to switch back to a URL. Max size 2MB.'
                : 'Max size 2MB. If a file is selected, it will be used instead of the URL.'}
            </small>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </section>
  ) : null;

  const { url: avatarSrc, isPrivate } = usePrivateImageUrl(user.avatarUrl || '');

  return (
    <section className="profile-card">
      <div className="profile-main-row">
        <div className="profile-inline-user">
          <button
            className="avatar avatar-edit-trigger"
            type="button"
            onClick={beginEdit}
            aria-label="Edit profile picture and details"
          >
            {avatarSrc ? <img src={avatarSrc} alt={`${user.fullName} avatar`} /> : (isPrivate ? user.fullName[0] : user.fullName[0])}
          </button>
          <p className="profile-inline-handle">@{user.username}</p>
        </div>

        <p className="counts clickable-counts profile-side-counts">
          <button className="count-button count-pill" onClick={() => onOpenFollowList('followers')}>
            <strong>{user.followersCount}</strong>
            <span>Followers</span>
          </button>
          <button className="count-button count-pill" onClick={() => onOpenFollowList('following')}>
            <strong>{user.followingCount}</strong>
            <span>Following</span>
          </button>
        </p>
      </div>

      <p className="bio profile-card-bio">{user.bio || 'No bio yet. Add a short intro to your profile.'}</p>

      {modal && typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
    </section>
  );
}

export default ProfileCard;
