import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { followUser, getFollowers, getFollowing, getFollowStatus, removeFollower, unfollowUser } from '../../api/follows';
import { openDirectChat } from '../../api/chats';

function FollowListModal({ mode, userId, onClose }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [followingMap, setFollowingMap] = useState({});

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setError('');

      try {
        const response = mode === 'followers' ? await getFollowers(userId) : await getFollowing(userId);
        if (isActive) {
          setItems(response?.data?.users || []);
        }
      } catch (err) {
        if (isActive) {
          setError(err?.response?.data?.message || 'Failed to load list');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      isActive = false;
    };
  }, [mode, userId]);

  useEffect(() => {
    let isActive = true;

    async function loadFollowStates() {
      if (items.length === 0) {
        setFollowingMap({});
        return;
      }

      if (mode === 'following') {
        if (!isActive) return;
        setFollowingMap(Object.fromEntries(items.map((item) => [item.id, true])));
        return;
      }

      const rows = await Promise.all(
        items.map(async (item) => {
          try {
            const response = await getFollowStatus(item.id);
            return [item.id, Boolean(response?.data?.isFollowing)];
          } catch {
            return [item.id, false];
          }
        })
      );

      if (isActive) {
        setFollowingMap(Object.fromEntries(rows));
      }
    }

    loadFollowStates();
    return () => {
      isActive = false;
    };
  }, [items, mode]);

  async function handleStartChat(targetUserId) {
    setBusyUserId(targetUserId);
    setError('');

    try {
      const response = await openDirectChat(targetUserId);
      onClose();
      navigate(`/chat/${response?.data?.chat?.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to open chat right now');
    } finally {
      setBusyUserId('');
    }
  }

  async function handleRelationshipAction(targetUserId) {
    setBusyUserId(targetUserId);
    setError('');

    try {
      if (mode === 'followers') {
        await removeFollower(targetUserId);
      } else {
        await unfollowUser(targetUserId);
      }

      setItems((prev) => prev.filter((item) => item.id !== targetUserId));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update relation');
    } finally {
      setBusyUserId('');
    }
  }

  async function handleToggleFollow(targetUserId) {
    const isFollowing = Boolean(followingMap[targetUserId]);

    setBusyUserId(targetUserId);
    setError('');
    try {
      if (isFollowing) {
        await unfollowUser(targetUserId);
        setFollowingMap((prev) => ({ ...prev, [targetUserId]: false }));
      } else {
        await followUser(targetUserId);
        setFollowingMap((prev) => ({ ...prev, [targetUserId]: true }));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update follow state');
    } finally {
      setBusyUserId('');
    }
  }

  return (
    <section className="dashboard-overlay" role="presentation" onClick={onClose}>
      <article className="follow-modal landing-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="follow-modal-head landing-modal-header">
          <h3>{mode === 'followers' ? 'Followers' : 'Following'}</h3>
          <button className="landing-modal-close" type="button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">x</span>
          </button>
        </header>

        <div className="landing-modal-body follow-modal-body">

          {isLoading && <p className="search-note">Loading list...</p>}
          {error && <p className="submit-error">{error}</p>}

          {!isLoading && !error && items.length === 0 && <p className="search-note">No users found.</p>}

          <ul className="search-results">
            {items.map((user) => (
              <li key={user.id} className="follow-list-row">
                <div className="mini-avatar">{user.fullName?.[0] || '?'}</div>
                <div className="follow-list-user">
                  <p>{user.fullName}</p>
                  <small>@{user.username}</small>
                </div>
                <div className="follow-list-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleStartChat(user.id)}
                    disabled={busyUserId === user.id}
                  >
                    Chat
                  </button>

                  {mode === 'followers' && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleRelationshipAction(user.id)}
                      disabled={busyUserId === user.id}
                    >
                      Remove
                    </button>
                  )}

                  <button
                    className="btn-secondary"
                    onClick={() => handleToggleFollow(user.id)}
                    disabled={busyUserId === user.id}
                  >
                    {followingMap[user.id] ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}

export default FollowListModal;
