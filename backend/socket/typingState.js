const typingMap = new Map();
const TYPING_TIMEOUT_MS = 4000;

function keyFor(chatId, userId) {
  return `${chatId}:${userId}`;
}

export function setTyping(chatId, userId, onExpire) {
  const key = keyFor(chatId, userId);

  const existing = typingMap.get(key);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(() => {
    typingMap.delete(key);
    onExpire();
  }, TYPING_TIMEOUT_MS);

  typingMap.set(key, { timer });
}

export function clearTyping(chatId, userId) {
  const key = keyFor(chatId, userId);
  const item = typingMap.get(key);
  if (item?.timer) {
    clearTimeout(item.timer);
  }
  typingMap.delete(key);
}
