import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsPanel from '../components/settings/SettingsPanel';

function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-page app-page--settings">
      <main className="settings-shell">
        <header className="settings-topbar site-header">
          <div>
            <Link className="site-brand" to="/home">
              TEXT WEEK
            </Link>
            <p className="site-header-copy">Settings</p>
          </div>
          <div className="site-nav">
            {isAdmin ? (
              <Link className="btn-ghost" to="/admin">
                Admin
              </Link>
            ) : null}
            <Link className="btn-ghost" to="/home">
              Back to Home
            </Link>
          </div>
        </header>

        <SettingsPanel mode="page" />
      </main>
    </div>
  );
}

export default SettingsPage;
