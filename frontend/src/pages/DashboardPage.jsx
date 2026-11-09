import { useCallback, useEffect, useMemo, useState } from 'react';
import AlertPanel from '../components/AlertPanel.jsx';
import FanControl from '../components/FanControl.jsx';
import Icon from '../components/Icon.jsx';
import MetricCard from '../components/MetricCard.jsx';
import OnionAnalysisPage from './OnionAnalysisPage.jsx';
import ReportsPage from './ReportsPage.jsx';
import SystemSettingsPage from './SystemSettingsPage.jsx';
import SensorChart from '../components/SensorChart.jsx';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

function conditionLabel(condition) {
  if (!condition) return '—';
  if (condition === 'GOOD') return 'NORMAL';
  return condition;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { session, logout } = useAuth();

  const [summary,       setSummary]       = useState(null);
  const [readings,      setReadings]      = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [systemOnline,  setSystemOnline]  = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [apiError,      setApiError]      = useState('');
  const [actionError,   setActionError]   = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [fanBusy,       setFanBusy]       = useState(false);
  const [resolvingId,   setResolvingId]   = useState('');

  /* ── data fetching (unchanged) ─────────────────────────── */
  const refreshDashboard = useCallback(async () => {
    try {
      const [summaryData, historyData, alertData] = await Promise.all([
        apiRequest('/dashboard/summary'),
        apiRequest('/sensors/history?limit=100'),
        apiRequest('/alerts?resolved=false&limit=6'),
      ]);
      setSummary(summaryData);
      setReadings(historyData.readings || []);
      setAlerts(alertData.alerts || []);
      setSystemOnline(true);
      setLastUpdated(new Date().toISOString());
      setApiError('');
    } catch (err) {
      setSystemOnline(err.status !== undefined);
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
    const id = window.setInterval(refreshDashboard, 5000);
    return () => window.clearInterval(id);
  }, [refreshDashboard, session?.token]);

  const reading       = summary?.latestReading;
  const fan           = summary?.fan;
  const storageStatus = conditionLabel(summary?.storageCondition?.condition);
  const simulator     = summary?.simulator;
  const chartData     = useMemo(() => readings.filter((r) => r.timestamp), [readings]);

  /* ── navigation (unchanged) ────────────────────────────── */
  const navigate = (target) => {
    setActiveSection(target);
    if (['onion-analysis', 'reports', 'settings'].includes(target)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  /* ── actions (unchanged) ───────────────────────────────── */
  const controlFan = async (control) => {
    setFanBusy(true);
    setActionError('');
    try {
      await apiRequest('/fan/control', { method: 'POST', body: JSON.stringify(control) });
      await refreshDashboard();
    } catch (err) {
      setActionError(err.message);
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
    } catch (err) {
      setActionError(err.message);
    } finally {
      setResolvingId('');
    }
  };

  /* ── sub-page rendering ─────────────────────────────────── */
  const isSubPage = ['settings', 'reports', 'onion-analysis'].includes(activeSection);

  return (
    <div className="app-shell">
      <Sidebar
        activeSection={activeSection}
        onNavigate={navigate}
        simulatorRunning={simulator?.running}
      />

      <div className="workspace">
        <TopBar
          user={session?.user}
          systemOnline={systemOnline}
          lastUpdated={lastUpdated}
          onLogout={logout}
        />

        <main className="dashboard-content">
          {/* ── Sub-pages ── */}
          {activeSection === 'settings' && <SystemSettingsPage />}
          {activeSection === 'reports' && <ReportsPage />}
          {activeSection === 'onion-analysis' && <OnionAnalysisPage />}

          {/* ── Main dashboard ── */}
          {!isSubPage && (
            <>
              {/* Page header */}
              <section className="page-intro" id="dashboard">
                <div>
                  <div className="eyebrow">
                    STORAGE OVERVIEW <span className="eyebrow-line" />
                  </div>
                  <h1>{greeting()}, {session?.user?.name?.split(' ')[0] || 'there'}.</h1>
                  <p>Here's the latest view of your simulated onion storage environment.</p>
                </div>
                <button
                  type="button"
                  className="refresh-button"
                  onClick={refreshDashboard}
                  disabled={loading}
                  aria-label="Refresh dashboard data"
                >
                  <span className={loading ? 'refresh-spinner' : ''}>
                    <Icon name="refresh" size={15} />
                  </span>
                  Refresh data
                </button>
              </section>

              {/* Banners */}
              {apiError && (
                <div
                  className={`connection-banner${systemOnline ? ' connection-banner--warning' : ''}`}
                  role="status"
                >
                  <Icon name={systemOnline ? 'warning' : 'x'} size={15} />
                  <span>{apiError}</span>
                  {apiError.includes('Authentication') && (
                    <button type="button" onClick={logout}>Sign in again</button>
                  )}
                </div>
              )}
              {actionError && (
                <div className="action-error" role="alert">
                  <Icon name="warning" size={15} />
                  <span>{actionError}</span>
                  <button type="button" onClick={() => setActionError('')} aria-label="Dismiss">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )}

              {/* Metric cards */}
              <section className="metric-grid" aria-label="Current storage metrics">
                <MetricCard
                  label="Temperature"
                  value={reading ? Number(reading.temperature).toFixed(1) : '—'}
                  unit="°C"
                  icon="temperature"
                  tone="orange"
                  footnote="Live simulated reading"
                />
                <MetricCard
                  label="Humidity"
                  value={reading ? Number(reading.humidity).toFixed(1) : '—'}
                  unit="%"
                  icon="humidity"
                  tone="blue"
                  footnote="Relative humidity"
                />
                <MetricCard
                  label="Gas level"
                  value={reading ? Math.round(reading.gasLevel) : '—'}
                  unit="index"
                  icon="gas"
                  tone="purple"
                  footnote="Simulated air quality"
                />
                <MetricCard
                  label="Fan status"
                  value={fan?.status || '—'}
                  icon="fan"
                  tone="green"
                  footnote={`${fan?.mode || 'AUTO'} control mode`}
                />
                <MetricCard
                  label="Storage condition"
                  value=""
                  status={storageStatus}
                  icon="leaf"
                  tone="lime"
                  footnote={summary?.storageCondition?.reason || 'Waiting for storage assessment'}
                />
              </section>
              <p className="measurement-note">
                Gas level is a simulated sensor index, not a calibrated concentration.
              </p>

              {/* Sensor charts */}
              <section className="dashboard-section" id="monitoring">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">ENVIRONMENTAL TRENDS</span>
                    <h2>Sensor monitoring</h2>
                    <p>Recent sensor history from the simulator.</p>
                  </div>
                  <div className="live-tag">
                    <span className="status-dot status-dot--green" />
                    AUTO-REFRESH · 5 SEC
                  </div>
                </div>

                <div className="charts-grid">
                  <SensorChart
                    title="Temperature vs time"
                    description="Storage temperature"
                    data={chartData}
                    dataKey="temperature"
                    unit="°C"
                    color="#C2601A"
                    gradientId="tempGrad"
                  />
                  <SensorChart
                    title="Humidity vs time"
                    description="Relative humidity"
                    data={chartData}
                    dataKey="humidity"
                    unit="%"
                    color="#1D5EA8"
                    gradientId="humGrad"
                  />
                  <SensorChart
                    title="Gas level vs time"
                    description="Simulated air-quality index"
                    data={chartData}
                    dataKey="gasLevel"
                    unit=""
                    color="#6B3FA8"
                    gradientId="gasGrad"
                  />
                </div>

                {chartData.length === 0 && !loading && (
                  <p className="sensor-empty-note">
                    No sensor readings yet. Confirm that the backend simulator is running.
                  </p>
                )}
              </section>

              {/* Alerts + Fan control */}
              <section className="dashboard-section" id="alerts">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">AUTOMATION &amp; EVENTS</span>
                      <h2>Storage operations</h2>
                      <p>Review alerts and manage the simulated ventilation fan.</p>
                    </div>
                  </div>

                  <div className="operations-grid">
                    <AlertPanel
                      alerts={alerts}
                      onResolve={resolveAlert}
                      resolvingId={resolvingId}
                      canResolve
                    />
                    <FanControl fan={fan} onControl={controlFan} busy={fanBusy} />
                  </div>
              </section>

              <footer className="dashboard-footer">
                <span>OnionOS · Smart Onion Storage</span>
                <span>
                  {simulator?.running
                    ? 'Simulated telemetry active'
                    : 'Telemetry not connected'}{' '}
                  · No physical sensors connected · AI analysis will be enabled after dataset
                  collection and model training.
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
