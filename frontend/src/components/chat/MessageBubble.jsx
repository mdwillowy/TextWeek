import { useEffect, useRef, useState } from 'react';
import { usePrivateImageUrl } from '../../hooks/usePrivateImageUrl';
import { resolveUploadImageUrl } from '../../utils/uploadUrl';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😡', '🔥'];


function linkifyText(rawText) {
  const text = String(rawText || '');
  const urlRe = /(https?:\/\/[^\s]+)/gi;
  const segments = [];
  let cursor = 0;
  let match = urlRe.exec(text);

  while (match) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, match.index) });
    }

    segments.push({ type: 'url', value: match[0] });
    cursor = match.index + match[0].length;
    match = urlRe.exec(text);
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }

  return segments;
}

function formatSizeLabel(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function isSameCalendarDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatMessageMetaDate(createdAt) {
  const sentAt = new Date(createdAt);
  if (Number.isNaN(sentAt.getTime())) {
    return '';
  }

  const now = new Date();
  const timeLabel = sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSameCalendarDay(sentAt, now)) {
    return timeLabel;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(sentAt, yesterday)) {
    return `Yesterday, ${timeLabel}`;
  }

  const sameYear = sentAt.getFullYear() === now.getFullYear();
  const dateLabel = sentAt.toLocaleDateString([], sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });

  return `${dateLabel}, ${timeLabel}`;
}

