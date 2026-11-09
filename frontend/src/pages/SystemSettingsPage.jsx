import { useCallback, useEffect, useState } from 'react';
import ScenarioControl from '../components/ScenarioControl.jsx';
import Icon from '../components/Icon.jsx';
import { apiRequest } from '../services/api.js';

const thresholdFields = [
  { sensor: 'temperature', title: 'Temperature', unit: '°C' },
  { sensor: 'humidity',    title: 'Humidity',    unit: '%'  },
  { sensor: 'gasLevel',    title: 'Gas level index', unit: 'index' },
];
const thresholdKeys = [
  { key: 'lowCritical',  label: 'Critical low'  },
  { key: 'lowWarning',   label: 'Warning low'   },
  { key: 'highWarning',  label: 'Warning high'  },
  { key: 'highCritical', label: 'Critical high' },
];

function validateThresholdForm(settings) {
  for (const { sensor, title } of thresholdFields) {
    const vals = settings?.thresholds?.[sensor];
    if (!vals || thresholdKeys.some(({ key }) => !Number.isFinite(Number(vals[key])))) {
      return `Enter all four numeric limits for ${title}.`;
    }
    const nums = thresholdKeys.map(({ key }) => Number(vals[key]));
    if (!(nums[0] < nums[1] && nums[1] < nums[2] && nums[2] < nums[3])) {
      return `${title} limits must increase from critical low to critical high.`;
    }
  }
  const interval = settings?.simulator?.intervalMs;
  if (!Number.isInteger(Number(interval)) || interval < 1000 || interval > 3_600_000) {
    return 'Sensor simulation interval must be between 1000 and 3600000 milliseconds.';
  }
  const fan = settings?.fanControl;
  if (!fan || fan.temperatureOn <= fan.temperatureOff ||
      fan.humidityOn <= fan.humidityOff || fan.gasLevelOn <= fan.gasLevelOff) {
    return 'Each fan ON threshold must be higher than its OFF threshold.';
  }
  if (fan.minimumOnMs < 0 || fan.minimumOnMs > 3_600_000 ||
      fan.minimumOffMs < 0 || fan.minimumOffMs > 3_600_000) {
    return 'Fan minimum ON/OFF durations must be between 0 and 3600000 milliseconds.';
  }
  return '';
}

export default function SystemSettingsPage() {
  const [settings,        setSettings]        = useState(null);
  const [simulator,       setSimulator]       = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [savingThresholds,setSavingThresholds]= useState(false);
  const [error,           setError]           = useState('');
  const [notice,          setNotice]          = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [settingsData, simData] = await Promise.all([
        apiRequest('/settings'),
        apiRequest('/simulator/scenario'),
      ]);
      setSettings(settingsData.settings);
      setSimulator(simData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const saveThresholds = async (e) => {
    e.preventDefault();
    const validErr = validateThresholdForm(settings);
    if (validErr) { setError(validErr); return; }
    setSavingThresholds(true); setError(''); setNotice('');
    try {
      const result = await apiRequest('/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSettings(result.settings);
      setNotice(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div className="system-settings-page">
      {/* Header */}
      <section className="page-intro system-page-intro">
        <div>
          <div className="eyebrow">SYSTEM CONFIGURATION <span className="eyebrow-line" /></div>
          <h1>System settings</h1>
          <p>Configure storage thresholds and simulator controls.</p>
        </div>
      </section>

      {/* Banners */}
      {error && (
        <div className="analysis-error" role="alert">
          <Icon name="warning" size={15} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="analysis-notice" role="status">
          <Icon name="check" size={15} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {loading && <div className="reports-loading">Loading system settings…</div>}

      {!loading && settings && (
        <>
          {/* Storage thresholds */}
          <section className="panel system-threshold-panel">
            <div className="panel-heading">
              <div>
                <h2>Storage thresholds</h2>
                <p>Changes are stored in MongoDB and apply to incoming sensor readings.</p>
              </div>
              <span className="analysis-step-tag">CONFIGURATION</span>
            </div>

            <form onSubmit={saveThresholds}>
              <div className="system-threshold-grid">
                {thresholdFields.map(({ sensor, title, unit }) => (
                  <fieldset className="system-threshold-group" key={sensor}>
                    <legend>{title}<small>{unit}</small></legend>
                    {thresholdKeys.map(({ key, label }) => (
                      <label className="system-threshold-field" key={key}>
                        {label}
                        <input
                          className="form-control"
                          type="number"
                          step="any"
                          value={settings.thresholds[sensor][key]}
                          onChange={(e) => {
                            const v = e.target.value === '' ? '' : Number(e.target.value);
                            setSettings((c) => ({
                              ...c,
                              thresholds: {
                                ...c.thresholds,
                                [sensor]: { ...c.thresholds[sensor], [key]: v },
                              },
                            }));
                          }}
                          required
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>

              <div className="system-settings-config-grid">
                <fieldset className="system-threshold-group system-runtime-group">
                  <legend>Sensor simulation</legend>
                  <label className="system-threshold-field" style={{ gridColumn: '1/-1' }}>
                    Reading interval (milliseconds)
                    <input
                      className="form-control"
                      type="number"
                      min="1000"
                      max="3600000"
                      step="1000"
                      value={settings.simulator.intervalMs}
                      onChange={(e) =>
                        setSettings((c) => ({
                          ...c,
                          simulator: { ...c.simulator, intervalMs: Number(e.target.value) },
                        }))
                      }
                      required
                    />
                  </label>
                </fieldset>

                <fieldset className="system-threshold-group system-fan-group">
                  <legend>Fan automatic-control settings</legend>
                  {[
                    ['temperatureOn',  'Temperature ON (°C)'],
                    ['temperatureOff', 'Temperature OFF (°C)'],
                    ['humidityOn',     'Humidity ON (%)'],
                    ['humidityOff',    'Humidity OFF (%)'],
                    ['gasLevelOn',     'Gas level ON'],
                    ['gasLevelOff',    'Gas level OFF'],
                    ['minimumOnMs',    'Minimum ON time (ms)'],
                    ['minimumOffMs',   'Minimum OFF time (ms)'],
                  ].map(([key, label]) => (
                    <label className="system-threshold-field" key={key}>
                      {label}
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step={key.endsWith('Ms') ? '1000' : 'any'}
                        value={settings.fanControl[key]}
                        onChange={(e) =>
                          setSettings((c) => ({
                            ...c,
                            fanControl: { ...c.fanControl, [key]: Number(e.target.value) },
                          }))
                        }
                        required
                      />
                    </label>
                  ))}
                </fieldset>
              </div>

              <div className="system-form-footer">
                <span>
                  Preferred ranges are between warning low/high. Critical limits and fan ON/OFF
                  hysteresis are independently configurable.
                </span>
                <button className="btn btn-forest" type="submit" disabled={savingThresholds}>
                  {savingThresholds ? 'Saving…' : 'Save all settings'}
                </button>
              </div>
            </form>
          </section>

          {/* Simulator controls */}
          <section className="panel system-simulator-panel">
            <div className="panel-heading">
              <div>
                <h2>Simulator controls</h2>
                <p>Control demonstration scenarios. This does not operate physical devices.</p>
              </div>
              <span className="analysis-step-tag">SIMULATED ONLY</span>
            </div>
            <ScenarioControl simulator={simulator} onChanged={loadSettings} />
          </section>
        </>
      )}

      <footer className="dashboard-footer">
        <span>System controls</span>
        <span>Changes apply to simulated readings and storage automation.</span>
      </footer>
    </div>
  );
}
