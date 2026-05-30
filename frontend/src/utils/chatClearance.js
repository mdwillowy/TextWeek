function storageKey(userId) {
  return `textweek_cleared_chats_${String(userId || 'anonymous')}`;
}

function hiddenStorageKey(userId) {
  return `textweek_hidden_chats_${String(userId || 'anonymous')}`;
}

function toTimestamp(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function getClearedChatsMap(userId) {
  if (!userId) return {};

  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function getHiddenChatsMap(userId) {
  if (!userId) return {};

  try {
    const raw = localStorage.getItem(hiddenStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function getChatClearTimestamp(userId, chatId) {
  const map = getClearedChatsMap(userId);
  const value = map?.[chatId];
  return typeof value === 'number' ? value : 0;
}

export function clearChatForUser(userId, chatId) {
  if (!userId || !chatId) return 0;

  const map = getClearedChatsMap(userId);
  const hiddenMap = getHiddenChatsMap(userId);
  const clearedAt = Date.now();
  const next = {
    ...map,
    [chatId]: clearedAt,
  };
  const nextHidden = {
    ...hiddenMap,
    [chatId]: true,
  };

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
    localStorage.setItem(hiddenStorageKey(userId), JSON.stringify(nextHidden));
  } catch {
    // Ignore write failures.
  }

  window.dispatchEvent(
    new CustomEvent('chat:local-cleared', {
      detail: { chatId, clearedAt },
    })
  );

  return clearedAt;
}

export function restoreChatInStackForUser(userId, chatId) {
  if (!userId || !chatId) return false;

  const hiddenMap = getHiddenChatsMap(userId);
  if (!hiddenMap[chatId]) {
    return false;
  }

  const nextHidden = { ...hiddenMap };
  delete nextHidden[chatId];

  try {
    localStorage.setItem(hiddenStorageKey(userId), JSON.stringify(nextHidden));
  } catch {
    // Ignore write failures.
  }

  window.dispatchEvent(
    new CustomEvent('chat:local-restored', {
      detail: { chatId },
    })
  );

  return true;
}

export function isMessageVisibleAfterClear(messageCreatedAt, clearedAt) {
  if (!clearedAt) return true;
  return toTimestamp(messageCreatedAt) > clearedAt;
}

export function hasVisibleMessageAfterClear(lastMessageAt, clearedAt) {
  if (!clearedAt) return true;
  return toTimestamp(lastMessageAt) > clearedAt;
}
