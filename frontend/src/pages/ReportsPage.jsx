import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import SensorChart from '../components/SensorChart.jsx';
import { apiRequest } from '../services/api.js';

/* ── helpers (all unchanged from original) ──────────────── */
function dateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
function formatValue(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}
function formatDuration(ms = 0) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const total = Math.round(ms / 60_000);
  const days  = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins  = total % 60;
  if (days)  return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins} min`;
}
function displayCondition(v) {
  return v === 'GOOD' ? 'NORMAL' : v || '—';
}
function csvCell(value) {
  let t = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replaceAll('"', '""')}"`;
}
export function createCsv(report) {
  const rows = [['Section', 'Timestamp', 'Metric', 'Value', 'Status', 'Details']];
  const add = (...cells) => rows.push(cells.map(csvCell));
  add('Report', '', 'From', report.range.from, '', '');
  add('Report', '', 'To',   report.range.to,   '', '');
  add('Sensor summary', '', 'Temperature average °C',  report.sensorSummary.temperature.average, '', `min ${report.sensorSummary.temperature.minimum}; max ${report.sensorSummary.temperature.maximum}`);
  add('Sensor summary', '', 'Humidity average %',       report.sensorSummary.humidity.average,    '', `min ${report.sensorSummary.humidity.minimum}; max ${report.sensorSummary.humidity.maximum}`);
  add('Sensor summary', '', 'Gas-level average index',  report.sensorSummary.gasLevel.average,    '', `min ${report.sensorSummary.gasLevel.minimum}; max ${report.sensorSummary.gasLevel.maximum}`);
  add('Sensor summary', '', 'Sensor sample count', report.sensorSummary.samples, '', '');
  add('Alerts', '', 'Total alerts', report.alerts.total, '', `Unresolved: ${report.alerts.unresolved}`);
  for (const [sev, cnt] of Object.entries(report.alerts.bySeverity)) add('Alerts', '', sev, cnt, '', '');
  for (const [cond, dur] of Object.entries(report.conditionTime.milliseconds)) add('Condition duration', '', cond, formatDuration(dur), '', `Estimated; sample gaps capped at ${report.conditionTime.maxSampleGapMs} ms`);
  add('Fan summary', '', 'ON events',          report.fanActivity.onEvents,    '', `ON time: ${formatDuration(report.fanActivity.onDurationMs)}`);
  add('Fan summary', '', 'OFF events',         report.fanActivity.offEvents,   '', `OFF time: ${formatDuration(report.fanActivity.offDurationMs)}`);
  add('Fan summary', '', 'AUTO / MANUAL events', `${report.fanActivity.autoEvents} / ${report.fanActivity.manualEvents}`, '', '');
  if (report.storageHistoryTruncated) add('Data note', '', 'Storage history', `Latest ${report.storageHistory.length} of ${report.storageHistoryCount} records exported`, '', '');
  if (report.fanActivity.historyTruncated) add('Data note', '', 'Fan activity history', `Latest ${report.fanActivity.history.length} of ${report.fanActivity.historyCount} records exported`, '', '');
  if (report.alerts.historyTruncated) add('Data note', '', 'Alert history', `Latest ${report.alerts.history.length} alerts exported`, '', 'Severity totals include the full range.');
  for (const p of report.charts) {
    add('Sensor chart bucket', p.timestamp, 'Temperature °C', p.temperature, '', 'Bucket average');
    add('Sensor chart bucket', p.timestamp, 'Humidity %',     p.humidity,    '', 'Bucket average');
    add('Sensor chart bucket', p.timestamp, 'Gas level index', p.gasLevel,   '', 'Bucket average');
  }
  for (const item of report.storageHistory)    add('Storage condition history', item.timestamp, 'Overall condition', displayCondition(item.status || item.condition), item.status || item.condition, item.message || item.reason);
  for (const item of report.fanActivity.history) add('Fan activity history', item.timestamp, item.mode, item.status, item.status, item.reason);
  for (const item of report.alerts.history)    add('Alert history', item.timestamp, item.type, item.sensorValue, item.severity, item.message);
  return rows.map((r) => r.join(',')).join('\r\n');
}