function formatReplyPreviewText(rawText) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const maxChars = 26;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function MessageBubble({
  message,
  onRetry,
  onBeginEdit,
  onReact,
  onBeginReply,
  onDelete,
  onRequestCustomReaction,
  autoShowMeta = false,
}) {
  const canEdit = Boolean(message.isOwn && !message.pending && !message.failed && message.encryptionMode !== 'e2ee');
  const canDelete = Boolean(message.isOwn && !message.pending && !message.failed);
  const canLongPressOwn = Boolean(message.isOwn && !message.failed);
  const canReactFromLongPress = Boolean(!message.isOwn && !message.pending && !message.failed);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const shellRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressNextTapRef = useRef(false);
  const touchStartRef = useRef(null);
  const mouseStartRef = useRef(null);
  const isMouseDraggingRef = useRef(false);
  const replyTriggeredRef = useRef(false);

  const SWIPE_TRIGGER_PX = 72;
  const SWIPE_MAX_VISUAL_PX = 48;
  const attachmentType = String(message.attachment?.type || '').toLowerCase();
  const attachmentRawUrl = String(message.attachment?.url || '').trim();
  const attachmentUrl = attachmentType === 'image'
    ? resolveUploadImageUrl(attachmentRawUrl) || attachmentRawUrl
    : resolveUploadImageUrl(attachmentRawUrl);
  const imageUrl = String(message.imagePreviewUrl || attachmentUrl || resolveUploadImageUrl(message.text) || '');
  const { url: displayImageUrl, isPrivate } = usePrivateImageUrl(imageUrl);
  const finalImageUrl = isPrivate ? displayImageUrl : (displayImageUrl || imageUrl);
  const isImageMessage = Boolean(imageUrl);
  const imageSizeLabel = formatSizeLabel(message.attachment?.sizeBytes || message.attachmentFile?.size);
  const downloadName = String(message.attachment?.originalName || 'chat-image');
  const hasReactions = Array.isArray(message.reactions) && message.reactions.length > 0;

  useEffect(() => {
    if (!isImagePreviewOpen) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsImagePreviewOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isImagePreviewOpen]);

  useEffect(() => {
    if (!pickerOpen && !isSelected) return undefined;

    function handleOutsideClick(event) {
      if (!shellRef.current?.contains(event.target)) {
        setPickerOpen(false);
        setIsSelected(false);
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [pickerOpen, isSelected]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function handleBubbleTap() {
    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
    }
  }

  function startLongPress(event) {
    const tag = String(event.target?.tagName || '').toLowerCase();
    if (['button', 'input', 'textarea', 'select'].includes(tag)) {
      return;
    }
    if (!canReactFromLongPress && !canLongPressOwn) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      suppressNextTapRef.current = true;
      setIsSelected(true);
      setPickerOpen(canReactFromLongPress);
    }, 420);
  }

  function endLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function resetSwipeState() {
    setSwipeOffset(0);
    touchStartRef.current = null;
    replyTriggeredRef.current = false;
  }

  function handleTouchStart(event) {
    if (!canReactFromLongPress && message.pending) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    replyTriggeredRef.current = false;
    setSwipeOffset(0);
    startLongPress(event);
  }

  function handleTouchMove(event) {
    const start = touchStartRef.current;
    if (!start) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) > 10) {
      endLongPress();
      suppressNextTapRef.current = true;
    }

    if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      endLongPress();
      setSwipeOffset(0);
      return;
    }

    if (Math.abs(deltaY) > 26 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeOffset(0);
      return;
    }

    const directionalOffset = message.isOwn ? Math.min(0, deltaX) : Math.max(0, deltaX);
    const clampedOffset = Math.max(-SWIPE_MAX_VISUAL_PX, Math.min(SWIPE_MAX_VISUAL_PX, directionalOffset));
    setSwipeOffset(clampedOffset);

    const canSwipeReply = !message.pending;
    if (!canSwipeReply || replyTriggeredRef.current) return;

    const reachedThreshold = message.isOwn ? deltaX <= -SWIPE_TRIGGER_PX : deltaX >= SWIPE_TRIGGER_PX;
    if (reachedThreshold) {
      replyTriggeredRef.current = true;
      setPickerOpen(false);
      setIsSelected(false);
      onBeginReply?.(message);
    }
  }

  function handleTouchEnd() {
    endLongPress();
    resetSwipeState();
  }

  function handleMouseMove(event) {
    if (!isMouseDraggingRef.current || !mouseStartRef.current) return;

    const start = mouseStartRef.current;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) > 6) {
      endLongPress();
      suppressNextTapRef.current = true;
    }

    if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      endLongPress();
      setSwipeOffset(0);
      return;
    }

    if (Math.abs(deltaY) > 26 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeOffset(0);
      return;
    }

    const directionalOffset = message.isOwn ? Math.min(0, deltaX) : Math.max(0, deltaX);
    const clampedOffset = Math.max(-SWIPE_MAX_VISUAL_PX, Math.min(SWIPE_MAX_VISUAL_PX, directionalOffset));
    setSwipeOffset(clampedOffset);

    const canSwipeReply = !message.pending;
    if (!canSwipeReply || replyTriggeredRef.current) return;

    const reachedThreshold = message.isOwn ? deltaX <= -SWIPE_TRIGGER_PX : deltaX >= SWIPE_TRIGGER_PX;
    if (reachedThreshold) {
      replyTriggeredRef.current = true;
      setPickerOpen(false);
      setIsSelected(false);
      onBeginReply?.(message);
    }
  }

  function handleMouseUp() {
    if (!isMouseDraggingRef.current) return;

    isMouseDraggingRef.current = false;
    mouseStartRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    endLongPress();
    resetSwipeState();
  }

  function handleMouseDown(event) {
    if (event.button !== 0) return;

    mouseStartRef.current = { x: event.clientX, y: event.clientY };
    isMouseDraggingRef.current = true;
    replyTriggeredRef.current = false;
    setSwipeOffset(0);
    startLongPress(event);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleAction(action) {
    setPickerOpen(false);
    setIsSelected(false);
    action?.();
  }

  function handleOpenImagePreview(event) {
    event.preventDefault();
    event.stopPropagation();

    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
      return;
    }

    setIsImagePreviewOpen(true);
  }

  function handleReactionBadgeClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!canReactFromLongPress || message.pending || message.failed) return;

    suppressNextTapRef.current = true;
    setIsSelected(true);
    setPickerOpen(true);
  }

  async function handleDownloadImage(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!finalImageUrl) return;

    try {
      const response = await fetch(finalImageUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error('Image download failed');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName || 'chat-image';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(finalImageUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div ref={shellRef} className={`message-shell ${message.isOwn ? 'own' : 'other'}`}>
      <div
        className={`message-bubble ${message.isOwn ? 'own' : 'other'} ${isSelected ? 'selected' : ''} ${hasReactions ? 'has-reactions' : ''}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={handleBubbleTap}
        onMouseDown={handleMouseDown}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {message.replyTo?.messageId && (
          <div className="message-reply-preview">
            <strong>Reply</strong>
            <span>
              {formatReplyPreviewText(
                message.replyTo?.text || (message.replyTo?.encryptionMode === 'e2ee' ? '[Encrypted message]' : '')
              )}
            </span>
          </div>
        )}

        {isImageMessage ? (
          <div
            role="button"
            tabIndex={0}
            className="message-attachment-tile"
            onClick={handleOpenImagePreview}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOpenImagePreview(event);
              }
            }}
            aria-label="Open photo"
          >
            <span className="message-attachment-icon" aria-hidden="true">
              {finalImageUrl ? (
                <img
                  src={finalImageUrl}
                  alt="Chat image"
                  className="message-image"
                  onClick={() => setIsImagePreviewOpen(true)}
                />
              ) : null}
            </span>
            <span className="message-attachment-copy">
              <strong>Photo</strong>
              <small>{imageSizeLabel ? `Tap to view • ${imageSizeLabel}` : 'Tap to view'}</small>
            </span>
          </div>
        ) : (
          <p>
            {linkifyText(message.text).map((part, index) => (
              part.type === 'url'
                ? (
                  <a
                    key={`${part.value}-${index}`}
                    href={part.value}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="message-link"
                  >
                    {part.value}
                  </a>
                  )
                : part.value
            ))}
          </p>
        )}

        {(isSelected || autoShowMeta) && (
          <small>
            {message.pending
              ? 'Sending...'
              : message.failed
                ? 'Failed to send'
                : formatMessageMetaDate(message.createdAt)}
            {message.editedAt ? ' • Edited' : ''}
            {isImageMessage && imageSizeLabel ? ` • ${imageSizeLabel}` : ''}
            {message.isOwn && !message.pending
              ? message.isSeenByOther
                ? ' • Seen'
                : ' • Sent'
              : ''}
          </small>
        )}

        {hasReactions && (
          <div className="message-reactions" aria-label="Message reactions">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                className={`message-reaction-pill ${reaction.reactedByMe ? 'active' : ''}`}
                onClick={handleReactionBadgeClick}
                disabled={!canReactFromLongPress || message.pending || message.failed}
                aria-label={canReactFromLongPress ? `Change reaction ${reaction.emoji}` : `Reaction ${reaction.emoji}`}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        )}

        {isSelected && message.isOwn && (
          <div className="message-actions-anchor">
            <div className="message-inline-actions" role="group" aria-label="Message actions">
              {canEdit && (
                <button
                  type="button"
                  className="message-icon-btn"
                  onClick={() => handleAction(() => onBeginEdit?.(message))}
                  aria-label="Edit message"
                  title="Edit"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 20h4.2L19.1 9.1a1.7 1.7 0 0 0 0-2.4l-1.8-1.8a1.7 1.7 0 0 0-2.4 0L4 15.8V20z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12.9 6.2l4.9 4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  className="message-icon-btn message-icon-btn-danger"
                  onClick={() => handleAction(() => onDelete?.(message))}
                  aria-label="Delete message"
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M5.5 7h13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 7.2V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M10.4 10.5v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M13.6 10.5v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {pickerOpen && canReactFromLongPress && (
          <div className="message-reaction-picker">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="message-emoji-btn"
                type="button"
                onClick={() => {
                  onReact?.(message, emoji);
                  setPickerOpen(false);
                }}
                disabled={message.pending}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}

            <button
              className="message-emoji-btn message-emoji-plus"
              type="button"
              onClick={() => {
                setPickerOpen(false);
                setIsSelected(false);
                onRequestCustomReaction?.(message);
              }}
              aria-label="Add custom emoji"
              disabled={message.pending}
            >
              +
            </button>
          </div>
        )}

        {message.isOwn && message.failed && (
          <button className="btn-ghost message-retry-btn" onClick={() => onRetry?.(message)} type="button">
            Retry
          </button>
        )}
      </div>

      {isImagePreviewOpen && isImageMessage && finalImageUrl && (
        <div className="message-image-modal" role="dialog" aria-modal="true" onClick={() => setIsImagePreviewOpen(false)}>
          <div className="message-image-modal-frame" onClick={(event) => event.stopPropagation()}>
            <div className="message-image-modal-actions">
              <button
                type="button"
                className="message-image-modal-download"
                onClick={handleDownloadImage}
                aria-label="Download image"
                title="Download"
              >
                ↓
              </button>
              <button
                type="button"
                className="message-image-modal-close"
                onClick={() => setIsImagePreviewOpen(false)}
                aria-label="Close image preview"
              >
                ×
              </button>
            </div>
            <img
              src={finalImageUrl}
              alt="Full size chat image"
              className="message-image-modal-content"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
