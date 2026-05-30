import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { listChats } from '../../api/chats';
import { followUser, getFollowStatus, unfollowUser } from '../../api/follows';
import { useAuth } from '../../context/AuthContext';
import { blockUser, listBlockedUsers, unblockUser } from '../../api/moderation';
import { getSocket } from '../../socket/socketClient';
import { bindSocketEvents } from '../../socket/socketEvents';
import {
  clearChatForUser,
  getClearedChatsMap,
  getHiddenChatsMap,
  hasVisibleMessageAfterClear,
  restoreChatInStackForUser,
} from '../../utils/chatClearance';
import PresenceBadge from './PresenceBadge';
import { usePrivateImageUrl } from '../../hooks/usePrivateImageUrl';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ChatAvatar({ avatarUrl, fallbackLabel, className, imgClassName }) {
  const { url: avatarSrc } = usePrivateImageUrl(avatarUrl || '');

  if (avatarSrc) {
    return <img className={imgClassName} src={avatarSrc} alt={`${fallbackLabel} avatar`} />;
  }

  return <span className={className}>{fallbackLabel?.[0] || '?'}</span>;
}

function ChatStack() {
  const { user } = useAuth();
  const myUserId = user?.id;
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [busyChatId, setBusyChatId] = useState('');
  const [blockedSet, setBlockedSet] = useState(new Set());
  const [followingSet, setFollowingSet] = useState(new Set());
  const [clearedMap, setClearedMap] = useState(() => getClearedChatsMap(myUserId));
  const [hiddenMap, setHiddenMap] = useState(() => getHiddenChatsMap(myUserId));

  useEffect(() => {
    setClearedMap(getClearedChatsMap(myUserId));
    setHiddenMap(getHiddenChatsMap(myUserId));
  }, [myUserId]);

  const loadChats = useCallback(async () => {
    const response = await listChats();
    const rows = response?.data?.chats || [];
    setChats(rows);
  }, []);

  useEffect(() => {
    function handleLocalClear(event) {
      const detail = event?.detail;
      if (!detail?.chatId || !detail?.clearedAt) return;

      setClearedMap((prev) => ({ ...prev, [detail.chatId]: detail.clearedAt }));
      setHiddenMap((prev) => ({ ...prev, [detail.chatId]: true }));
      setChats((prev) => prev.filter((chat) => chat.id !== detail.chatId));
    }

    function handleLocalRestore(event) {
      const detail = event?.detail;
      if (!detail?.chatId) return;

      setHiddenMap((prev) => {
        if (!prev[detail.chatId]) return prev;
        const next = { ...prev };
        delete next[detail.chatId];
        return next;
      });

      setChats((prev) => {
        if (prev.some((chat) => chat.id === detail.chatId)) {
          return prev;
        }

        loadChats().catch(() => {
          // Keep existing list if reload fails.
        });
        return prev;
      });
    }

    window.addEventListener('chat:local-cleared', handleLocalClear);
    window.addEventListener('chat:local-restored', handleLocalRestore);
    return () => {
      window.removeEventListener('chat:local-cleared', handleLocalClear);
      window.removeEventListener('chat:local-restored', handleLocalRestore);
    };
  }, [loadChats]);

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        setIsLoading(true);
        await loadChats();
        if (isActive) {
          setError('');
        }
      } catch (err) {
        if (isActive) {
          setError(err?.response?.data?.message || 'Unable to load chats');
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
  }, [loadChats]);

  useEffect(() => {
    let isActive = true;

    async function loadBlocked() {
      try {
        const response = await listBlockedUsers();
        if (!isActive) return;
        const ids = (response?.data?.users || []).map((u) => u.id);
        setBlockedSet(new Set(ids));
      } catch {
        // Ignore block list failures for chat list rendering.
      }
    }

    loadBlocked();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadFollowStates() {
      const participants = chats
        .map((chat) => chat?.otherParticipant?.id)
        .filter(Boolean);

      if (participants.length === 0) {
        setFollowingSet(new Set());
        return;
      }

      const rows = await Promise.all(
        participants.map(async (userId) => {
          try {
            const response = await getFollowStatus(userId);
            return [userId, Boolean(response?.data?.isFollowing)];
          } catch {
            return [userId, false];
          }
        })
      );

      if (!isActive) return;
      const next = new Set(rows.filter(([, isFollowing]) => isFollowing).map(([userId]) => userId));
      setFollowingSet(next);
    }

    loadFollowStates();
    return () => {
      isActive = false;
    };
  }, [chats]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const unsubscribe = bindSocketEvents(socket, {
      'chat:updated': (payload) => {
        if (!payload?.chatId) return;

        restoreChatInStackForUser(myUserId, payload.chatId);

        setChats((prev) => {
          const idx = prev.findIndex((item) => item.id === payload.chatId);
          if (idx < 0) {
            loadChats().catch(() => {
              // Keep existing list if reload fails.
            });
            return prev;
          }

          const next = [...prev];
          const current = next[idx];
          const unreadDelta = Number(payload.unreadCountDelta || 0);
          const updated = {
            ...current,
            lastMessagePreview: payload.lastMessage ?? current.lastMessagePreview,
            lastMessageAt: payload.lastMessageAt ?? current.lastMessageAt,
            unreadCount: Math.max(0, (current.unreadCount || 0) + unreadDelta),
            encryptionEnabled:
              typeof payload.encryptionEnabled === 'boolean'
                ? payload.encryptionEnabled
                : current.encryptionEnabled,
          };

          next.splice(idx, 1);
          return [updated, ...next];
        });
      },
      'chat:removed': ({ chatId }) => {
        if (!chatId) return;
        setChats((prev) => prev.filter((item) => item.id !== chatId));
      },
      'presence:update': ({ userId, online, lastSeen }) => {
        setChats((prev) =>
          prev.map((chat) => {
            if (!chat.otherParticipant || chat.otherParticipant.id !== userId) {
              return chat;
            }

            return {
              ...chat,
              otherParticipant: {
                ...chat.otherParticipant,
                isOnline: online,
                lastSeen,
              },
            };
          })
        );
      },
    });

    return unsubscribe;
  }, [loadChats, myUserId]);

  function closeMenu() {
    setActiveChatId('');
  }

  function toggleMenu(chatId) {
    if (activeChatId === chatId) {
      closeMenu();
      return;
    }

    setActiveChatId(chatId);
  }

  useEffect(() => {
    if (!activeChatId) return undefined;

    function onEscape(event) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }

    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [activeChatId]);

  function handleClearConversation(chatId) {
    const confirmed = window.confirm('Delete this chat for your account only?');
    if (!confirmed) return;

    const clearedAt = clearChatForUser(myUserId, chatId);
    if (!clearedAt) return;

    setClearedMap((prev) => ({ ...prev, [chatId]: clearedAt }));
    setHiddenMap((prev) => ({ ...prev, [chatId]: true }));
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    closeMenu();
  }

  async function handleToggleBlock(chat) {
    const targetUserId = chat?.otherParticipant?.id;
    if (!targetUserId) return;

    const isCurrentlyBlocked = blockedSet.has(targetUserId);
    const confirmMessage = isCurrentlyBlocked
      ? 'Unblock this user and allow messaging again?'
      : 'Block this user? You will not be able to message them until you unblock.';
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setBusyChatId(chat.id);
    setError('');
    try {
      if (isCurrentlyBlocked) {
        await unblockUser(targetUserId);
        setBlockedSet((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      } else {
        await blockUser(targetUserId);
        setBlockedSet((prev) => new Set(prev).add(targetUserId));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update block state');
    } finally {
      setBusyChatId('');
      closeMenu();
    }
  }

  async function handleToggleFollow(chat) {
    const targetUserId = chat?.otherParticipant?.id;
    if (!targetUserId) return;

    setBusyChatId(chat.id);
    setError('');
    try {
      if (followingSet.has(targetUserId)) {
        await unfollowUser(targetUserId);
        setFollowingSet((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      } else {
        await followUser(targetUserId);
        setFollowingSet((prev) => new Set(prev).add(targetUserId));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update follow state');
    } finally {
      setBusyChatId('');
      closeMenu();
    }
  }

  const visibleChats = chats.filter((chat) => !hiddenMap[chat.id]);
  const activeChat = visibleChats.find((chat) => chat.id === activeChatId) || null;

  return (
    <section className="chat-stack">
      <div className="section-head">
        <h3>Chats</h3>
      </div>

      {isLoading && <p className="search-note">Loading chats...</p>}
      {error && <p className="submit-error">{error}</p>}
      {!isLoading && !error && visibleChats.length === 0 && (
        <p className="search-note">No chats yet. Search someone to start chat.</p>
      )}

      <ul className="chat-list">
        {visibleChats.map((chat) => (
          <li key={chat.id} className={`chat-row-item ${activeChatId === chat.id ? 'menu-open' : ''}`}>
            <button
              className="chat-avatar-trigger"
              onClick={() => toggleMenu(chat.id)}
              disabled={busyChatId === chat.id}
              aria-label={`Chat actions for ${chat.otherParticipant?.fullName || 'user'}`}
            >
              <ChatAvatar
                avatarUrl={chat.otherParticipant?.avatarUrl}
                fallbackLabel={chat.otherParticipant?.fullName || 'User'}
                className="chat-avatar-fallback"
              />
            </button>

            <Link to={`/chat/${chat.id}`} className="chat-list-item">
              <div className="chat-preview">
                <p>{chat.otherParticipant?.fullName || 'Unknown user'}</p>
                <small>
                  {hasVisibleMessageAfterClear(chat.lastMessageAt, clearedMap[chat.id])
                    ? chat.lastMessagePreview || 'No messages yet'
                    : 'No messages yet'}
                </small>
              </div>
              <div className="chat-meta">
                <div className="chat-meta-line">
                  <PresenceBadge
                    isOnline={Boolean(chat.otherParticipant?.isOnline)}
                    lastSeen={chat.otherParticipant?.lastSeen || null}
                    showLastSeen={false}
                    inline
                  />
                  <small>
                    {hasVisibleMessageAfterClear(chat.lastMessageAt, clearedMap[chat.id])
                      ? formatTime(chat.lastMessageAt)
                      : ''}
                  </small>
                </div>
                {hasVisibleMessageAfterClear(chat.lastMessageAt, clearedMap[chat.id]) && chat.unreadCount > 0 && (
                  <span className="badge">{chat.unreadCount}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {activeChat &&
        createPortal(
          <section className="dashboard-overlay" role="presentation" onClick={closeMenu}>
            <article className="follow-modal landing-modal chat-action-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <header className="follow-modal-head landing-modal-header">
                <h3>Chat actions</h3>
                <button className="landing-modal-close" type="button" onClick={closeMenu} aria-label="Close">
                  <span aria-hidden="true">x</span>
                </button>
              </header>

              <div className="landing-modal-body follow-modal-body chat-action-modal-body">
                <div className="chat-action-modal-user">
                  <div className="mini-avatar">
                      <ChatAvatar
                        avatarUrl={activeChat.otherParticipant?.avatarUrl}
                        fallbackLabel={activeChat.otherParticipant?.fullName || 'User'}
                      />
                  </div>
                  <div className="follow-list-user">
                    <p>{activeChat.otherParticipant?.fullName || 'Unknown user'}</p>
                    <small>@{activeChat.otherParticipant?.username || 'unknown'}</small>
                  </div>
                </div>

                <div className="chat-action-modal-actions">
                  <button className="btn-secondary" onClick={() => handleToggleFollow(activeChat)} disabled={busyChatId === activeChat.id}>
                    {followingSet.has(activeChat.otherParticipant?.id) ? 'Unfollow' : 'Follow'}
                  </button>
                  <button className="btn-secondary" onClick={() => handleToggleBlock(activeChat)} disabled={busyChatId === activeChat.id}>
                    {blockedSet.has(activeChat.otherParticipant?.id) ? 'Unblock chat' : 'Block chat'}
                  </button>
                  <button className="btn-secondary" onClick={() => handleClearConversation(activeChat.id)} disabled={busyChatId === activeChat.id}>
                    Delete chat
                  </button>
                </div>
              </div>
            </article>
          </section>,
          document.body
        )}
    </section>
  );
}

export default ChatStack;
