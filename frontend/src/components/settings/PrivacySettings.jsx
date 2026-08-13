function PrivacySettings({ settings, onChange }) {
  return (
    <section className="settings-card">
      <h2>Privacy & Presence</h2>
      <div className="settings-group">
        <label className="settings-row settings-row-toggle">
          <span>Show Online Status</span>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(settings.showOnlineStatus)}
              onChange={(e) => onChange({ showOnlineStatus: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </span>
        </label>

        <label className="settings-row settings-row-toggle">
          <span>Read Receipts</span>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(settings.readReceiptsEnabled)}
              onChange={(e) => onChange({ readReceiptsEnabled: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </span>
        </label>

        <label className="settings-row settings-row-toggle">
          <span>Private Account</span>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(settings.isPrivate)}
              onChange={(e) => onChange({ isPrivate: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </span>
        </label>
      </div>

      <div className="settings-group settings-group-divider">
        <div className="theme-stack">
          <span>Theme Mode</span>
          <div className="theme-segment" role="radiogroup" aria-label="Theme mode">
            {['system', 'light', 'dark'].map((mode) => {
              const selected = (settings.theme || 'system') === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-segment-btn ${selected ? 'active' : ''}`}
                  onClick={() => onChange({ theme: mode })}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}

export default PrivacySettings;