/* ── sub-components ─────────────────────────────────────── */
function SummaryCard({ label, value, unit, icon, tone, detail }) {
  return (
    <article className="report-summary-card">
      <div className={`report-summary-icon report-summary-icon--${tone}`}>
        <Icon name={icon} size={17} />
      </div>
      <div className="report-summary-copy">
        <span>{label}</span>
        <strong>{value}<small>{unit}</small></strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function DataTable({ title, description, columns, rows, emptyMessage }) {
  return (
    <section className="panel report-table-panel">
      <div className="panel-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        <span className="panel-count">{rows.length} records</span>
      </div>
      {rows.length === 0 ? (
        <div className="report-table-empty">{emptyMessage}</div>
      ) : (
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row._id || `${row.timestamp}-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── main page ──────────────────────────────────────────── */
export default function ReportsPage() {
  const today       = dateInputValue(new Date());
  const sevenAgo    = dateInputValue(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [preset,         setPreset]         = useState('LAST_7_DAYS');
  const [fromDate,       setFromDate]       = useState(sevenAgo);
  const [toDate,         setToDate]         = useState(today);
  const [appliedRange,   setAppliedRange]   = useState({ from: sevenAgo, to: today });
  const [report,         setReport]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');

  const loadReport = useCallback(async (range) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ from: range.from, to: range.to });
      const result = await apiRequest(`/reports?${q.toString()}`);
      setReport(result.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReport(appliedRange); }, [appliedRange, loadReport]);

  const selectPreset = (next) => {
    setPreset(next);
    if (next === 'CUSTOM') return;
    const end   = dateInputValue(new Date());
    const days  = next === 'TODAY' ? 1 : next === 'LAST_30_DAYS' ? 30 : 7;
    const start = dateInputValue(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    setFromDate(start); setToDate(end);
    setAppliedRange({ from: start, to: end });
  };

  const applyCustom = (e) => {
    e.preventDefault();
    if (!fromDate || !toDate) { setError('Select both a start and end date.'); return; }
    if (fromDate > toDate)    { setError('The start date must be on or before the end date.'); return; }
    setAppliedRange({ from: fromDate, to: toDate });
  };

  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob([`\uFEFF${createCsv(report)}`], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `smart-onion-storage-report-${appliedRange.from}-to-${appliedRange.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!report && loading) {
    return (
      <div className="reports-loading">
        <span className="refresh-spinner"><Icon name="clock" size={18} /></span>
        Loading historical report…
      </div>
    );
  }

  const conditionTime  = report?.conditionTime?.milliseconds || {};
  const alerts         = report?.alerts;
  const fan            = report?.fanActivity;
  const history        = report?.storageHistory || [];
  const fanHistory     = fan?.history || [];
  const alertHistory   = alerts?.history || [];

  return (
    <div className="reports-page">
      {/* Header */}
      <section className="page-intro reports-page-intro">
        <div>
          <div className="eyebrow">HISTORICAL DATA <span className="eyebrow-line" /></div>
          <h1>Storage reports</h1>
          <p>Review sensor trends, storage conditions, alerts, and simulated fan activity.</p>
        </div>
        <button
          type="button"
          className="btn btn-forest report-export-button"
          onClick={exportCsv}
          disabled={!report || loading}
        >
          <Icon name="download" size={15} /> Export CSV
        </button>
      </section>

      {/* Date filter */}
      <section className="panel report-filter-panel">
        <div className="report-filter-heading">
          <div>
            <strong>Report period</strong>
            <span>Choose a period for historical MongoDB data.</span>
          </div>
          <div className="report-presets" role="group" aria-label="Date presets">
            {[['TODAY','Today'],['LAST_7_DAYS','Last 7 days'],['LAST_30_DAYS','Last 30 days'],['CUSTOM','Custom range']].map(([v, l]) => (
              <button
                key={v} type="button"
                className={preset === v ? 'is-selected' : ''}
                onClick={() => selectPreset(v)}
              >{l}</button>
            ))}
          </div>
        </div>

        {preset === 'CUSTOM' && (
          <form className="custom-range-form" onSubmit={applyCustom}>
            <label>From<input className="form-control" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required /></label>
            <label>To<input className="form-control" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required /></label>
            <button type="submit" className="btn btn-forest" disabled={loading}>Apply range</button>
          </form>
        )}
        <div className="report-period-caption">
          Showing {formatDate(report?.range?.from)} — {formatDate(report?.range?.to)}
        </div>
      </section>

      {error && (
        <div className="analysis-error" role="alert">
          <Icon name="warning" size={15} />
          <span>{error}</span>
          <button type="button" onClick={() => loadReport(appliedRange)} aria-label="Retry">Retry</button>
        </div>
      )}
      {loading && report && <div className="report-refreshing">Updating report data…</div>}

      {report && (
        <>
          {/* Summary cards */}
          <section className="report-summary-grid" aria-label="Historical sensor summary">
            <SummaryCard label="TEMPERATURE AVG" value={formatValue(report.sensorSummary.temperature.average)} unit="°C" icon="temperature" tone="orange" detail={`Min ${formatValue(report.sensorSummary.temperature.minimum)}° · Max ${formatValue(report.sensorSummary.temperature.maximum)}°`} />
            <SummaryCard label="HUMIDITY AVG"    value={formatValue(report.sensorSummary.humidity.average)}    unit="%" icon="humidity" tone="blue"   detail={`Min ${formatValue(report.sensorSummary.humidity.minimum)}% · Max ${formatValue(report.sensorSummary.humidity.maximum)}%`} />
            <SummaryCard label="GAS LEVEL AVG"   value={formatValue(report.sensorSummary.gasLevel.average)}    unit="index" icon="gas" tone="purple" detail={`Min ${formatValue(report.sensorSummary.gasLevel.minimum)} · Max ${formatValue(report.sensorSummary.gasLevel.maximum)}`} />
            <SummaryCard label="ALERTS"          value={alerts?.total || 0} unit="" icon="alerts" tone="orange" detail={`${alerts?.unresolved || 0} unresolved · ${alerts?.bySeverity?.CRITICAL || 0} critical`} />
            <SummaryCard label="WARNING TIME"    value={formatDuration(conditionTime.WARNING)}  unit="" icon="clock"   tone="orange" detail="Estimated from condition samples" />
            <SummaryCard label="CRITICAL TIME"   value={formatDuration(conditionTime.CRITICAL)} unit="" icon="leaf"    tone="purple" detail="Estimated from condition samples" />
            <SummaryCard label="FAN ON TIME"     value={formatDuration(fan?.onDurationMs)}      unit="" icon="fan"     tone="green"  detail={`${fan?.onEvents || 0} ON · ${fan?.offEvents || 0} OFF activity records`} />
            <SummaryCard label="SENSOR SAMPLES"  value={report.sensorSummary.samples}           unit="" icon="sensors" tone="blue"   detail="Historical MongoDB readings" />
          </section>

          {report.conditionTime.estimatedFromSamples && (
            <div className="report-estimate-note">
              Condition durations are estimated from samples and capped at{' '}
              {Math.round(report.conditionTime.maxSampleGapMs / 1000)} seconds across a sample gap.
              Fan durations use recorded ON/OFF changes.
            </div>
          )}

          {/* Trend charts */}
          <section className="dashboard-section reports-charts-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SENSOR HISTORY</span>
                <h2>Environmental trends</h2>
                <p>Charts show time-bucket averages from stored sensor readings.</p>
              </div>
              <span className="chart-range">{report.charts.length} TIME BUCKETS</span>
            </div>
            <div className="charts-grid reports-chart-grid">
              <SensorChart title="Temperature vs time" description="Storage temperature"        data={report.charts} dataKey="temperature" unit="°C" color="#C2601A" gradientId="rptTempGrad"  rangeLabel="REPORT RANGE" />
              <SensorChart title="Humidity vs time"    description="Relative humidity"           data={report.charts} dataKey="humidity"    unit="%"  color="#1D5EA8" gradientId="rptHumGrad"   rangeLabel="REPORT RANGE" />
              <SensorChart title="Gas level vs time"   description="Simulated air-quality index" data={report.charts} dataKey="gasLevel"   unit=""   color="#6B3FA8" gradientId="rptGasGrad"   rangeLabel="REPORT RANGE" />
            </div>
            {report.sensorSummary.samples === 0 && (
              <div className="report-table-empty">No sensor readings were recorded in this period.</div>
            )}
          </section>

          {/* Duration cards */}
          <section className="dashboard-section report-duration-grid">
            <article className="panel duration-detail-card">
              <div className="panel-heading">
                <div><h2>Time by storage condition</h2><p>Estimated duration in each observed state</p></div>
              </div>
              <div className="duration-breakdown">
                {['NORMAL', 'WARNING', 'CRITICAL'].map((s) => (
                  <div className="duration-row" key={s}>
                    <span className={`condition-dot condition-dot--${s.toLowerCase()}`} />
                    <span>{s}</span>
                    <strong>{formatDuration(conditionTime[s])}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel duration-detail-card">
              <div className="panel-heading">
                <div><h2>Fan activity</h2><p>Simulated fan event counts and time</p></div>
                <span className="analysis-step-tag">SIMULATED</span>
              </div>
              <div className="fan-report-grid">
                <div><span>ON EVENTS</span><strong>{fan?.onEvents || 0}</strong></div>
                <div><span>OFF EVENTS</span><strong>{fan?.offEvents || 0}</strong></div>
                <div><span>AUTO EVENTS</span><strong>{fan?.autoEvents || 0}</strong></div>
                <div><span>MANUAL EVENTS</span><strong>{fan?.manualEvents || 0}</strong></div>
                <div><span>ON TIME</span><strong>{formatDuration(fan?.onDurationMs)}</strong></div>
                <div><span>OFF TIME</span><strong>{formatDuration(fan?.offDurationMs)}</strong></div>
              </div>
            </article>
          </section>

          {/* Data tables */}
          <section className="dashboard-section report-tables-section">
            <DataTable
              title="Storage condition history"
              description={`Most recent condition records · ${report.storageHistoryCount} total in range`}
              rows={history}
              emptyMessage="No condition records in this period."
              columns={[
                { key: 'timestamp', label: 'Time', render: (r) => formatDate(r.timestamp) },
                { key: 'status', label: 'Condition', render: (r) => <span className={`report-condition-tag report-condition-tag--${displayCondition(r.status || r.condition).toLowerCase()}`}>{displayCondition(r.status || r.condition)}</span> },
                { key: 'temperatureStatus', label: 'Temperature' },
                { key: 'humidityStatus',    label: 'Humidity'    },
                { key: 'gasStatus',         label: 'Gas'         },
                { key: 'message', label: 'Details', render: (r) => r.message || r.reason || '—' },
              ]}
            />
            {report.storageHistoryTruncated && (
              <div className="report-estimate-note">Showing the latest 500 condition records. CSV export includes the same bounded history.</div>
            )}

            <DataTable
              title="Fan activity history"
              description={`Simulated fan activity · ${fan?.historyCount || 0} total in range`}
              rows={fanHistory}
              emptyMessage="No fan activity records in this period."
              columns={[
                { key: 'timestamp', label: 'Time', render: (r) => formatDate(r.timestamp) },
                { key: 'mode',   label: 'Mode'   },
                { key: 'status', label: 'Fan'    },
                { key: 'reason', label: 'Reason' },
              ]}
            />
            {fan?.historyTruncated && (
              <div className="report-estimate-note">Showing the latest 500 fan activity records.</div>
            )}

            <DataTable
              title="Alert history"
              description="Alerts created during the selected period"
              rows={alertHistory}
              emptyMessage="No alerts in this period."
              columns={[
                { key: 'timestamp', label: 'Time', render: (r) => formatDate(r.timestamp) },
                { key: 'type',     label: 'Type',     render: (r) => (r.type || '').replaceAll('_', ' ') },
                { key: 'severity', label: 'Severity' },
                { key: 'message',  label: 'Message'  },
                { key: 'resolved', label: 'State', render: (r) => r.resolved ? 'Resolved' : 'Open' },
              ]}
            />
            {alerts?.historyTruncated && (
              <div className="report-estimate-note">Showing the latest 500 alerts. Totals include the full selected range.</div>
            )}
          </section>
        </>
      )}

      <footer className="dashboard-footer">
        <span>OnionOS · Storage reports</span>
        <span>Historical sensor data · AI prediction metrics are not included</span>
      </footer>
    </div>
  );
}
