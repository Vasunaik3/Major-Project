import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm((c) => ({ ...c, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
    setForm({ name: '', email: '', password: '' });
  };

  return (
    <main className="auth-screen">
      {/* ── Left panel ── */}
      <section className="auth-panel">
        <a className="brand-lockup" href="#" aria-label="OnionOS home">
          <div className="brand-mark"><Icon name="leaf" size={22} /></div>
          <div>
            <strong>Onion<span>OS</span></strong>
            <small>STORAGE INTELLIGENCE</small>
          </div>
        </a>

        <div className="auth-kicker">SMART STORAGE · SOFTWARE PROTOTYPE</div>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your workspace.'}</h1>
        <p className="auth-description">
          Monitor simulated storage conditions and manage your onion-storage environment.
        </p>

        <form onSubmit={submit} className="auth-form" noValidate>
          {mode === 'register' && (
            <label className="field-label">
              Full name
              <input
                className="form-control"
                name="name"
                autoComplete="name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={update}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}

          <label className="field-label">
            Email address
            <input
              className="form-control"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update}
              required
            />
          </label>

          <label className="field-label">
            Password
            <div className="password-field-wrap">
              <input
                className="form-control"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                value={form.password}
                onChange={update}
                required
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
          </label>

          {error && (
            <div className="analysis-error" role="alert">
              <Icon name="warning" size={15} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn btn-forest w-100 auth-submit" type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login'
              ? 'Sign in to dashboard'
              : 'Create account'}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === 'login' ? 'New to OnionOS?' : 'Already have an account?'}{' '}
          <button type="button" onClick={switchMode}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        <div className="auth-footnote">
          <span className="status-dot status-dot--green" />
          Sensor values are simulated · AI analysis will be enabled after dataset collection and
          model training.
        </div>
      </section>

      {/* ── Right decorative panel ── */}
      <aside className="auth-art" aria-hidden="true">
        <div className="art-orb art-orb--one" />
        <div className="art-orb art-orb--two" />
        <div className="auth-art-content">
          <span className="art-label">STORAGE OVERVIEW</span>
          <div className="art-headline">
            A healthier<br />harvest starts<br />with better storage.
          </div>

          <div className="art-reading-card">
            <div className="art-reading-top">
              <span>SIMULATED ENVIRONMENT</span>
              <span className="status-dot status-dot--lime" />
            </div>
            <div className="art-reading-value">25° — 35°C</div>
            <div className="art-reading-caption">Temperature operating range</div>
            <div className="art-wave">
              {Array.from({ length: 20 }).map((_, i) => <i key={i} />)}
            </div>
          </div>

          <div className="art-stats">
            <div className="art-stat">
              <span>HUMIDITY</span>
              <strong>60–75%</strong>
            </div>
            <div className="art-stat">
              <span>GAS INDEX</span>
              <strong>&lt; 400</strong>
            </div>
            <div className="art-stat">
              <span>FAN MODE</span>
              <strong>AUTO</strong>
            </div>
            <div className="art-stat">
              <span>STATUS</span>
              <strong>NORMAL</strong>
            </div>
          </div>

          <p className="art-note">
            Designed for future IoT sensors and model-backed onion analysis.
          </p>
        </div>
      </aside>
    </main>
  );
}
