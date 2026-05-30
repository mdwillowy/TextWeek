function PresenceBadge({ isOnline, lastSeen, showLastSeen = true, inline = false }) {
  const baseClass = `presence-line ${inline ? 'inline' : ''}`.trim();

  if (isOnline) {
    return (
      <span className={`${baseClass} online`}>
        <span className="presence-dot" />
        Online
      </span>
    );
  }

  if (!showLastSeen) {
    return <span className={baseClass}>Offline</span>;
  }

  if (!lastSeen) {
    return <span className={baseClass}>Offline</span>;
  }

  const dt = new Date(lastSeen);
  const label = dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return <span className={baseClass}>Last seen {label}</span>;
}

export default PresenceBadge;
