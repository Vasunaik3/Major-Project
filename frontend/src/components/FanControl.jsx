import Icon from './Icon.jsx';

export default function FanControl({ fan, onControl, busy }) {
  const mode = fan?.mode || 'AUTO';
  const status = fan?.status || 'OFF';
  return (
    <article className="panel fan-panel" id="fan-control">
      <div className="panel-heading">
        <div><h2>Simulated Fan Control</h2><p>No physical fan or relay is connected</p></div>
        <div className={`fan-mode-tag ${mode === 'AUTO' ? 'fan-mode-tag--auto' : 'fan-mode-tag--manual'}`}><span className="status-dot" />{mode}</div>
      </div>
      <div className="fan-current-state">
        <div className={`fan-visual ${status === 'ON' ? 'fan-visual--on' : ''}`}><Icon name="fan" size={31} /></div>
        <div><span className="fan-state-caption">SIMULATED FAN</span><strong className={status === 'ON' ? 'fan-is-on' : ''}>{status}</strong></div>
      </div>
      <div className="fan-reason-row"><span>Reason</span><strong>{fan?.reason || 'Normal storage conditions'}</strong></div>
      <div className="fan-controls fan-command-buttons">
        <button type="button" className={`fan-mode-button fan-command-on ${mode === 'MANUAL' && status === 'ON' ? 'selected' : ''}`} disabled={busy || (mode === 'MANUAL' && status === 'ON')} onClick={() => onControl({ mode: 'MANUAL', status: 'ON' })}>Turn ON</button>
        <button type="button" className={`fan-mode-button fan-command-off ${mode === 'MANUAL' && status === 'OFF' ? 'selected' : ''}`} disabled={busy || (mode === 'MANUAL' && status === 'OFF')} onClick={() => onControl({ mode: 'MANUAL', status: 'OFF' })}>Turn OFF</button>
        <button type="button" className={`fan-mode-button ${mode === 'AUTO' ? 'selected' : ''}`} disabled={busy || mode === 'AUTO'} onClick={() => onControl({ mode: 'AUTO' })}>AUTO Mode</button>
      </div>
      <div className="manual-note">{mode === 'MANUAL' ? 'Manual override is active. Select AUTO Mode to resume simulated automatic control.' : 'Auto mode uses temperature, humidity, and gas thresholds with minimum ON/OFF durations.'}</div>
    </article>
  );
}
