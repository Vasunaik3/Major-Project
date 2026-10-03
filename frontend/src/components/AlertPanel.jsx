import Icon from './Icon.jsx';

function timeAgo(value) {
  if (!value) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

function severityKey(severity) {
  if (severity === 'WARNING') return 'medium';
  if (severity === 'INFO') return 'low';
  return severity?.toLowerCase() || 'low';
}

export default function AlertPanel({ alerts, onResolve, resolvingId, canResolve = false }) {
  return (
    <article className="panel alert-panel" id="alerts">
      <div className="panel-heading">
        <div><h2>Recent alerts</h2><p>Storage events that need attention</p></div>
        <span className="panel-count">{alerts.length} recent</span>
      </div>
      {alerts.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Icon name="check" size={19} /></div><strong>All clear</strong><span>No recent alerts from the simulator.</span></div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div className="alert-row" key={alert._id}>
              <div className={`alert-severity alert-severity--${severityKey(alert.severity)}`}><Icon name="alerts" size={16} /></div>
              <div className="alert-copy"><div className="alert-title-row"><strong>{(alert.type || 'SYSTEM').replaceAll('_', ' ')}</strong><span className={`severity-label severity-label--${severityKey(alert.severity)}`}>{alert.severity}</span></div><p>{alert.message}</p><small>{alert.deviceId ? `${alert.deviceId} · ` : ''}{timeAgo(alert.timestamp)}</small></div>
              {!alert.resolved && canResolve && <button type="button" className="resolve-button" disabled={resolvingId === alert._id} onClick={() => onResolve(alert._id)}>{resolvingId === alert._id ? '…' : 'Resolve'}</button>}
              {alert.resolved && <span className="resolved-label">Resolved</span>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
