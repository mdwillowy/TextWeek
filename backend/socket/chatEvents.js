import mongoose from 'mongoose';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { getBlockRelationship } from '../utils/blocking.js';
import { normalizeEncryptionPayload } from '../services/encryptionService.js';
import { env } from '../config/env.js';
import { clearTyping, setTyping } from './typingState.js';

const dedupeByUser = new Map();

function toReactionDTO(reactions) {
  const rows = Array.isArray(reactions) ? reactions : [];
  return rows
    .map((row) => {
      const users = Array.isArray(row?.users) ? row.users.map((id) => String(id)) : [];
      const emoji = String(row?.emoji || '');
      if (!emoji || users.length === 0) return null;
      return {
        emoji,
        users,
        count: users.length,
      };
    })
    .filter(Boolean);
}

function toReplyDTO(replyTo) {
  if (!replyTo?.messageId) {
    return null;
  }

  return {
    messageId: String(replyTo.messageId),
    senderId: replyTo.sender ? String(replyTo.sender) : '',
    text: String(replyTo.text || ''),
    encryptionMode: replyTo.encryptionMode || 'plain',
  };
}

function roomForChat(chatId) {
  return `chat:${chatId}`;
}

function toMessageDTO(messageDoc) {
  return {
    id: String(messageDoc._id),
    chatId: String(messageDoc.chat),
    senderId: String(messageDoc.sender),
    text: messageDoc.text || '',
    encryptionMode: messageDoc.encryptionMode || 'plain',
    encryptedPayload: messageDoc.encryptedPayload || null,
    nonce: messageDoc.nonce || null,
    aad: messageDoc.aad || null,
    keyInfo: messageDoc.keyInfo || null,
    createdAt: messageDoc.createdAt,
    editedAt: messageDoc.editedAt || null,
    replyTo: toReplyDTO(messageDoc.replyTo),
    reactions: toReactionDTO(messageDoc.reactions),
    readBy: (messageDoc.readBy || []).map((id) => String(id)),
  };
}

async function getChatForParticipant(chatId, userId) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return null;
  }

  return Chat.findOne({
    _id: chatId,
    participants: userId,
  });
}

