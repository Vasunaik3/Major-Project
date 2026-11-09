import Icon from './Icon.jsx';

export default function TopBar({ user, systemOnline, lastUpdated, onLogout }) {
  const initials = user?.name
    ?.split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const updatedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <header className="topbar">
      {/* Left — system status + last updated */}
      <div className="topbar-left">
        <div className={`system-status-badge${systemOnline ? ' system-status-badge--online' : ' system-status-badge--offline'}`}>
          <span className={`status-dot ${systemOnline ? 'status-dot--green' : 'status-dot--red'}`} />
          {systemOnline ? 'System operational' : 'Backend unavailable'}
        </div>

        <div className="topbar-updated">
          <Icon name="clock" size={13} />
          <span>Updated {updatedTime}</span>
        </div>
      </div>

      {/* Right — user info + logout */}
      <div className="topbar-right">
        <div className="topbar-user-group">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div className="topbar-user-copy">
            <strong>{user?.name || 'User'}</strong>
          </div>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </header>
  );
}
