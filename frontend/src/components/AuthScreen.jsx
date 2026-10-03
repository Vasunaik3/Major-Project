import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-lockup mb-5">
          <div className="brand-mark"><Icon name="leaf" size={25} /></div>
          <div><strong>Onion<span>OS</span></strong><small>STORAGE INTELLIGENCE</small></div>
        </div>
        <div className="auth-kicker">SMART STORAGE · SOFTWARE PROTOTYPE</div>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your workspace.'}</h1>
        <p className="auth-description">Monitor simulated storage conditions and manage your onion-storage environment.</p>
        {mode === 'register' && <div className="auth-role-note">New registrations receive the least-privilege <strong>VIEWER</strong> role. An administrator can assign operator access.</div>}

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label className="field-label">Full name
              <input className="form-control" name="name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={100} />
            </label>
          )}
          <label className="field-label">Email address
            <input className="form-control" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required />
          </label>
          <label className="field-label">Password
            <input className="form-control" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={update} required minLength={8} />
          </label>
          {error && <div className="alert alert-danger py-2 mb-0" role="alert">{error}</div>}
          <button className="btn btn-forest w-100 auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to dashboard' : 'Create account'}
          </button>
        </form>
        <p className="auth-toggle">
          {mode === 'login' ? 'New to OnionOS?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="auth-footnote"><span className="status-dot status-dot--green" /> Sensor values are simulated · AI analysis not enabled</div>
      </section>
      <aside className="auth-art" aria-label="Storage monitoring preview">
        <div className="art-orb art-orb--one" /><div className="art-orb art-orb--two" />
        <div className="auth-art-content">
          <span className="art-label">STORAGE OVERVIEW</span>
          <div className="art-headline">A healthier<br />harvest starts<br />with better storage.</div>
          <div className="art-reading-card"><div className="art-reading-top"><span>SIMULATED ENVIRONMENT</span><span className="status-dot status-dot--lime" /></div><div className="art-reading-value">25° — 35°C</div><div className="art-reading-caption">Temperature operating range</div><div className="art-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
          <p className="art-note">Designed for future IoT sensors and model-backed onion analysis.</p>
        </div>
      </aside>
    </main>
  );
}
