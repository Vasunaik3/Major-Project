import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import SensorChart from '../components/SensorChart.jsx';
import { apiRequest } from '../services/api.js';

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatValue(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function formatDuration(milliseconds = 0) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0 min';
  const totalMinutes = Math.round(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function displayCondition(value) {
  return value === 'GOOD' ? 'NORMAL' : value || '—';
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(report) {
  const rows = [['Section', 'Timestamp', 'Metric', 'Value', 'Status', 'Details']];
  const add = (...cells) => rows.push(cells.map(csvCell));

  add('Report', '', 'From', report.range.from, '', '');
  add('Report', '', 'To', report.range.to, '', '');
  add('Sensor summary', '', 'Temperature average °C', report.sensorSummary.temperature.average, '', `min ${report.sensorSummary.temperature.minimum}; max ${report.sensorSummary.temperature.maximum}`);
  add('Sensor summary', '', 'Humidity average %', report.sensorSummary.humidity.average, '', `min ${report.sensorSummary.humidity.minimum}; max ${report.sensorSummary.humidity.maximum}`);
  add('Sensor summary', '', 'Gas-level average index', report.sensorSummary.gasLevel.average, '', `min ${report.sensorSummary.gasLevel.minimum}; max ${report.sensorSummary.gasLevel.maximum}`);
  add('Sensor summary', '', 'Sensor sample count', report.sensorSummary.samples, '', '');
  add('Alerts', '', 'Total alerts', report.alerts.total, '', `Unresolved: ${report.alerts.unresolved}`);
  for (const [severity, count] of Object.entries(report.alerts.bySeverity)) add('Alerts', '', severity, count, '', '');
  for (const [condition, duration] of Object.entries(report.conditionTime.milliseconds)) add('Condition duration', '', condition, formatDuration(duration), '', `Estimated; sample gaps capped at ${report.conditionTime.maxSampleGapMs} ms`);
  add('Fan summary', '', 'ON events', report.fanActivity.onEvents, '', `ON time: ${formatDuration(report.fanActivity.onDurationMs)}`);
  add('Fan summary', '', 'OFF events', report.fanActivity.offEvents, '', `OFF time: ${formatDuration(report.fanActivity.offDurationMs)}`);
  add('Fan summary', '', 'AUTO / MANUAL events', `${report.fanActivity.autoEvents} / ${report.fanActivity.manualEvents}`, '', '');
  if (report.storageHistoryTruncated) add('Data note', '', 'Storage history', `Latest ${report.storageHistory.length} of ${report.storageHistoryCount} records exported`, '', '');
  if (report.fanActivity.historyTruncated) add('Data note', '', 'Fan activity history', `Latest ${report.fanActivity.history.length} of ${report.fanActivity.historyCount} records exported`, '', '');
  if (report.alerts.historyTruncated) add('Data note', '', 'Alert history', `Latest ${report.alerts.history.length} alerts exported`, '', 'Severity totals include the full range.');
  for (const point of report.charts) {
    add('Sensor chart bucket', point.timestamp, 'Temperature °C', point.temperature, '', 'Bucket average');
    add('Sensor chart bucket', point.timestamp, 'Humidity %', point.humidity, '', 'Bucket average');
    add('Sensor chart bucket', point.timestamp, 'Gas level index', point.gasLevel, '', 'Bucket average');
  }
  for (const item of report.storageHistory) {
    add('Storage condition history', item.timestamp, 'Overall condition', displayCondition(item.status || item.condition), item.status || item.condition, item.message || item.reason);
  }
  for (const item of report.fanActivity.history) {
    add('Fan activity history', item.timestamp, item.mode, item.status, item.status, item.reason);
  }
  for (const item of report.alerts.history) {
    add('Alert history', item.timestamp, item.type, item.sensorValue, item.severity, item.message);
  }
  return rows.map((row) => row.join(',')).join('\r\n');
}

function SummaryCard({ label, value, unit, icon, tone, detail }) {
  return (
    <article className="report-summary-card">
      <div className={`report-summary-icon report-summary-icon--${tone}`}><Icon name={icon} size={18} /></div>
      <div className="report-summary-copy"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></div>
    </article>
  );
}

function DataTable({ title, description, columns, rows, emptyMessage }) {
  return (
    <section className="panel report-table-panel">
      <div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="panel-count">{rows.length} records</span></div>
      {rows.length === 0 ? <div className="report-table-empty">{emptyMessage}</div> : (
        <div className="report-table-scroll">
          <table className="report-table">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={row._id || `${row.timestamp}-${index}`}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : (row[column.key] ?? '—')}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const today = dateInputValue(new Date());
  const sevenDaysAgo = dateInputValue(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [preset, setPreset] = useState('LAST_7_DAYS');
  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ from: sevenDaysAgo, to: today });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (range) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      const result = await apiRequest(`/reports?${query.toString()}`);
      setReport(result.report);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReport(appliedRange); }, [appliedRange, loadReport]);

  const selectPreset = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'CUSTOM') return;
    const end = dateInputValue(new Date());
    const days = nextPreset === 'TODAY' ? 1 : nextPreset === 'LAST_30_DAYS' ? 30 : 7;
    const start = dateInputValue(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    setFromDate(start);
    setToDate(end);
    setAppliedRange({ from: start, to: end });
  };

  const applyCustomRange = (event) => {
    event.preventDefault();
    if (!fromDate || !toDate) {
      setError('Select both a start and end date.');
      return;
    }
    if (fromDate > toDate) {
      setError('The start date must be on or before the end date.');
      return;
    }
    setAppliedRange({ from: fromDate, to: toDate });
  };

  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob([`\uFEFF${createCsv(report)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `smart-onion-storage-report-${appliedRange.from}-to-${appliedRange.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!report && loading) return <div className="reports-loading"><span className="refresh-spinner"><Icon name="clock" size={18} /></span> Loading historical report…</div>;

  const conditionTime = report?.conditionTime?.milliseconds || {};
  const alerts = report?.alerts;
  const fan = report?.fanActivity;
  const history = report?.storageHistory || [];
  const fanHistory = fan?.history || [];
  const alertHistory = alerts?.history || [];

  return (
    <div className="reports-page">
      <section className="page-intro reports-page-intro">
        <div><div className="eyebrow">HISTORICAL DATA <span className="eyebrow-line" /></div><h1>Storage reports</h1><p>Review sensor trends, storage conditions, alerts, and simulated fan activity.</p></div>
        <button type="button" className="btn btn-forest report-export-button" onClick={exportCsv} disabled={!report || loading}><Icon name="reports" size={16} /> Export CSV</button>
      </section>

      <section className="panel report-filter-panel">
        <div className="report-filter-heading"><div><strong>Report period</strong><span>Choose a period for historical MongoDB data.</span></div><div className="report-presets" role="group" aria-label="Report date presets">
          {[['TODAY', 'Today'], ['LAST_7_DAYS', 'Last 7 days'], ['LAST_30_DAYS', 'Last 30 days'], ['CUSTOM', 'Custom range']].map(([value, label]) => <button type="button" key={value} className={preset === value ? 'is-selected' : ''} onClick={() => selectPreset(value)}>{label}</button>)}
        </div></div>
        {preset === 'CUSTOM' && <form className="custom-range-form" onSubmit={applyCustomRange}>
          <label>From<input className="form-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required /></label>
          <label>To<input className="form-control" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required /></label>
          <button type="submit" className="btn btn-forest" disabled={loading}>Apply range</button>
        </form>}
        <div className="report-period-caption">Showing {formatDate(report?.range?.from)} — {formatDate(report?.range?.to)}</div>
      </section>

      {error && <div className="analysis-error" role="alert">{error}<button type="button" onClick={() => loadReport(appliedRange)} aria-label="Retry report">Retry</button></div>}
      {loading && report && <div className="report-refreshing">Updating report data…</div>}

      {report && <>
        <section className="report-summary-grid" aria-label="Historical sensor summary">
          <SummaryCard label="TEMPERATURE AVG" value={formatValue(report.sensorSummary.temperature.average)} unit="°C" icon="temperature" tone="orange" detail={`Min ${formatValue(report.sensorSummary.temperature.minimum)}° · Max ${formatValue(report.sensorSummary.temperature.maximum)}°`} />
          <SummaryCard label="HUMIDITY AVG" value={formatValue(report.sensorSummary.humidity.average)} unit="%" icon="humidity" tone="blue" detail={`Min ${formatValue(report.sensorSummary.humidity.minimum)}% · Max ${formatValue(report.sensorSummary.humidity.maximum)}%`} />
          <SummaryCard label="GAS LEVEL AVG" value={formatValue(report.sensorSummary.gasLevel.average)} unit="index" icon="gas" tone="purple" detail={`Min ${formatValue(report.sensorSummary.gasLevel.minimum)} · Max ${formatValue(report.sensorSummary.gasLevel.maximum)}`} />
          <SummaryCard label="ALERTS" value={alerts?.total || 0} unit="" icon="alerts" tone="orange" detail={`${alerts?.unresolved || 0} unresolved · ${alerts?.bySeverity?.CRITICAL || 0} critical`} />
          <SummaryCard label="WARNING TIME" value={formatDuration(conditionTime.WARNING)} unit="" icon="clock" tone="orange" detail="Estimated from condition samples" />
          <SummaryCard label="CRITICAL TIME" value={formatDuration(conditionTime.CRITICAL)} unit="" icon="leaf" tone="purple" detail="Estimated from condition samples" />
          <SummaryCard label="FAN ON TIME" value={formatDuration(fan?.onDurationMs)} unit="" icon="fan" tone="green" detail={`${fan?.onEvents || 0} ON · ${fan?.offEvents || 0} OFF activity records`} />
          <SummaryCard label="SENSOR SAMPLES" value={report.sensorSummary.samples} unit="" icon="sensors" tone="blue" detail="Historical MongoDB readings" />
        </section>
        {report.conditionTime.estimatedFromSamples && <div className="report-estimate-note">Condition durations are estimated from samples and capped at {Math.round(report.conditionTime.maxSampleGapMs / 1000)} seconds across a sample gap. Fan durations use recorded ON/OFF changes through the next activity or report end.</div>}

        <section className="dashboard-section reports-charts-section">
          <div className="section-heading"><div><span className="section-kicker">SENSOR HISTORY</span><h2>Environmental trends</h2><p>Charts show time-bucket averages from stored sensor readings.</p></div><span className="chart-range">{report.charts.length} TIME BUCKETS</span></div>
          <div className="charts-grid reports-chart-grid">
            <SensorChart title="Temperature vs time" description="Storage temperature" data={report.charts} dataKey="temperature" unit="°C" color="#e38b54" gradientId="reportTemperatureGradient" rangeLabel="REPORT RANGE" />
            <SensorChart title="Humidity vs time" description="Relative humidity" data={report.charts} dataKey="humidity" unit="%" color="#6b9fc5" gradientId="reportHumidityGradient" rangeLabel="REPORT RANGE" />
            <SensorChart title="Gas level vs time" description="Simulated air-quality index" data={report.charts} dataKey="gasLevel" unit="" color="#9d83c8" gradientId="reportGasGradient" rangeLabel="REPORT RANGE" />
          </div>
          {report.sensorSummary.samples === 0 && <div className="report-table-empty">No sensor readings were recorded in this period.</div>}
        </section>

        <section className="dashboard-section report-duration-grid">
          <article className="panel duration-detail-card"><div className="panel-heading"><div><h2>Time by storage condition</h2><p>Estimated duration in each observed state</p></div></div><div className="duration-breakdown">
            {['NORMAL', 'WARNING', 'CRITICAL'].map((status) => <div className="duration-row" key={status}><span className={`condition-dot condition-dot--${status.toLowerCase()}`} /><span>{status}</span><strong>{formatDuration(conditionTime[status])}</strong></div>)}
          </div></article>
          <article className="panel duration-detail-card"><div className="panel-heading"><div><h2>Fan activity</h2><p>Simulated fan event counts and time</p></div><span className="analysis-step-tag">SIMULATED</span></div><div className="fan-report-grid">
            <div><span>ON EVENTS</span><strong>{fan?.onEvents || 0}</strong></div><div><span>OFF EVENTS</span><strong>{fan?.offEvents || 0}</strong></div><div><span>AUTO EVENTS</span><strong>{fan?.autoEvents || 0}</strong></div><div><span>MANUAL EVENTS</span><strong>{fan?.manualEvents || 0}</strong></div><div><span>ON TIME</span><strong>{formatDuration(fan?.onDurationMs)}</strong></div><div><span>OFF TIME</span><strong>{formatDuration(fan?.offDurationMs)}</strong></div>
          </div></article>
        </section>

        <section className="dashboard-section report-tables-section">
          <DataTable title="Storage condition history" description={`Most recent condition records · ${report.storageHistoryCount} total in range`} rows={history} emptyMessage="No condition records in this period." columns={[
            { key: 'timestamp', label: 'Time', render: (item) => formatDate(item.timestamp) },
            { key: 'status', label: 'Condition', render: (item) => <span className={`report-condition-tag report-condition-tag--${displayCondition(item.status || item.condition).toLowerCase()}`}>{displayCondition(item.status || item.condition)}</span> },
            { key: 'temperatureStatus', label: 'Temperature' }, { key: 'humidityStatus', label: 'Humidity' }, { key: 'gasStatus', label: 'Gas' },
            { key: 'message', label: 'Details', render: (item) => item.message || item.reason || '—' },
          ]} />
          {report.storageHistoryTruncated && <div className="report-estimate-note">Showing the latest 500 condition records. CSV export includes the same bounded history and marks the truncation.</div>}
          <DataTable title="Fan activity history" description={`Simulated fan activity · ${fan?.historyCount || 0} total in range`} rows={fanHistory} emptyMessage="No fan activity records in this period." columns={[
            { key: 'timestamp', label: 'Time', render: (item) => formatDate(item.timestamp) }, { key: 'mode', label: 'Mode' }, { key: 'status', label: 'Fan' }, { key: 'reason', label: 'Reason' },
          ]} />
          {fan?.historyTruncated && <div className="report-estimate-note">Showing the latest 500 fan activity records.</div>}
          <DataTable title="Alert history" description="Alerts created during the selected period" rows={alertHistory} emptyMessage="No alerts in this period." columns={[
            { key: 'timestamp', label: 'Time', render: (item) => formatDate(item.timestamp) }, { key: 'type', label: 'Type', render: (item) => (item.type || '').replaceAll('_', ' ') }, { key: 'severity', label: 'Severity' }, { key: 'message', label: 'Message' }, { key: 'resolved', label: 'State', render: (item) => item.resolved ? 'Resolved' : 'Open' },
          ]} />
          {alerts?.historyTruncated && <div className="report-estimate-note">Showing the latest 500 alerts in the table. The total and severity counts include the full selected range.</div>}
        </section>
      </>}
      <footer className="dashboard-footer"><span>OnionOS · Storage reports</span><span>Historical sensor data · AI prediction metrics are not included</span></footer>
    </div>
  );
}
