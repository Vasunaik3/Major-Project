import Icon from './Icon.jsx';
import { roleLabel } from '../utils/permissions.js';

export default function TopBar({ user, systemOnline, lastUpdated, onLogout }) {
  const initials = user?.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'OP';
  return (
    <header className="topbar">
      <div className="topbar-status-group">
        <div className="system-status"><span className={`status-dot ${systemOnline ? 'status-dot--green' : 'status-dot--red'}`} />
          <span>{systemOnline ? 'System operational' : 'Backend unavailable'}</span>
        </div>
        <div className="topbar-updated"><Icon name="clock" size={15} /><span>Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
      </div>
      <div className="topbar-user">
        <div className="avatar">{initials}</div>
        <div className="topbar-user-copy"><strong>{user?.name || 'Operator'}</strong><small>{roleLabel(user?.role)}</small></div>
        <button type="button" className="icon-button logout-button" onClick={onLogout} title="Log out" aria-label="Log out"><Icon name="logout" size={18} /></button>
      </div>
    </header>
  );
}