function markDedupe(userId, clientMessageId, messageId) {
  const key = String(userId);
  const map = dedupeByUser.get(key) || new Map();
  map.set(clientMessageId, messageId);
  dedupeByUser.set(key, map);

  if (map.size > 200) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

function findDedupe(userId, clientMessageId) {
  const map = dedupeByUser.get(String(userId));
  return map?.get(clientMessageId) || null;
}

export function registerChatEvents({ io, socket, emitToChat, emitToUser }) {
  const userId = String(socket.authUser._id);

  function onSafe(eventName, handler) {
    socket.on(eventName, (...args) => {
      Promise.resolve(handler(...args)).catch((err) => {
        console.error(`[socket:${eventName}]`, err?.message || err);
        socket.emit('error:event', {
          event: eventName,
          message: 'Socket event failed',
        });
      });
    });
  }

  onSafe('chat:join', async ({ chatId }) => {
    const chat = await getChatForParticipant(chatId, userId);
    if (!chat) {
      socket.emit('error:event', { event: 'chat:join', message: 'Invalid chat access' });
      return;
    }

    socket.join(roomForChat(chatId));
  });

  onSafe('chat:leave', ({ chatId }) => {
    socket.leave(roomForChat(chatId));
  });

  onSafe('typing:start', async ({ chatId }) => {
    const chat = await getChatForParticipant(chatId, userId);
    if (!chat) return;

    setTyping(chatId, userId, () => {
      emitToChat(chatId, 'typing:update', { chatId, userId, isTyping: false }, userId);
    });

    emitToChat(chatId, 'typing:update', { chatId, userId, isTyping: true }, userId);
  });

  onSafe('typing:stop', async ({ chatId }) => {
    const chat = await getChatForParticipant(chatId, userId);
    if (!chat) return;

    clearTyping(chatId, userId);
    emitToChat(chatId, 'typing:update', { chatId, userId, isTyping: false }, userId);
  });

  onSafe('message:send', async (payload = {}) => {
    const { chatId, clientMessageId } = payload;
    const chat = await getChatForParticipant(chatId, userId);

    if (!chat) {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'CHAT_ACCESS_INVALID',
        message: 'Invalid chat access',
        clientMessageId,
      });
      return;
    }

    if (!clientMessageId || typeof clientMessageId !== 'string') {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'CLIENT_MESSAGE_ID_REQUIRED',
        message: 'clientMessageId is required',
      });
      return;
    }

    const existingMessageId = findDedupe(userId, clientMessageId);
    if (existingMessageId) {
      socket.emit('message:ack', {
        clientMessageId,
        messageId: existingMessageId,
      });
      return;
    }

    const normalized = normalizeEncryptionPayload(payload);
    if (!normalized.ok) {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'MESSAGE_VALIDATION_FAILED',
        message: normalized.message,
        clientMessageId,
      });
      return;
    }

    const { mode } = normalized;
    const { text: safeText, encryptedPayload, nonce, aad, keyInfo } = normalized.data;
    const replyToMessageId = payload?.replyToMessageId ? String(payload.replyToMessageId) : '';

    if (mode === 'e2ee' && !env.featureE2EE) {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'E2EE_DISABLED',
        message: 'Encrypted messaging is temporarily disabled',
        clientMessageId,
      });
      return;
    }

    const otherUserId = chat.participants.find((id) => String(id) !== userId);
    const relation = await getBlockRelationship(userId, otherUserId);
    if (relation.blockedBySelf) {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'CHAT_BLOCKED_BY_SELF',
        message: 'Unblock first to send message',
        clientMessageId,
      });
      return;
    }
    if (relation.blockedByOther) {
      socket.emit('error:event', {
        event: 'message:send',
        code: 'CHAT_BLOCKED_BY_OTHER',
        message: 'You were blocked by this user',
        clientMessageId,
      });
      return;
    }

    let replyTo = null;
    if (replyToMessageId) {
      const targetMessage = await Message.findOne({ _id: replyToMessageId, chat: chat._id }).select(
        '_id sender text encryptionMode'
      );

      if (!targetMessage) {
        socket.emit('error:event', {
          event: 'message:send',
          code: 'REPLY_TARGET_NOT_FOUND',
          message: 'Reply target message not found',
          clientMessageId,
        });
        return;
      }

      replyTo = {
        messageId: targetMessage._id,
        sender: targetMessage.sender,
        text:
          targetMessage.encryptionMode === 'plain'
            ? String(targetMessage.text || '').slice(0, 160)
            : '[Encrypted message]',
        encryptionMode: targetMessage.encryptionMode || 'plain',
      };
    }

    const message = await Message.create({
      chat: chat._id,
      sender: userId,
      text: mode === 'plain' ? safeText : '',
      encryptionMode: mode,
      encryptedPayload,
      nonce,
      aad,
      keyInfo,
      replyTo,
      readBy: [userId],
    });

    chat.lastMessageAt = message.createdAt;
    chat.lastMessagePreview = mode === 'plain' ? safeText.slice(0, 160) : '[Encrypted message]';
    await chat.save();

    markDedupe(userId, clientMessageId, String(message._id));

    socket.emit('message:ack', {
      clientMessageId,
      messageId: String(message._id),
      createdAt: message.createdAt,
    });

    emitToChat(chatId, 'message:new', {
      chatId,
      message: toMessageDTO(message.toObject()),
      clientMessageId,
    });

    if (otherUserId) {
      emitToUser(String(otherUserId), 'chat:updated', {
        chatId: String(chat._id),
        lastMessage: chat.lastMessagePreview,
        lastMessageAt: chat.lastMessageAt,
        unreadCountDelta: 1,
      });
    }

    emitToUser(userId, 'chat:updated', {
      chatId: String(chat._id),
      lastMessage: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
      unreadCountDelta: 0,
    });
  });

  onSafe('message:read', async ({ chatId, messageIds = [] } = {}) => {
    const chat = await getChatForParticipant(chatId, userId);
    if (!chat) {
      return;
    }

    const query = {
      chat: chat._id,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    };

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      query._id = { $in: messageIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) };
    }

    const unreadBefore = await Message.countDocuments(query);

    const updatedMessages = await Message.find(query).select('_id');
    const ids = updatedMessages.map((m) => m._id);

    if (ids.length > 0) {
      await Message.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { readBy: userId } }
      );
    }

    const payload = {
      chatId,
      readerUserId: userId,
      messageIds: ids.map((id) => String(id)),
      readAt: new Date().toISOString(),
    };

    emitToChat(chatId, 'message:read:update', payload, userId);

    if (unreadBefore > 0) {
      emitToUser(userId, 'chat:updated', {
        chatId,
        unreadCountDelta: -unreadBefore,
        lastMessageAt: chat.lastMessageAt,
        lastMessage: chat.lastMessagePreview,
      });
    }
  });
}
