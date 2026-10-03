import { useCallback, useEffect, useState } from 'react';
import ScenarioControl from '../components/ScenarioControl.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

const roles = ['ADMIN', 'OPERATOR', 'VIEWER'];
const thresholdFields = [
  { sensor: 'temperature', title: 'Temperature', unit: '°C' },
  { sensor: 'humidity', title: 'Humidity', unit: '%' },
  { sensor: 'gasLevel', title: 'Gas level index', unit: 'index' },
];
const thresholdKeys = [
  { key: 'lowCritical', label: 'Critical low' },
  { key: 'lowWarning', label: 'Warning low' },
  { key: 'highWarning', label: 'Warning high' },
  { key: 'highCritical', label: 'Critical high' },
];

function validateThresholdForm(settings) {
  for (const { sensor, title } of thresholdFields) {
    const values = settings?.thresholds?.[sensor];
    if (!values || thresholdKeys.some(({ key }) => !Number.isFinite(Number(values[key])))) {
      return `Enter all four numeric limits for ${title}.`;
    }
    const numbers = thresholdKeys.map(({ key }) => Number(values[key]));
    if (!(numbers[0] < numbers[1] && numbers[1] < numbers[2] && numbers[2] < numbers[3])) {
      return `${title} limits must increase from critical low to critical high.`;
    }
  }
  const interval = settings?.simulator?.intervalMs;
  if (!Number.isInteger(Number(interval)) || interval < 1000 || interval > 3_600_000) {
    return 'Sensor simulation interval must be between 1000 and 3600000 milliseconds.';
  }
  const fan = settings?.fanControl;
  if (!fan || fan.temperatureOn <= fan.temperatureOff || fan.humidityOn <= fan.humidityOff || fan.gasLevelOn <= fan.gasLevelOff) {
    return 'Each fan ON threshold must be higher than its OFF threshold.';
  }
  if (fan.minimumOnMs < 0 || fan.minimumOnMs > 3_600_000 || fan.minimumOffMs < 0 || fan.minimumOffMs > 3_600_000) {
    return 'Fan minimum ON/OFF durations must be between 0 and 3600000 milliseconds.';
  }
  return '';
}

