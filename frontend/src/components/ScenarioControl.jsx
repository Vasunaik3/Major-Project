import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

const scenarios = ['NORMAL', 'HIGH_TEMPERATURE', 'HIGH_HUMIDITY', 'HIGH_GAS', 'SPOILAGE_RISK'];

export default function ScenarioControl({ simulator, onChanged }) {
  const [scenario, setScenario] = useState(simulator?.scenario || 'NORMAL');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setScenario(simulator?.scenario || 'NORMAL');
  }, [simulator?.scenario]);

  const changeScenario = async (event) => {
    const nextScenario = event.target.value;
    setScenario(nextScenario);
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/simulator/scenario', {
        method: 'PUT',
        body: JSON.stringify({ scenario: nextScenario }),
      });
      setMessage('Scenario updated. New readings are sent every 5 seconds.');
      onChanged?.();
    } catch (error) {
      setMessage(error.message);
      setScenario(simulator?.scenario || 'NORMAL');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scenario-control">
      <div className="scenario-description"><strong>Simulator scenario</strong><span>Choose a controlled pattern for dashboard demonstrations.</span></div>
      <div className="scenario-select-wrap">
        <select className="form-select" value={scenario} onChange={changeScenario} disabled={busy || simulator?.enabled === false} aria-label="Select sensor simulator scenario">
          {scenarios.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
        </select>
        <span className={`phase-badge phase-badge--${simulator?.phase?.toLowerCase() || 'normal'}`}>{simulator?.phase?.replaceAll('_', ' ') || 'NORMAL'}</span>
      </div>
      {message && <small className={message.includes('updated') ? 'scenario-feedback' : 'scenario-feedback scenario-feedback--error'} role="status">{message}</small>}
    </div>
  );
}
