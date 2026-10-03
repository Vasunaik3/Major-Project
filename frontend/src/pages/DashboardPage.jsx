import { useCallback, useEffect, useMemo, useState } from 'react';
import AlertPanel from '../components/AlertPanel.jsx';
import FanControl from '../components/FanControl.jsx';
import Icon from '../components/Icon.jsx';
import MetricCard from '../components/MetricCard.jsx';
import OnionAnalysisPage from './OnionAnalysisPage.jsx';
import ReportsPage from './ReportsPage.jsx';
import AdminSettingsPage from './AdminSettingsPage.jsx';
import SensorChart from '../components/SensorChart.jsx';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import { canAccessSection } from '../utils/permissions.js';

function conditionLabel(condition) {
  if (!condition) return '—';
  if (condition === 'GOOD') return 'NORMAL';
  return condition;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const role = session?.user?.role;
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [systemOnline, setSystemOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [fanBusy, setFanBusy] = useState(false);
  const [resolvingId, setResolvingId] = useState('');

  const refreshDashboard = useCallback(async () => {
    try {
      const [summaryData, historyData, alertData] = await Promise.all([
        apiRequest('/dashboard/summary'),
        apiRequest('/sensors/history?limit=100'),
        canAccessSection(role, 'alerts') ? apiRequest('/alerts?resolved=false&limit=6') : Promise.resolve({ alerts: [] }),
      ]);
      setSummary(summaryData);
      setReadings(historyData.readings || []);
      setAlerts(alertData.alerts || []);
      setSystemOnline(true);
      setLastUpdated(new Date().toISOString());
      setApiError('');
    } catch (error) {
      setSystemOnline(error.status !== undefined);
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void refreshDashboard();
    const timer = window.setInterval(refreshDashboard, 5000);
    return () => window.clearInterval(timer);
  }, [refreshDashboard, session?.token]);

  const reading = summary?.latestReading;
  const fan = summary?.fan;
  const storageStatus = conditionLabel(summary?.storageCondition?.condition);
  const simulator = summary?.simulator;
  const chartData = useMemo(() => readings.filter((item) => item.timestamp), [readings]);

  const navigate = (target) => {
    if (!canAccessSection(role, target)) return;
    setActiveSection(target);
    if (['onion-analysis', 'reports', 'settings'].includes(target)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const controlFan = async (control) => {
    setFanBusy(true);
    setActionError('');
    try {
      await apiRequest('/fan/control', { method: 'POST', body: JSON.stringify(control) });
      await refreshDashboard();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setFanBusy(false);
    }
  };

  const resolveAlert = async (alertId) => {
    setResolvingId(alertId);
    setActionError('');
    try {
      await apiRequest(`/alerts/${alertId}/resolve`, { method: 'PATCH' });
      await refreshDashboard();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setResolvingId('');
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onNavigate={navigate} simulatorRunning={simulator?.running} role={role} />
      <div className="workspace">
        <TopBar user={session?.user} systemOnline={systemOnline} lastUpdated={lastUpdated} onLogout={logout} />
        <main className="dashboard-content">
          {activeSection === 'settings' && canAccessSection(role, 'settings') ? <AdminSettingsPage /> : activeSection === 'reports' && canAccessSection(role, 'reports') ? <ReportsPage /> : activeSection === 'onion-analysis' && canAccessSection(role, 'onion-analysis') ? <OnionAnalysisPage /> : (
            <>
          <section className="page-intro" id="dashboard">
            <div>
              <div className="eyebrow">STORAGE OVERVIEW <span className="eyebrow-line" /></div>
              <h1>{greeting()}, {session?.user?.name?.split(' ')[0] || 'operator'}.</h1>
              <p>Here’s the latest view of your simulated onion storage environment.</p>
            </div>
            <button type="button" className="refresh-button" onClick={refreshDashboard} disabled={loading}>
              <span className={loading ? 'refresh-spinner' : ''}><Icon name="clock" size={16} /></span> Refresh data
            </button>
          </section>

          {apiError && <div className={`connection-banner ${systemOnline ? 'connection-banner--warning' : ''}`} role="status"><span className="status-dot" />{apiError}{apiError.includes('Authentication') && <button type="button" onClick={logout}>Sign in again</button>}</div>}
          {actionError && <div className="action-error" role="alert">{actionError}<button type="button" onClick={() => setActionError('')} aria-label="Dismiss">×</button></div>}

          <section className="metric-grid" aria-label="Current storage metrics">
            <MetricCard label="Temperature" value={reading ? Number(reading.temperature).toFixed(1) : '—'} unit="°C" icon="temperature" tone="orange" footnote="Live simulated reading" />
            <MetricCard label="Humidity" value={reading ? Number(reading.humidity).toFixed(1) : '—'} unit="%" icon="humidity" tone="blue" footnote="Relative humidity" />
            <MetricCard label="Gas level" value={reading ? Math.round(reading.gasLevel) : '—'} unit="index" icon="gas" tone="purple" footnote="Simulated air quality" />
            <MetricCard label="Fan status" value={fan?.status || '—'} icon="fan" tone="green" footnote={`${fan?.mode || 'AUTO'} control mode`} />
            <MetricCard label="Storage condition" value="" status={storageStatus} icon="leaf" tone="lime" footnote={summary?.storageCondition?.reason || 'Waiting for storage assessment'} />
          </section>
          <div className="measurement-note">Gas level is a simulated sensor index, not a calibrated concentration.</div>

          <section className="dashboard-section" id="monitoring">
            <div className="section-heading"><div><span className="section-kicker">ENVIRONMENTAL TRENDS</span><h2>Sensor monitoring</h2><p>Recent sensor history from the simulator.</p></div><div className="live-tag"><span className="status-dot status-dot--green" />AUTO-REFRESH · 5 SEC</div></div>
            <div className="charts-grid">
              <SensorChart title="Temperature vs time" description="Storage temperature" data={chartData} dataKey="temperature" unit="°C" color="#e38b54" gradientId="temperatureGradient" />
              <SensorChart title="Humidity vs time" description="Relative humidity" data={chartData} dataKey="humidity" unit="%" color="#6b9fc5" gradientId="humidityGradient" />
              <SensorChart title="Gas level vs time" description="Simulated air-quality index" data={chartData} dataKey="gasLevel" unit="" color="#9d83c8" gradientId="gasGradient" />
            </div>
            {chartData.length === 0 && !loading && <div className="sensor-empty-note">No sensor readings yet. Confirm that the backend simulator is running.</div>}
          </section>

          {canAccessSection(role, 'alerts') && <section className="dashboard-section split-section">
            <div className="section-heading"><div><span className="section-kicker">AUTOMATION & EVENTS</span><h2>Storage operations</h2><p>Review alerts and manage the simulated ventilation fan.</p></div></div>
            <div className="operations-grid">
              <AlertPanel alerts={alerts} onResolve={resolveAlert} resolvingId={resolvingId} canResolve={role === 'ADMIN'} />
              {canAccessSection(role, 'fan-control') && <FanControl fan={fan} onControl={controlFan} busy={fanBusy} />}
            </div>
          </section>}

          <footer className="dashboard-footer"><span>OnionOS · Smart Onion Storage</span><span>{simulator?.running ? 'Simulated telemetry active' : 'Telemetry not connected'} · No physical sensors connected · AI model pending</span></footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
