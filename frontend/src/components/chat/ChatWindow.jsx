import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteChatMessage,
  editChatMessage,
  getChatById,
  getChatMessages,
  markChatRead,
  sendChatMessage,
  toggleChatMessageReaction,
  uploadChatImage,
} from '../../api/chats';
import { getBlockStatus } from '../../api/moderation';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket/socketClient';
import { bindSocketEvents } from '../../socket/socketEvents';
import { decryptInboundMessage, prepareOutboundMessage } from '../../services/e2eeService';
import { getChatClearTimestamp, isMessageVisibleAfterClear, restoreChatInStackForUser } from '../../utils/chatClearance';
import MessageBubble from './MessageBubble';

const MAX_CHAT_IMAGE_BYTES = 2 * 1024 * 1024;

function isUploadImageMessage(text) {
  return /^\/uploads\/[\w.-]+\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(text || '').trim());
}

function isImageMessagePayload(message) {
  if (!message) return false;
  if (String(message.attachment?.type || '').toLowerCase() === 'image' && message.attachment?.url) {
    return true;
  }
  return isUploadImageMessage(message.text);
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read image'));
    image.src = URL.createObjectURL(file);
  });
}

async function compressImageToLimit(file, maxBytes) {
  if (!file || file.size <= maxBytes) return file;

  const image = await readImageFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(image.src);
    throw new Error('Image compression is not supported in this browser');
  }

  let scale = 1;
  let quality = 0.86;
  let attempts = 0;
  let outputBlob = null;

  while (attempts < 10) {
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    // JPEG gives reliable size control for chat uploads.
    outputBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (outputBlob && outputBlob.size <= maxBytes) {
      break;
    }

    if (quality > 0.52) {
      quality -= 0.1;
    } else {
      scale *= 0.85;
      quality = 0.82;
    }
    attempts += 1;
  }

  URL.revokeObjectURL(image.src);

  if (!outputBlob || outputBlob.size > maxBytes) {
    throw new Error('Image is still too large after compression');
  }

  const baseName = String(file.name || 'image').replace(/\.[^/.]+$/, '');
  return new File([outputBlob], `${baseName}-compressed.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function ChatWindow({ chatId }) {
  const { user } = useAuth();
  const myUserId = user?.id;
  const [messages, setMessages] = useState([]);
  const [chatInfo, setChatInfo] = useState(null);
  const [text, setText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [reactionTarget, setReactionTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clearedAt, setClearedAt] = useState(0);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [hasInitializedScroll, setHasInitializedScroll] = useState(false);
  const [newIncomingCount, setNewIncomingCount] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState('');
  const messageListRef = useRef(null);
  const endRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const imageInputRef = useRef(null);
  const textInputRef = useRef(null);
  const chatSendRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const messageNodeMapRef = useRef(new Map());
  const highlightTimerRef = useRef(null);

  const blockBySelfMessage = 'You blocked this user. Unblock to message.';
  const blockByOtherMessage = 'You were blocked by this user';

  function showNotice(message) {
    setNotice(message || '');
  }

  function markPendingMessageFailed(clientMessageId, reason = 'Unable to send message') {
    if (!clientMessageId) return;

    setMessages((prev) =>
      prev.map((item) => {
        if (item.clientMessageId !== clientMessageId) return item;
        return {
          ...item,
          pending: false,
          failed: true,
          failedReason: reason,
        };
      })
    );
  }

  function dropPendingMessage(clientMessageId) {
    if (!clientMessageId) return;
    setMessages((prev) => prev.filter((item) => item.clientMessageId !== clientMessageId));
  }

  const normalizeMessage = useCallback(async (message, clientMessageId = null) => {
    const decryptedText = await decryptInboundMessage(message);
    const readBy = Array.isArray(message.readBy) ? message.readBy : [];
    const isOwn = String(message.senderId) === String(myUserId);
    const isSeenByOther = isOwn && readBy.some((id) => String(id) !== String(myUserId));

    return {
      ...message,
      text: decryptedText,
      clientMessageId: clientMessageId || message.clientMessageId || null,
      isOwn,
      isSeenByOther,
      readBy,
    };
  }, [myUserId]);

  useEffect(() => {
    restoreChatInStackForUser(myUserId, chatId);

    async function loadInitial() {
      try {
        setIsLoading(true);
        setError('');
        setHasInitializedScroll(false);
        setNewIncomingCount(0);
        const clearTs = getChatClearTimestamp(myUserId, chatId);
        setClearedAt(clearTs);

        const [chatResponse, messageResponse] = await Promise.all([
          getChatById(chatId),
          getChatMessages(chatId, { limit: 30 }),
        ]);

        const nextChat = chatResponse?.data?.chat || null;
        setChatInfo(nextChat);

        try {
          const targetUserId = String(nextChat?.otherParticipant?.id || '');
          if (targetUserId) {
            const blockResponse = await getBlockStatus(targetUserId);
            const relation = blockResponse?.data || {};
            setIsBlockedByMe(Boolean(relation.blockedBySelf));
            setIsBlockedByOther(Boolean(relation.blockedByOther));
          } else {
            setIsBlockedByMe(false);
            setIsBlockedByOther(false);
          }
        } catch {
          setIsBlockedByMe(false);
          setIsBlockedByOther(false);
        }

        const rows = messageResponse?.data?.messages || [];
        const normalized = await Promise.all(rows.map((row) => normalizeMessage(row)));
        const visible = normalized.filter((row) => isMessageVisibleAfterClear(row.createdAt, clearTs));
        setMessages(visible);
        setHasMore(clearTs ? false : Boolean(messageResponse?.meta?.hasMore));
        setNextBefore(clearTs ? null : messageResponse?.meta?.nextBefore || null);
        await markChatRead(chatId);

        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('chat:join', { chatId });
          socket.emit('message:read', { chatId });
        }
      } catch (err) {
        setIsBlockedByMe(false);
        setIsBlockedByOther(false);
        setError(err?.response?.data?.message || 'Unable to load messages');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitial();
    return () => {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('typing:stop', { chatId });
        socket.emit('chat:leave', { chatId });
      }
    };
  }, [chatId, myUserId, normalizeMessage]);

  useEffect(() => {
    function handleLocalClear(event) {
      const detail = event?.detail;
      if (!detail || detail.chatId !== chatId) return;

      setClearedAt(detail.clearedAt || Date.now());
      setMessages([]);
      setHasMore(false);
      setNextBefore(null);
      setError('');
      setNotice('');
      setEditingMessageId('');
      setReplyingTo(null);
      setReactionTarget(null);
      setNewIncomingCount(0);
      setText('');
    }

    window.addEventListener('chat:local-cleared', handleLocalClear);
    return () => window.removeEventListener('chat:local-cleared', handleLocalClear);
  }, [chatId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const unsubscribe = bindSocketEvents(socket, {
      'message:new': async ({ chatId: incomingChatId, message, clientMessageId }) => {
        if (incomingChatId !== chatId || !message?.id) return;

        const normalized = await normalizeMessage(message, clientMessageId || null);
        if (!isMessageVisibleAfterClear(normalized.createdAt, clearedAt)) {
          return;
        }

        const listNode = messageListRef.current;
        const distanceToBottom = listNode
          ? listNode.scrollHeight - listNode.scrollTop - listNode.clientHeight
          : 0;
        const isNearBottom = distanceToBottom <= 120 || stickToBottomRef.current;

        setMessages((prev) => {
          if (prev.some((item) => item.id === normalized.id)) {
            return prev;
          }
          const withoutPendingTwin = prev.filter(
            (item) => !(item.pending && item.clientMessageId && item.clientMessageId === normalized.clientMessageId)
          );
          return [...withoutPendingTwin, normalized];
        });

        if (String(normalized.senderId) !== String(myUserId)) {
          if (!isNearBottom) {
            setNewIncomingCount((prev) => prev + 1);
          }
          socket.emit('message:read', { chatId, messageIds: [normalized.id] });
        }
      },
      'message:ack': ({ clientMessageId, messageId, createdAt }) => {
        setMessages((prev) =>
          prev.map((item) => {
            if (item.clientMessageId !== clientMessageId) return item;
            return {
              ...item,
              id: messageId,
              createdAt: createdAt || item.createdAt,
              pending: false,
              failed: false,
              failedReason: '',
            };
          })
        );
      },
      'message:updated': async ({ chatId: incomingChatId, message }) => {
        if (incomingChatId !== chatId || !message?.id) return;
        const normalized = await normalizeMessage(message);

        setMessages((prev) =>
          prev.map((item) => {
            if (item.id !== normalized.id) return item;
            return {
              ...item,
              ...normalized,
              pending: false,
              failed: false,
              failedReason: '',
            };
          })
        );
      },
      'message:deleted': ({ chatId: incomingChatId, messageId }) => {
        if (incomingChatId !== chatId || !messageId) return;

        setMessages((prev) => prev.filter((item) => item.id !== messageId));
        setEditingMessageId((prev) => (prev === messageId ? '' : prev));
        setReplyingTo((prev) => (prev?.messageId === messageId ? null : prev));
      },
      'message:read:update': ({ chatId: incomingChatId, readerUserId, messageIds }) => {
        if (incomingChatId !== chatId || String(readerUserId) === String(myUserId)) return;

        setMessages((prev) =>
          prev.map((item) => {
            if (!item.isOwn) return item;

            if (Array.isArray(messageIds) && messageIds.length > 0) {
              if (!messageIds.includes(item.id)) return item;
            }

            return {
              ...item,
              isSeenByOther: true,
            };
          })
        );
      },
      'typing:update': ({ chatId: incomingChatId, userId, isTyping }) => {
        if (incomingChatId !== chatId || String(userId) === String(myUserId)) {
          return;
        }

        setTypingUserId(isTyping ? userId : null);
      },
      'error:event': ({ event, message, code, clientMessageId }) => {
        if (event !== 'message:send') return;

        const nextMessage = message || 'Unable to send message';

        if (code === 'CHAT_BLOCKED_BY_SELF') {
          dropPendingMessage(clientMessageId);
          setIsBlockedByMe(true);
          setIsBlockedByOther(false);
          setError('');
          showNotice('');
        } else if (code === 'CHAT_BLOCKED_BY_OTHER') {
          dropPendingMessage(clientMessageId);
          setIsBlockedByOther(true);
          setError('');
          showNotice('');
        } else {
          setError(nextMessage);
          markPendingMessageFailed(clientMessageId, nextMessage);
        }
      },
    });

    return unsubscribe;
  }, [chatId, clearedAt, myUserId, normalizeMessage]);

  useEffect(() => {
    const listNode = messageListRef.current;
    if (!listNode || isLoading) return;

    if (!hasInitializedScroll) {
      stickToBottomRef.current = true;
      const jumpToBottom = () => {
        listNode.scrollTop = listNode.scrollHeight;
      };

      // Force initial position to latest messages after first paint.
      window.requestAnimationFrame(jumpToBottom);
      window.requestAnimationFrame(jumpToBottom);
      setTimeout(jumpToBottom, 120);
      setTimeout(jumpToBottom, 320);
      setHasInitializedScroll(true);
      return;
    }

    if (!endRef.current) return;

    const distanceToBottom = listNode.scrollHeight - listNode.scrollTop - listNode.clientHeight;
    if (distanceToBottom <= 120) {
      stickToBottomRef.current = true;
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, hasInitializedScroll, isLoading, chatId]);

  useEffect(() => {
    const listNode = messageListRef.current;
    if (!listNode || typeof ResizeObserver === 'undefined') return undefined;

    const stickIfNeeded = () => {
      if (!stickToBottomRef.current) return;
      listNode.scrollTop = listNode.scrollHeight;
    };

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(stickIfNeeded);
    });

    resizeObserver.observe(listNode);
    // Capture image/content load events inside the scroll container.
    listNode.addEventListener('load', stickIfNeeded, true);

    return () => {
      resizeObserver.disconnect();
      listNode.removeEventListener('load', stickIfNeeded, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  function registerMessageNode(messageId, node) {
    if (!messageId) return;
    const key = String(messageId);
    if (!node) {
      messageNodeMapRef.current.delete(key);
      return;
    }
    messageNodeMapRef.current.set(key, node);
  }

  function handleJumpToReply(messageId) {
    const key = String(messageId || '');
    if (!key) return;

    const node = messageNodeMapRef.current.get(key);
    if (!node) {
      showNotice('Original message is not loaded yet.');
      return;
    }

    showNotice('');
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightMessageId(key);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightMessageId('');
    }, 1200);
  }


  async function handleLoadOlder() {
    if (clearedAt || !hasMore || !nextBefore || isLoadingOlder) return;

    try {
      setIsLoadingOlder(true);
      const listNode = messageListRef.current;
      const prevScrollHeight = listNode?.scrollHeight || 0;
      const prevScrollTop = listNode?.scrollTop || 0;

      const response = await getChatMessages(chatId, { limit: 30, before: nextBefore });
      const olderRows = response?.data?.messages || [];
      const normalized = await Promise.all(olderRows.map((row) => normalizeMessage(row)));
      setMessages((prev) => [...normalized, ...prev]);
      setHasMore(Boolean(response?.meta?.hasMore));
      setNextBefore(response?.meta?.nextBefore || null);

      window.requestAnimationFrame(() => {
        if (!listNode) return;
        const nextScrollHeight = listNode.scrollHeight;
        listNode.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load older messages');
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function refreshBlockStatus() {
    const targetUserId = String(chatInfo?.otherParticipant?.id || '');
    if (!targetUserId) return false;

    try {
      const blockResponse = await getBlockStatus(targetUserId);
      const relation = blockResponse?.data || {};
      const blockedBySelf = Boolean(relation.blockedBySelf);
      const blockedByOther = Boolean(relation.blockedByOther);
      setIsBlockedByMe(blockedBySelf);
      setIsBlockedByOther(blockedByOther);
      return blockedBySelf || blockedByOther;
    } catch {
      return false;
    }
  }

  async function sendTextMessage(plainText, failedClientMessageId = '', replyToMessageId = '') {
    if (!plainText.trim()) return;

    const outbound = await prepareOutboundMessage({
      text: plainText,
      encryptionEnabled: Boolean(chatInfo?.encryptionEnabled),
      chatId,
      recipientUserId: chatInfo?.otherParticipant?.id,
    });

    const socket = getSocket();
    const clientMessageId = crypto.randomUUID();

    if (socket?.connected) {
      const replyTarget = replyToMessageId ? messages.find((item) => item.id === replyToMessageId) : null;
      const pendingMessage = {
        id: `pending-${clientMessageId}`,
        clientMessageId,
        chatId,
        senderId: myUserId,
        text: plainText,
        createdAt: new Date().toISOString(),
        isOwn: true,
        isSeenByOther: false,
        pending: true,
        failed: false,
        failedReason: '',
        encryptionMode: outbound.encryptionMode,
        replyTo: replyTarget
          ? {
              messageId: String(replyTarget.id),
              senderId: String(replyTarget.senderId || ''),
              text: isImageMessagePayload(replyTarget) ? '[Photo]' : String(replyTarget.text || '').slice(0, 160),
              encryptionMode: replyTarget.encryptionMode || 'plain',
            }
          : null,
      };

      setMessages((prev) => {
        if (!failedClientMessageId) {
          return [...prev, pendingMessage];
        }

        return prev.map((item) => {
          if (item.clientMessageId !== failedClientMessageId) return item;
          return pendingMessage;
        });
      });

      socket.emit('message:send', {
        chatId,
        clientMessageId,
        replyToMessageId: replyToMessageId || undefined,
        ...outbound,
      });
      socket.emit('typing:stop', { chatId });
      return;
    }

    const response = await sendChatMessage(chatId, {
      ...outbound,
      replyToMessageId: replyToMessageId || undefined,
    });
    const nextMessage = response?.data?.message;
    if (nextMessage) {
      const normalized = await normalizeMessage(nextMessage);
      setMessages((prev) => {
        if (!failedClientMessageId) {
          return [...prev, normalized];
        }
        return prev.map((item) => (item.clientMessageId === failedClientMessageId ? normalized : item));
      });
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (editingMessageId) {
      const nextDraft = String(text || '').trim();
      if (!nextDraft) {
        setError('Message cannot be empty');
        return;
      }

      try {
        setIsSending(true);
        setError('');
        setNotice('');

        const target = messages.find((item) => item.id === editingMessageId);
        if (!target) {
          setError('Message is no longer available for editing');
          return;
        }

        const ok = await handleEditMessage(target, nextDraft);
        if (ok !== false) {
          setEditingMessageId('');
          setText('');
        }
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (reactionTarget?.messageId) {
      const emojiDraft = String(text || '').trim();
      if (!emojiDraft) {
        setError('Select or type an emoji first');
        return;
      }

      try {
        setIsSending(true);
        setError('');
        setNotice('');
        const ok = await handleReactToMessage({ id: reactionTarget.messageId }, emojiDraft);
        if (ok) {
          setText('');
          setReactionTarget(null);
        }
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (isBlockedByMe || isBlockedByOther) {
      setError('');
      showNotice('');
      return;
    }
    if (!text.trim() || isSending) return;

    try {
      setIsSending(true);
      setError('');
      setNotice('');

      const blocked = await refreshBlockStatus();
      if (blocked) {
        setError('');
        showNotice('');
        return;
      }

      const plainText = text.trim();
      await sendTextMessage(plainText, '', replyingTo?.messageId || '');
      setText('');
      setReplyingTo(null);
    } catch (err) {
      const code = err?.response?.data?.code;
      const nextMessage = err?.response?.data?.message || 'Unable to send message';
      if (code === 'CHAT_BLOCKED_BY_SELF') {
        setIsBlockedByMe(true);
        setIsBlockedByOther(false);
        setError('');
        showNotice('');
      } else if (code === 'CHAT_BLOCKED_BY_OTHER') {
        setIsBlockedByOther(true);
        setError('');
        showNotice('');
      } else {
        setError(nextMessage);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleRetryFailedMessage(message) {
    if (!message?.failed || isSending) return;

    try {
      setIsSending(true);
      setError('');
      setNotice('');

      const blocked = await refreshBlockStatus();
      if (blocked) {
        setError('');
        showNotice('');
        return;
      }

      if (message.uploadKind === 'image' && message.attachmentFile instanceof File) {
        await uploadImageMessage(message.attachmentFile, message);
      } else {
        await sendTextMessage(
          String(message.text || ''),
          String(message.clientMessageId || ''),
          String(message.replyTo?.messageId || '')
        );
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      const nextMessage = err?.response?.data?.message || 'Unable to send message';
      if (code === 'CHAT_BLOCKED_BY_SELF') {
        setIsBlockedByMe(true);
        setIsBlockedByOther(false);
        setError('');
        showNotice('');
      } else if (code === 'CHAT_BLOCKED_BY_OTHER') {
        setIsBlockedByOther(true);
        setError('');
        showNotice('');
      } else {
        setError(nextMessage);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleEditMessage(message, nextText) {
    const existing = String(message?.text || '').trim();
    const nextDraft = String(nextText || '').trim();
    if (!message?.id || !existing) return false;
    if (!nextDraft) {
      setError('Message cannot be empty');
      return false;
    }
    if (nextDraft === existing) {
      return true;
    }

    try {
      setError('');
      setNotice('');
      const response = await editChatMessage(chatId, message.id, nextDraft);
      const updated = response?.data?.message;
      if (!updated) return false;

      const normalized = await normalizeMessage(updated);
      setMessages((prev) => prev.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item)));
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to edit message');
      return false;
    }
  }

  function handleBeginEditMessage(message) {
    if (!message?.id) return;
    setEditingMessageId(String(message.id));
    setReplyingTo(null);
    setReactionTarget(null);
    setText(String(message.text || ''));
    setError('');
    setNotice('');
  }

  function handleBeginReplyMessage(message) {
    if (!message?.id || message.pending) return;

    setReplyingTo({
      messageId: String(message.id),
      senderId: String(message.senderId || ''),
      text: isImageMessagePayload(message) ? '[Photo]' : String(message.text || '').slice(0, 160),
      encryptionMode: message.encryptionMode || 'plain',
    });
    setEditingMessageId('');
    setReactionTarget(null);
    setError('');
    setNotice('');
  }

  function handleBeginCustomReaction(message) {
    if (!message?.id || message.pending) return;

    setReactionTarget({
      messageId: String(message.id),
      text: isImageMessagePayload(message) ? '[Photo]' : String(message.text || '').slice(0, 120),
    });
    setEditingMessageId('');
    setReplyingTo(null);
    setText('');
    setError('');
    setNotice('');
  }

  async function handleDeleteMessage(message) {
    if (!message?.id || message.pending) return;

    const confirmed = window.confirm('Delete this message for everyone? This cannot be undone.');
    if (!confirmed) return;

    try {
      setError('');
      setNotice('');
      await deleteChatMessage(chatId, message.id);

      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      setEditingMessageId((prev) => (prev === String(message.id) ? '' : prev));
      setReplyingTo((prev) => (prev?.messageId === String(message.id) ? null : prev));
      setReactionTarget((prev) => (prev?.messageId === String(message.id) ? null : prev));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete message');
    }
  }

  function handleCancelEditComposer() {
    setEditingMessageId('');
    setText('');
    setNotice('');
  }

  function handleCancelReplyComposer() {
    setReplyingTo(null);
    setNotice('');
  }

  function handleCancelReactionComposer() {
    setReactionTarget(null);
    setText('');
    setNotice('');
  }

  function buildPendingImageMessage(file, uploadToken, currentMessage = null) {
    const previewUrl = currentMessage?.imagePreviewUrl || URL.createObjectURL(file);
    return {
      id: `pending-image-${uploadToken}`,
      uploadToken,
      chatId,
      senderId: myUserId,
      text: '',
      imagePreviewUrl: previewUrl,
      isOwn: true,
      isSeenByOther: false,
      pending: true,
      failed: false,
      failedReason: '',
      createdAt: currentMessage?.createdAt || new Date().toISOString(),
      encryptionMode: 'plain',
      attachmentFile: file,
      uploadKind: 'image',
      reactions: [],
    };
  }

  async function uploadImageMessage(file, failedMessage = null) {
    const uploadToken = failedMessage?.uploadToken || crypto.randomUUID();
    const pendingImage = buildPendingImageMessage(file, uploadToken, failedMessage);

    setMessages((prev) => {
      if (!failedMessage) {
        return [...prev, pendingImage];
      }

      return prev.map((item) => {
        if (item.uploadToken !== uploadToken && item.id !== failedMessage.id) return item;
        return pendingImage;
      });
    });

    try {
      const response = await uploadChatImage(chatId, file);
      const nextMessage = response?.data?.message;
      if (!nextMessage) {
        throw new Error('Invalid server response while sending image');
      }

      const normalized = await normalizeMessage(nextMessage);
      setMessages((prev) => {
        const withoutPending = prev.filter((item) => item.uploadToken !== uploadToken);
        if (withoutPending.some((item) => item.id === normalized.id)) {
          return withoutPending;
        }
        return [...withoutPending, normalized];
      });
    } catch (err) {
      const nextReason = err?.response?.data?.message || err?.message || 'Unable to send image';
      setMessages((prev) =>
        prev.map((item) => {
          if (item.uploadToken !== uploadToken) return item;
          return {
            ...item,
            pending: false,
            failed: true,
            failedReason: nextReason,
            attachmentFile: file,
          };
        })
      );
      throw err;
    }
  }

  async function handleUploadImage(event) {
    const selectedFile = event.target.files?.[0] || null;
    event.target.value = '';

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please choose a valid image file');
      return;
    }

    if (editingMessageId) {
      setError('Finish editing your message before sending an image');
      return;
    }

    if (isBlockedByMe || isBlockedByOther) {
      setError('');
      showNotice('');
      return;
    }

    try {
      setIsUploadingImage(true);
      setError('');
      setNotice('');

      const blocked = await refreshBlockStatus();
      if (blocked) {
        setError('');
        showNotice('');
        return;
      }

      const preparedFile = await compressImageToLimit(selectedFile, MAX_CHAT_IMAGE_BYTES);
      await uploadImageMessage(preparedFile);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to send image');
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleReactToMessage(message, emoji) {
    if (!message?.id || !emoji) return;

    try {
      const response = await toggleChatMessageReaction(chatId, message.id, emoji);
      const updated = response?.data?.message;
      if (!updated) return false;

      const normalized = await normalizeMessage(updated);
      setMessages((prev) => prev.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item)));
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update reaction');
      return false;
    }
  }

  function handleInputChange(value) {
    setText(value);

    if (reactionTarget?.messageId) {
      return;
    }

    if (isBlockedByMe || isBlockedByOther) {
      return;
    }

    const socket = getSocket();
    if (!socket?.connected) return;

    socket.emit('typing:start', { chatId });

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId });
    }, 1200);
  }

  useEffect(() => {
    if (!reactionTarget?.messageId) return;
    textInputRef.current?.focus();
  }, [reactionTarget]);

  useEffect(() => {
    if (!reactionTarget?.messageId) return undefined;

    function handleOutsidePointerDown(event) {
      const formNode = chatSendRef.current;
      if (!formNode) return;
      if (!formNode.contains(event.target)) {
        handleCancelReactionComposer();
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        handleCancelReactionComposer();
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [reactionTarget]);

  if (isLoading) {
    return <section className="chat-window">Loading chat...</section>;
  }

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const autoMetaMessageId = latestMessage ? String(latestMessage.id) : '';
  const statusText = typingUserId ? `${chatInfo?.otherParticipant?.fullName || 'User'} is typing...` : '';
  const hasTypedText = Boolean(String(text || '').trim());
  const editingTargetMessage = editingMessageId
    ? messages.find((item) => String(item.id) === String(editingMessageId))
    : null;
  const editingDraftPreview = editingTargetMessage
    ? isImageMessagePayload(editingTargetMessage)
      ? '[Photo]'
      : String(editingTargetMessage.text || '').slice(0, 160)
    : 'Press send to save changes';

  function handleMessageListScroll(event) {
    if (!hasInitializedScroll) return;

    const node = event.currentTarget;
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceToBottom <= 120;

    if (distanceToBottom <= 120 && newIncomingCount > 0) {
      setNewIncomingCount(0);
    }

    if (!isLoadingOlder && hasMore && node.scrollTop <= 48) {
      handleLoadOlder();
    }
  }

  function handleJumpToLatest() {
    const listNode = messageListRef.current;
    if (!listNode) return;

    stickToBottomRef.current = true;
    listNode.scrollTo({ top: listNode.scrollHeight, behavior: 'smooth' });
    setNewIncomingCount(0);
  }

  const blockNotice = isBlockedByOther
    ? blockByOtherMessage
    : isBlockedByMe
      ? blockBySelfMessage
      : '';

  return (
    <section className="chat-window">
      {error && <p className="submit-error">{error}</p>}
      {blockNotice && <p className="submit-error">{blockNotice}</p>}
      {!blockNotice && notice && <p className="chat-inline-warning">{notice}</p>}

      <div className="message-list" ref={messageListRef} onScroll={handleMessageListScroll}>
        {isLoadingOlder && <p className="search-note message-loading-older">Loading older messages...</p>}
        {messages.length === 0 && <p className="search-note">No messages yet. Say hi.</p>}
        {messages.map((msg) => (
          <div
            key={msg.id}
            ref={(node) => registerMessageNode(msg.id, node)}
            data-message-id={msg.id}
            className={`message-row ${msg.isOwn ? 'own' : 'other'}`}
          >
            <MessageBubble
              message={msg}
              autoShowMeta={Boolean(autoMetaMessageId) && String(msg.id) === autoMetaMessageId}
              onRetry={handleRetryFailedMessage}
              onBeginEdit={handleBeginEditMessage}
              onBeginReply={handleBeginReplyMessage}
              onDelete={handleDeleteMessage}
              onReact={handleReactToMessage}
              onRequestCustomReaction={handleBeginCustomReaction}
              onJumpToReply={handleJumpToReply}
              isHighlighted={String(msg.id) === highlightMessageId}
            />
          </div>
        ))}
        {newIncomingCount > 0 && (
          <button type="button" className="chat-new-messages-chip" onClick={handleJumpToLatest}>
            {newIncomingCount === 1 ? '1 new message' : `${newIncomingCount} new messages`}
          </button>
        )}
        <div ref={endRef} />
      </div>

      {statusText && <p className={`chat-presence-line ${typingUserId ? 'typing' : ''}`}>{statusText}</p>}

      <form ref={chatSendRef} className={`chat-send ${editingMessageId ? 'is-editing' : ''} ${replyingTo ? 'is-replying' : ''} ${reactionTarget ? 'is-reacting' : ''}`} onSubmit={handleSend}>
        {(replyingTo?.messageId || editingMessageId || reactionTarget?.messageId) && (
          <div className="chat-reply-draft">
            <div className="chat-reply-draft-copy">
              <p>
                {editingMessageId
                  ? 'Editing message'
                  : reactionTarget?.messageId
                    ? 'Adding Emoji'
                    : replyingTo?.senderId === myUserId
                      ? 'Replying to yourself'
                      : 'Replying to message'}
              </p>
              <small>
                {editingMessageId
                  ? editingDraftPreview
                  : reactionTarget?.messageId
                    ? reactionTarget.text || 'Message'
                    : replyingTo?.text || (replyingTo?.encryptionMode === 'e2ee' ? '[Encrypted message]' : 'Message')}
              </small>
            </div>
            <button
              type="button"
              className="chat-reply-draft-close"
              onClick={editingMessageId ? handleCancelEditComposer : reactionTarget?.messageId ? handleCancelReactionComposer : handleCancelReplyComposer}
              aria-label={editingMessageId ? 'Cancel edit' : reactionTarget?.messageId ? 'Cancel reaction' : 'Cancel reply'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 7l10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="chat-media-input"
          onChange={handleUploadImage}
        />
        <div
          className={`chat-input-wrap ${editingMessageId ? 'is-editing' : ''} ${reactionTarget?.messageId ? 'is-reacting' : ''} ${editingMessageId || reactionTarget?.messageId || hasTypedText ? 'has-inline-send' : ''}`}
        >
          {!editingMessageId && !reactionTarget?.messageId && (
            <button
              type="button"
              className="chat-media-btn chat-media-btn-inline"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending || isUploadingImage || isBlockedByMe || isBlockedByOther}
              aria-label="Send photo"
              title="Send photo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h1.5a3.5 3.5 0 0 1 3.5 3.5v7A3.5 3.5 0 0 1 16.5 20h-9A3.5 3.5 0 0 1 4 16.5v-7A3.5 3.5 0 0 1 7.5 6H9V5zm3 4.2A4.3 4.3 0 1 0 16.3 13 4.3 4.3 0 0 0 12 9.2zm0 1.8a2.5 2.5 0 1 1-2.5 2.5A2.5 2.5 0 0 1 12 11z" />
              </svg>
            </button>
          )}
          <input
            ref={textInputRef}
            value={text}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={((isBlockedByMe || isBlockedByOther) && !editingMessageId && !reactionTarget?.messageId) || isUploadingImage}
            placeholder={
              editingMessageId
                ? 'Edit message...'
                : reactionTarget?.messageId
                  ? 'Select Emoji...'
                  : blockNotice
                    ? 'Messaging disabled'
                    : 'Write a message...'
            }
            maxLength={2000}
          />
          {(editingMessageId || reactionTarget?.messageId || hasTypedText) && (
            <button
              className="chat-inline-send-btn"
              type="submit"
              disabled={
                isSending ||
                isUploadingImage ||
                (!editingMessageId && !reactionTarget?.messageId && (isBlockedByMe || isBlockedByOther)) ||
                !hasTypedText
              }
              aria-label={editingMessageId ? 'Save message' : reactionTarget?.messageId ? 'Add reaction' : 'Send message'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M21.1 2.3a1 1 0 0 0-1.02-.2L2.92 8.7a1 1 0 0 0 .08 1.9l7.25 2.3 2.31 7.24a1 1 0 0 0 .9.68h.04a1 1 0 0 0 .9-.6L21.9 3.3a1 1 0 0 0-.8-1zM12.4 17l-1.5-4.7a1 1 0 0 0-.64-.64L5.6 10.2l11.6-4.5L12.4 17z" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default ChatWindow;
