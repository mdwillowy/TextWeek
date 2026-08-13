import mongoose from 'mongoose';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { buildParticipantKey, sortParticipantIds } from '../utils/chatParticipant.js';
import { getBlockRelationship, isBlockedEitherWay } from '../utils/blocking.js';
import { normalizeEncryptionPayload } from '../services/encryptionService.js';
import { sendTextweekPushNotification } from '../services/textweekPushService.js';
import { emitToChat, emitToUser } from '../socket/index.js';
import { env } from '../config/env.js';

function toReactionDTO(reactions, currentUserId = null) {
  const rows = Array.isArray(reactions) ? reactions : [];

  return rows
    .map((row) => {
      const users = Array.isArray(row?.users) ? row.users.map((id) => String(id)) : [];
      const base = {
        emoji: String(row?.emoji || ''),
        users,
        count: users.length,
      };

      if (!base.emoji || base.count === 0) {
        return null;
      }

      if (currentUserId) {
        return {
          ...base,
          reactedByMe: users.includes(String(currentUserId)),
        };
      }

      return base;
    })
    .filter(Boolean);
}

function toBasicUser(userDoc) {
  const showOnlineStatus = userDoc?.settings?.showOnlineStatus ?? true;
  return {
    id: String(userDoc._id),
    fullName: userDoc.fullName,
    username: userDoc.username,
    avatarUrl: userDoc.avatarUrl || '',
    bio: userDoc.bio || '',
    isOnline: showOnlineStatus ? Boolean(userDoc.isOnline) : false,
    lastSeen: showOnlineStatus ? userDoc.lastSeen || null : null,
  };
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

function toAttachmentDTO(attachment) {
  if (!attachment?.url) {
    return null;
  }

  return {
    type: attachment.type || 'image',
    url: String(attachment.url),
    sizeBytes: Number(attachment.sizeBytes || 0) || null,
    mimeType: attachment.mimeType || null,
    originalName: attachment.originalName || null,
  };
}

function toRealtimeMessage(messageDoc) {
  return {
    id: String(messageDoc._id),
    chatId: String(messageDoc.chat),
    senderId: String(messageDoc.sender),
    text: messageDoc.text,
    attachment: toAttachmentDTO(messageDoc.attachment),
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

function toMessage(messageDoc, currentUserId, allowReadReceipts = true) {
  const readByOther = messageDoc.readBy?.some((id) => String(id) !== String(currentUserId)) || false;
  return {
    id: String(messageDoc._id),
    chatId: String(messageDoc.chat),
    senderId: String(messageDoc.sender),
    text: messageDoc.text,
    attachment: toAttachmentDTO(messageDoc.attachment),
    encryptedPayload: messageDoc.encryptedPayload || null,
    encryptionMode: messageDoc.encryptionMode || 'plain',
    nonce: messageDoc.nonce || null,
    aad: messageDoc.aad || null,
    keyInfo: messageDoc.keyInfo || null,
    createdAt: messageDoc.createdAt,
    editedAt: messageDoc.editedAt || null,
    replyTo: toReplyDTO(messageDoc.replyTo),
    reactions: toReactionDTO(messageDoc.reactions, currentUserId),
    isOwn: String(messageDoc.sender) === String(currentUserId),
    isSeenByOther: allowReadReceipts ? readByOther : false,
  };
}

function allowReadReceiptsForChat(chat, currentUserId) {
  if (!chat || chat.chatType !== 'direct') {
    return true;
  }

  const otherParticipant = chat.participants.find(
    (participant) => String(participant?._id || participant) !== String(currentUserId)
  );
  return otherParticipant?.settings?.readReceiptsEnabled ?? true;
}

function toChatDTO(chat, currentUserId) {
  const otherParticipant = chat.participants.find((p) => String(p._id) !== String(currentUserId));
  return {
    id: String(chat._id),
    chatType: chat.chatType,
    encryptionEnabled: Boolean(chat.encryptionEnabled),
    participants: chat.participants.map(toBasicUser),
    otherParticipant: otherParticipant ? toBasicUser(otherParticipant) : null,
    lastMessageAt: chat.lastMessageAt,
    lastMessagePreview: chat.lastMessagePreview || '',
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

async function assertChatParticipant(chatId, userId) {
  const chat = await Chat.findById(chatId).populate(
    'participants',
    'fullName username avatarUrl bio isOnline lastSeen settings.showOnlineStatus settings.readReceiptsEnabled'
  );

  if (!chat) {
    return { error: { status: 404, message: 'Chat not found' } };
  }

  const isParticipant = chat.participants.some((participant) => String(participant._id) === String(userId));

  if (!isParticipant) {
    return { error: { status: 403, message: 'You are not a participant of this chat' } };
  }

  return { chat };
}

async function assertCanSendInDirectChat(chat, currentUserId) {
  const otherParticipant = (chat.participants || []).find(
    (participant) => String(participant?._id || participant) !== String(currentUserId)
  );
  const otherUserId = otherParticipant ? String(otherParticipant._id || otherParticipant) : null;
  const relation = await getBlockRelationship(currentUserId, otherUserId);

  if (relation.blockedBySelf) {
    return {
      error: {
        status: 403,
        code: 'CHAT_BLOCKED_BY_SELF',
        message: 'Unblock first to send message',
      },
    };
  }

  if (relation.blockedByOther) {
    return {
      error: {
        status: 403,
        code: 'CHAT_BLOCKED_BY_OTHER',
        message: 'You were blocked by this user',
      },
    };
  }

  return { otherUserId };
}

function isPushSubscriptionExpiredError(err) {
  if (!err) return false;

  const statusCode = Number(err.statusCode || err?.response?.status || 0);
  const message = String(err.message || err?.response?.data?.message || '');

  return statusCode === 404 || statusCode === 410 || /expired|gone|no longer valid|not found/i.test(message);
}

async function triggerDirectMessagePush(receiverUserId, senderUsername, senderUserId) {
  if (!receiverUserId || !senderUsername) return;

  const receiverUser = await User.findById(receiverUserId).select('username devicePushSubscriptions');
  if (!receiverUser || !Array.isArray(receiverUser.devicePushSubscriptions) || receiverUser.devicePushSubscriptions.length === 0) {
    return;
  }

  const payload = {
    notification: {
      title: 'TextWeek Message',
      body: `New message from ${senderUsername}`,
    },
  };

  const remainingSubscriptions = [];

  for (const subscription of receiverUser.devicePushSubscriptions) {
    const subscriptionCopy = { ...subscription.toObject?.() || subscription };
    try {
      await sendTextweekPushNotification(
        { _id: receiverUser._id, devicePushSubscriptions: [subscriptionCopy] },
        payload
      );
      remainingSubscriptions.push(subscriptionCopy);
    } catch (err) {
      if (isPushSubscriptionExpiredError(err)) {
        console.warn('[TextWeek Push] Expired subscription removed', {
          userId: String(receiverUser._id),
          senderUserId: String(senderUserId),
          endpoint: subscriptionCopy.endpoint,
          reason: err?.message || 'expired',
        });
        continue;
      }

      remainingSubscriptions.push(subscriptionCopy);
    }
  }

  if (remainingSubscriptions.length !== receiverUser.devicePushSubscriptions.length) {
    receiverUser.devicePushSubscriptions = remainingSubscriptions;
    await receiverUser.save();
  }
}

export async function createOrOpenDirectChat(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { otherUserId } = req.params;

    if (String(currentUserId) === String(otherUserId)) {
      return res.status(400).json({ success: false, message: 'Cannot create direct chat with yourself' });
    }

    const otherUser = await User.findById(otherUserId).select(
      'fullName username avatarUrl bio isPrivate isOnline lastSeen settings.showOnlineStatus settings.readReceiptsEnabled'
    );
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const key = buildParticipantKey(currentUserId, otherUserId);
    const [p1, p2] = sortParticipantIds(currentUserId, otherUserId);

    let chat = await Chat.findOne({ participantKey: key }).populate(
      'participants',
      'fullName username avatarUrl bio isOnline lastSeen settings.showOnlineStatus settings.readReceiptsEnabled'
    );

    // Keep existing chats accessible even when users are blocked or private.
    if (chat) {
      return res.json({
        success: true,
        data: {
          chat: toChatDTO(chat, currentUserId),
        },
      });
    }

    if (otherUser.isPrivate) {
      return res.status(403).json({ success: false, message: 'Account is private' });
    }

    const blocked = await isBlockedEitherWay(currentUserId, otherUserId);
    if (blocked) {
      return res.status(403).json({ success: false, message: 'Chat is restricted due to a blocklist rule' });
    }

    chat = await Chat.create({
      participantKey: key,
      participants: [new mongoose.Types.ObjectId(p1), new mongoose.Types.ObjectId(p2)],
      chatType: 'direct',
    });
    chat = await Chat.findById(chat._id).populate(
      'participants',
      'fullName username avatarUrl bio isOnline lastSeen settings.showOnlineStatus settings.readReceiptsEnabled'
    );

    return res.json({
      success: true,
      data: {
        chat: toChatDTO(chat, currentUserId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getChatById(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      data: {
        chat: toChatDTO(chat, currentUserId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listChats(req, res, next) {
  try {
    const currentUserId = req.authUser._id;

    const chats = await Chat.find({ participants: currentUserId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'fullName username avatarUrl bio isOnline lastSeen settings.showOnlineStatus settings.readReceiptsEnabled')
      .lean();

    const chatIds = chats.map((chat) => chat._id);

    const unreadAggregation = chatIds.length
      ? await Message.aggregate([
          {
            $match: {
              chat: { $in: chatIds },
              sender: { $ne: currentUserId },
              readBy: { $ne: currentUserId },
            },
          },
          { $group: { _id: '$chat', count: { $sum: 1 } } },
        ])
      : [];

    const unreadMap = new Map(unreadAggregation.map((item) => [String(item._id), item.count]));

    const data = chats.map((chat) => {
      return {
        ...toChatDTO(chat, currentUserId),
        unreadCount: unreadMap.get(String(chat._id)) || 0,
      };
    });

    return res.json({
      success: true,
      data: { chats: data },
      meta: { total: data.length },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const before = req.query.before ? new Date(req.query.before) : null;

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const query = { chat: chat._id };
    if (before) {
      query.createdAt = { $lt: before };
    }

    const rows = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const hasMore = rows.length === limit;
    const ordered = rows.reverse();

    const allowReadReceipts = allowReadReceiptsForChat(chat, currentUserId);

    return res.json({
      success: true,
      data: {
        messages: ordered.map((msg) => toMessage(msg, currentUserId, allowReadReceipts)),
      },
      meta: {
        limit,
        hasMore,
        nextBefore: ordered.length > 0 ? ordered[0].createdAt : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;
    const normalized = normalizeEncryptionPayload(req.body || {});
    if (!normalized.ok) {
      return res.status(normalized.status).json({ success: false, message: normalized.message });
    }

    const { mode } = normalized;
    const { text, encryptedPayload, nonce, aad, keyInfo } = normalized.data;
    const replyToMessageId = req.body?.replyToMessageId ? String(req.body.replyToMessageId) : '';

    if (mode === 'e2ee' && !env.featureE2EE) {
      return res.status(503).json({ success: false, message: 'Encrypted messaging is temporarily disabled' });
    }

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const sendPermission = await assertCanSendInDirectChat(chat, currentUserId);
    if (sendPermission.error) {
      return res.status(sendPermission.error.status).json({
        success: false,
        code: sendPermission.error.code,
        message: sendPermission.error.message,
      });
    }
    const otherUserId = sendPermission.otherUserId;

    let replyTo = null;
    if (replyToMessageId) {
      const targetMessage = await Message.findOne({ _id: replyToMessageId, chat: chat._id }).select(
        '_id sender text encryptionMode'
      );

      if (!targetMessage) {
        return res.status(404).json({ success: false, message: 'Reply target message not found' });
      }

      replyTo = {
        messageId: targetMessage._id,
        sender: targetMessage.sender,
        text:
          targetMessage.encryptionMode === 'plain'
            ? targetMessage.attachment?.url
              ? '[Photo]'
              : String(targetMessage.text || '').slice(0, 160)
            : '[Encrypted message]',
        encryptionMode: targetMessage.encryptionMode || 'plain',
      };
    }

    const message = await Message.create({
      chat: chat._id,
      sender: currentUserId,
      text: mode === 'plain' ? text : '',
      encryptionMode: mode,
      encryptedPayload: mode === 'e2ee' ? encryptedPayload : null,
      nonce: mode === 'e2ee' ? nonce : null,
      aad: mode === 'e2ee' ? aad || null : null,
      keyInfo: mode === 'e2ee' ? keyInfo : null,
      replyTo,
      readBy: [currentUserId],
    });

    chat.lastMessageAt = message.createdAt;
    chat.lastMessagePreview = mode === 'plain' ? text.slice(0, 160) : '[Encrypted message]';
    await chat.save();

    if (otherUserId) {
      emitToUser(String(otherUserId), 'chat:updated', {
        chatId: String(chat._id),
        lastMessage: chat.lastMessagePreview,
        lastMessageAt: chat.lastMessageAt,
        unreadCountDelta: 1,
      });
    }

    emitToUser(String(currentUserId), 'chat:updated', {
      chatId: String(chat._id),
      lastMessage: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
      unreadCountDelta: 0,
    });

    emitToChat(String(chat._id), 'message:new', {
      chatId: String(chat._id),
      message: toRealtimeMessage(message),
    });

    const senderUser = await User.findById(currentUserId).select('username');
    if (senderUser) {
      await triggerDirectMessagePush(otherUserId, senderUser.username || 'Someone', currentUserId);
    }

    const allowReadReceipts = allowReadReceiptsForChat(chat, currentUserId);

    return res.status(201).json({
      success: true,
      message: 'Message sent',
      data: {
        message: toMessage(message.toObject(), currentUserId, allowReadReceipts),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadChatImage(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (chat.encryptionEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Turn off encrypted mode to send image attachments',
      });
    }

    const sendPermission = await assertCanSendInDirectChat(chat, currentUserId);
    if (sendPermission.error) {
      return res.status(sendPermission.error.status).json({
        success: false,
        code: sendPermission.error.code,
        message: sendPermission.error.message,
      });
    }
    const otherUserId = sendPermission.otherUserId;

    const imageUrl = req.file?.path || req.file?.secure_url;
    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Upload failed. Missing image URL.' });
    }
    const message = await Message.create({
      chat: chat._id,
      sender: currentUserId,
      text: '',
      attachment: {
        type: 'image',
        url: imageUrl,
        sizeBytes: req.file.size || null,
        mimeType: req.file.mimetype || null,
        originalName: req.file.originalname || null,
      },
      encryptionMode: 'plain',
      readBy: [currentUserId],
    });

    chat.lastMessageAt = message.createdAt;
    chat.lastMessagePreview = '[Photo]';
    await chat.save();

    if (otherUserId) {
      emitToUser(String(otherUserId), 'chat:updated', {
        chatId: String(chat._id),
        lastMessage: chat.lastMessagePreview,
        lastMessageAt: chat.lastMessageAt,
        unreadCountDelta: 1,
      });
    }

    emitToUser(String(currentUserId), 'chat:updated', {
      chatId: String(chat._id),
      lastMessage: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
      unreadCountDelta: 0,
    });

    emitToChat(String(chat._id), 'message:new', {
      chatId: String(chat._id),
      message: toRealtimeMessage(message),
    });

    const senderUser = await User.findById(currentUserId).select('username');
    if (senderUser) {
      await triggerDirectMessagePush(otherUserId, senderUser.username || 'Someone', currentUserId);
    }

    const allowReadReceipts = allowReadReceiptsForChat(chat, currentUserId);

    return res.status(201).json({
      success: true,
      message: 'Image sent',
      data: {
        message: toMessage(message.toObject(), currentUserId, allowReadReceipts),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId, messageId } = req.params;
    const nextText = String(req.body?.text || '').trim();

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const message = await Message.findOne({ _id: messageId, chat: chat._id });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (String(message.sender) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    if (message.encryptionMode !== 'plain') {
      return res.status(400).json({ success: false, message: 'Encrypted messages cannot be edited' });
    }

    message.text = nextText;
    message.editedAt = new Date();
    await message.save();

    if (chat.lastMessageAt && new Date(chat.lastMessageAt).getTime() === new Date(message.createdAt).getTime()) {
      chat.lastMessagePreview = nextText.slice(0, 160);
      await chat.save();

      emitToChat(String(chat._id), 'chat:updated', {
        chatId: String(chat._id),
        lastMessage: chat.lastMessagePreview,
        lastMessageAt: chat.lastMessageAt,
        unreadCountDelta: 0,
      });
    }

    emitToChat(String(chat._id), 'message:updated', {
      chatId: String(chat._id),
      message: toRealtimeMessage(message),
    });

    const allowReadReceipts = allowReadReceiptsForChat(chat, currentUserId);

    return res.json({
      success: true,
      message: 'Message edited',
      data: {
        message: toMessage(message.toObject(), currentUserId, allowReadReceipts),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function reactToMessage(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId, messageId } = req.params;
    const emoji = String(req.body?.emoji || '');

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const message = await Message.findOne({ _id: messageId, chat: chat._id });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const userId = String(currentUserId);
    const rows = (Array.isArray(message.reactions) ? message.reactions : []).map((row) => ({
      emoji: String(row?.emoji || ''),
      users: Array.isArray(row?.users) ? row.users.map((id) => String(id)) : [],
    }));

    const currentRow = rows.find((row) => row.users.includes(userId));
    const currentEmoji = currentRow?.emoji || '';
    let reacted = false;

    if (currentEmoji === emoji) {
      for (const row of rows) {
        row.users = row.users.filter((id) => id !== userId);
      }
      reacted = false;
    } else {
      for (const row of rows) {
        row.users = row.users.filter((id) => id !== userId);
      }

      const targetRow = rows.find((row) => row.emoji === emoji);
      if (targetRow) {
        targetRow.users.push(userId);
      } else {
        rows.push({ emoji, users: [userId] });
      }
      reacted = true;
    }

    const normalizedRows = rows
      .map((row) => ({
        emoji: row.emoji,
        users: row.users.map((id) => new mongoose.Types.ObjectId(id)),
      }))
      .filter((row) => row.emoji && row.users.length > 0);

    message.reactions = normalizedRows;
    await message.save();

    emitToChat(String(chat._id), 'message:updated', {
      chatId: String(chat._id),
      message: toRealtimeMessage(message),
    });

    const allowReadReceipts = allowReadReceiptsForChat(chat, currentUserId);

    return res.json({
      success: true,
      message: reacted ? 'Reaction added' : 'Reaction removed',
      data: {
        reacted,
        message: toMessage(message.toObject(), currentUserId, allowReadReceipts),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId, messageId } = req.params;

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const message = await Message.findOne({ _id: messageId, chat: chat._id });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (String(message.sender) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own messages' });
    }

    await Message.deleteOne({ _id: message._id });

    const latest = await Message.findOne({ chat: chat._id }).sort({ createdAt: -1 }).select('createdAt text encryptionMode');

    chat.lastMessageAt = latest?.createdAt || null;
    if (!latest) {
      chat.lastMessagePreview = '';
    } else if ((latest.encryptionMode || 'plain') === 'plain') {
      chat.lastMessagePreview = String(latest.text || '').slice(0, 160);
    } else {
      chat.lastMessagePreview = '[Encrypted message]';
    }
    await chat.save();

    emitToChat(String(chat._id), 'message:deleted', {
      chatId: String(chat._id),
      messageId: String(message._id),
    });

    const participantIds = (chat.participants || []).map((participant) => String(participant?._id || participant));
    for (const participantId of participantIds) {
      emitToUser(participantId, 'chat:updated', {
        chatId: String(chat._id),
        lastMessage: chat.lastMessagePreview,
        lastMessageAt: chat.lastMessageAt,
        unreadCountDelta: 0,
      });
    }

    return res.json({
      success: true,
      message: 'Message deleted permanently',
      data: {
        messageId: String(message._id),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function markChatRead(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const updateResult = await Message.updateMany(
      {
        chat: chat._id,
        sender: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
      },
      {
        $addToSet: { readBy: currentUserId },
      }
    );

    const readReceiptsEnabled = env.featureReadReceipts && (req.authUser?.settings?.readReceiptsEnabled ?? true);
    if (readReceiptsEnabled) {
      emitToChat(
        String(chat._id),
        'message:read:update',
        {
          chatId: String(chat._id),
          readerUserId: String(currentUserId),
          messageIds: [],
          readAt: new Date().toISOString(),
        },
        String(currentUserId)
      );
    }

    return res.json({
      success: true,
      message: 'Messages marked as read',
      data: {
        modifiedCount: updateResult.modifiedCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleChatEncryption(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Encryption toggle is disabled in production' });
    }

    const currentUserId = req.authUser._id;
    const { chatId } = req.params;
    const enabled = Boolean(req.body.enabled);

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    chat.encryptionEnabled = enabled;
    await chat.save();

    emitToChat(String(chat._id), 'chat:updated', {
      chatId: String(chat._id),
      encryptionEnabled: enabled,
      lastMessage: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
      unreadCountDelta: 0,
    });

    return res.json({
      success: true,
      data: {
        chat: toChatDTO(chat, currentUserId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteChat(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { chatId } = req.params;

    const { chat, error } = await assertChatParticipant(chatId, currentUserId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const participantIds = (chat.participants || []).map((id) => String(id._id || id));

    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });

    for (const participantId of participantIds) {
      emitToUser(participantId, 'chat:removed', {
        chatId: String(chat._id),
      });
    }

    return res.json({
      success: true,
      message: 'Chat deleted permanently',
      data: {
        chatId: String(chat._id),
        deletedMessages: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDirectChat(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { otherUserId } = req.params;

    if (String(currentUserId) === String(otherUserId)) {
      return res.status(400).json({ success: false, message: 'Cannot delete self direct chat' });
    }

    const key = buildParticipantKey(currentUserId, otherUserId);
    const chat = await Chat.findOne({ participantKey: key, chatType: 'direct' }).select('_id participants').lean();

    if (!chat) {
      return res.json({
        success: true,
        message: 'No direct chat found',
        data: { chatId: null, deletedMessages: false },
      });
    }

    const participantIds = (chat.participants || []).map((id) => String(id));

    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });

    for (const participantId of participantIds) {
      emitToUser(participantId, 'chat:removed', {
        chatId: String(chat._id),
      });
    }

    return res.json({
      success: true,
      message: 'Direct chat deleted permanently',
      data: {
        chatId: String(chat._id),
        deletedMessages: true,
      },
    });
  } catch (err) {
    next(err);
  }
}
