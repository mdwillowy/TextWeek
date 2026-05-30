function PrivacySettings({ settings, onChange, onSave, isSaving }) {
  return (
    <section className="settings-card">
      <h2>Privacy Settings</h2>
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
      </div>

      <div className="settings-group settings-group-divider">
        <div className="settings-field">
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

      <button className="btn-primary" onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </section>
  );
}

export default PrivacySettings;
