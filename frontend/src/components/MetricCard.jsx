import Icon from './Icon.jsx';

export default function MetricCard({ label, value, unit, icon, tone, footnote, status }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}><Icon name={icon} size={19} /></div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value-row">
          <span className="metric-value">{value ?? '—'}</span>
          {unit && <span className="metric-unit">{unit}</span>}
          {status && <span className={`condition-pill condition-pill--${status.toLowerCase()}`}>{status}</span>}
        </div>
        <div className="metric-footnote">{footnote}</div>
      </div>
    </article>
  );
}
