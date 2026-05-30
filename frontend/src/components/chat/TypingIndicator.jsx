function TypingIndicator({ isTyping, label = 'User is typing...' }) {
  if (!isTyping) return null;
  return <p className="typing-indicator">{label}</p>;
}

export default TypingIndicator;
