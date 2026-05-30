import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { followUser, unfollowUser } from '../../api/follows';
import { openDirectChat } from '../../api/chats';
import PresenceBadge from '../chat/PresenceBadge';

function UserResultCard({ user, onOptimisticChange }) {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(Boolean(user.isFollowing));
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFollowToggle() {
    if (isBusy) return;

    setIsBusy(true);
    setError('');

    const next = !isFollowing;
    setIsFollowing(next);
    onOptimisticChange(user.id, next);

    try {
      if (next) {
        await followUser(user.id);
      } else {
        await unfollowUser(user.id);
      }
    } catch (err) {
      setIsFollowing(!next);
      onOptimisticChange(user.id, !next);
      setError(err?.response?.data?.message || 'Failed to update follow state');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMessage() {
    setIsBusy(true);
    setError('');
    try {
      const response = await openDirectChat(user.id);
      navigate(`/chat/${response.data.chat.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to open chat right now');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <li className="user-result-card">
      <div className="mini-avatar">{user.fullName?.[0] || '?'}</div>
      <div className="user-result-main">
        <p>{user.fullName}</p>
        <small>@{user.username}</small>
        <PresenceBadge isOnline={Boolean(user.isOnline)} lastSeen={user.lastSeen || null} />
      </div>
      <div className="user-result-actions">
        <button className="btn-secondary" onClick={handleFollowToggle} disabled={isBusy}>
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
        <button className="btn-primary" onClick={handleMessage} disabled={isBusy}>
          Message
        </button>
      </div>
      {error && <p className="field-error card-error">{error}</p>}
    </li>
  );
}

export default UserResultCard;
