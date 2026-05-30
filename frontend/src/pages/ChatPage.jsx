import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { getChatById } from '../api/chats';
import ChatWindow from '../components/chat/ChatWindow';
import { useAuth } from '../context/AuthContext';
import { usePrivateImageUrl } from '../hooks/usePrivateImageUrl';
import { resolveUploadUrl } from '../utils/uploadUrl';

function ChatPage() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [chatPartnerLabel, setChatPartnerLabel] = useState('Chat');
  const [chatPartnerAvatarUrl, setChatPartnerAvatarUrl] = useState('');
  const [chatPartner, setChatPartner] = useState(null);
  const [isPartnerCardOpen, setIsPartnerCardOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const { url: partnerAvatarSrc, isPrivate } = usePrivateImageUrl(chatPartnerAvatarUrl);
  const resolvedPartnerAvatar = isPrivate ? partnerAvatarSrc : (partnerAvatarSrc || resolveUploadUrl(chatPartnerAvatarUrl));

  useEffect(() => {
    let active = true;

    async function loadChatPartner() {
      try {
        const response = await getChatById(chatId);
        if (!active) return;

        const other = response?.data?.chat?.otherParticipant;
        setChatPartnerAvatarUrl(other?.avatarUrl || '');
        setChatPartner(other || null);
        setAvatarLoadFailed(false);
        if (other?.fullName) {
          setChatPartnerLabel(other.fullName);
          return;
        }

        if (other?.username) {
          setChatPartnerLabel(`@${other.username}`);
          return;
        }

        setChatPartnerLabel('Chat');
      } catch {
        if (active) {
          setChatPartnerLabel('Chat');
          setChatPartnerAvatarUrl('');
          setChatPartner(null);
          setIsPartnerCardOpen(false);
          setAvatarLoadFailed(false);
        }
      }
    }

    if (chatId) {
      loadChatPartner();
    }

    return () => {
      active = false;
    };
  }, [chatId]);

  return (
    <div className="app-page app-page--app">
      <main className="chat-page-shell">
        <header className="home-topbar chat-topbar">
          <div className="chat-topbar-left">
            <button
              className="chat-topbar-avatar chat-topbar-avatar-btn"
              type="button"
              aria-label="Open chat partner profile card"
              onClick={() => setIsPartnerCardOpen(true)}
            >
              {resolvedPartnerAvatar && !avatarLoadFailed ? (
                <img
                  src={resolvedPartnerAvatar}
                  alt={`${chatPartnerLabel} avatar`}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span>{String(chatPartnerLabel || 'C').replace(/^@/, '').charAt(0)?.toUpperCase() || 'C'}</span>
              )}
            </button>
            <p className="site-brand user-handle-brand chat-partner-brand">{chatPartnerLabel}</p>
          </div>

          <div className="topbar-actions site-nav topbar-actions-home chat-header-actions">
            <Link className="btn-primary topbar-action-btn topbar-action-btn--strong" to="/home">
                Back
              </Link>
          </div>
        </header>
        <div className="chat-page-content">
          <ChatWindow chatId={chatId} />
        </div>

        {isPartnerCardOpen && typeof document !== 'undefined'
          ? createPortal(
              <section className="dashboard-overlay" role="presentation" onClick={() => setIsPartnerCardOpen(false)}>
                <article className="follow-modal landing-modal chat-partner-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <header className="follow-modal-head landing-modal-header">
                    <h3>Profile</h3>
                    <button className="landing-modal-close" type="button" onClick={() => setIsPartnerCardOpen(false)} aria-label="Close">
                      <span aria-hidden="true">x</span>
                    </button>
                  </header>

                  <div className="landing-modal-body follow-modal-body">
                    <div className="chat-action-modal-user">
                      <div className="mini-avatar">
                        {resolvedPartnerAvatar ? (
                          <img src={resolvedPartnerAvatar} alt={`${chatPartner?.fullName || 'User'} avatar`} />
                        ) : (
                          <span>{chatPartner?.fullName?.[0] || chatPartner?.username?.[0] || '?'}</span>
                        )}
                      </div>
                      <div className="follow-list-user">
                        <p>{chatPartner?.fullName || 'Unknown user'}</p>
                        <small>@{chatPartner?.username || 'unknown'}</small>
                      </div>
                    </div>

                    <p className="search-note chat-partner-bio">{chatPartner?.bio || 'No bio available.'}</p>
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

export default ChatPage;