export default function AdminSettingsPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [simulator, setSimulator] = useState(null);
  const [pendingRoles, setPendingRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, settingsData, simulatorData] = await Promise.all([
        apiRequest('/admin/users'),
        apiRequest('/settings'),
        apiRequest('/simulator/scenario'),
      ]);
      setUsers(userData.users || []);
      setSettings(settingsData.settings);
      setSimulator(simulatorData);
      setPendingRoles({});
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAdminData(); }, [loadAdminData]);

  const saveThresholds = async (event) => {
    event.preventDefault();
    const validationError = validateThresholdForm(settings);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSavingThresholds(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(result.settings);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingThresholds(false);
    }
  };

  const saveUserRole = async (user) => {
    const role = pendingRoles[user._id];
    if (!role || role === user.role) return;
    setSavingUserId(user._id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/users/${user._id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => item._id === user._id ? { ...item, role } : item));
      setPendingRoles((current) => { const next = { ...current }; delete next[user._id]; return next; });
      setNotice(`Updated ${user.email} to ${role}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingUserId('');
    }
  };

  return (
    <div className="admin-settings-page">
      <section className="page-intro admin-page-intro">
        <div><div className="eyebrow">ADMINISTRATION <span className="eyebrow-line" /></div><h1>System settings</h1><p>Manage accounts, storage thresholds, and simulator controls.</p></div>
        <span className="admin-role-pill">ADMINISTRATOR</span>
      </section>
      {error && <div className="analysis-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {notice && <div className="analysis-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      {loading && <div className="reports-loading">Loading administrator settings…</div>}

      {!loading && settings && <>
        <section className="panel admin-threshold-panel">
          <div className="panel-heading"><div><h2>Storage thresholds</h2><p>Changes are stored in MongoDB and apply to incoming sensor readings.</p></div><span className="admin-role-pill">CONFIGURATION</span></div>
          <form onSubmit={saveThresholds}>
            <div className="admin-threshold-grid">
              {thresholdFields.map(({ sensor, title, unit }) => (
                <fieldset className="admin-threshold-group" key={sensor}>
                  <legend>{title}<small>{unit}</small></legend>
                  {thresholdKeys.map(({ key, label }) => (
                    <label className="admin-threshold-field" key={key}>{label}
                      <input className="form-control" type="number" step="any" value={settings.thresholds[sensor][key]} onChange={(event) => {
                        const value = event.target.value === '' ? '' : Number(event.target.value);
                        setSettings((current) => ({ ...current, thresholds: { ...current.thresholds, [sensor]: { ...current.thresholds[sensor], [key]: value } } }));
                      }} required />
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <div className="admin-settings-config-grid">
              <fieldset className="admin-threshold-group admin-runtime-group">
                <legend>Sensor simulation</legend>
                <label className="admin-threshold-field">Reading interval (milliseconds)
                  <input className="form-control" type="number" min="1000" max="3600000" step="1000" value={settings.simulator.intervalMs} onChange={(event) => setSettings((current) => ({ ...current, simulator: { ...current.simulator, intervalMs: Number(event.target.value) } }))} required />
                </label>
              </fieldset>
              <fieldset className="admin-threshold-group admin-fan-group">
                <legend>Fan automatic-control settings</legend>
                {[
                  ['temperatureOn', 'Temperature ON (°C)'], ['temperatureOff', 'Temperature OFF (°C)'],
                  ['humidityOn', 'Humidity ON (%)'], ['humidityOff', 'Humidity OFF (%)'],
                  ['gasLevelOn', 'Gas level ON'], ['gasLevelOff', 'Gas level OFF'],
                  ['minimumOnMs', 'Minimum ON time (ms)'], ['minimumOffMs', 'Minimum OFF time (ms)'],
                ].map(([key, label]) => <label className="admin-threshold-field" key={key}>{label}
                  <input className="form-control" type="number" min="0" step={key.endsWith('Ms') ? '1000' : 'any'} value={settings.fanControl[key]} onChange={(event) => setSettings((current) => ({ ...current, fanControl: { ...current.fanControl, [key]: Number(event.target.value) } }))} required />
                </label>)}
              </fieldset>
            </div>
            <div className="admin-form-footer"><span>Preferred ranges are between warning low/high. Critical limits and fan ON/OFF hysteresis are independently configurable.</span><button className="btn btn-forest" type="submit" disabled={savingThresholds}>{savingThresholds ? 'Saving…' : 'Save all settings'}</button></div>
          </form>
        </section>

        <section className="panel admin-users-panel">
          <div className="panel-heading"><div><h2>User management</h2><p>Assign access roles. Password hashes are never included in this list.</p></div><span className="panel-count">{users.length} users</span></div>
          {users.length === 0 ? <div className="analysis-history-empty">No users found.</div> : (
            <div className="report-table-scroll admin-users-table-wrap">
              <table className="report-table admin-users-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>{users.map((user) => {
                  const role = pendingRoles[user._id] || user.role;
                  const isSelf = user.id === session?.user?.id || user._id === session?.user?.id;
                  return <tr key={user._id}>
                    <td>{user.name}</td><td>{user.email}</td>
                    <td><select className="form-select admin-role-select" value={role} disabled={isSelf} onChange={(event) => setPendingRoles((current) => ({ ...current, [user._id]: event.target.value }))} aria-label={`Role for ${user.email}`}>
                      {roles.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select></td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                    <td><button className="resolve-button" type="button" disabled={isSelf || !pendingRoles[user._id] || role === user.role || savingUserId === user._id} onClick={() => saveUserRole(user)}>{savingUserId === user._id ? 'Saving…' : isSelf ? 'Current user' : 'Save role'}</button></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel admin-simulator-panel">
          <div className="panel-heading"><div><h2>Simulator controls</h2><p>Control demonstration scenarios. This does not operate physical devices.</p></div><span className="analysis-step-tag">SIMULATED ONLY</span></div>
          <ScenarioControl simulator={simulator} onChanged={loadAdminData} />
        </section>
      </>}
      <footer className="dashboard-footer"><span>Administrator tools</span><span>Registration creates VIEWER accounts; assign Operator access here and provision the first admin with the backend seed command.</span></footer>
    </div>
  );
}
