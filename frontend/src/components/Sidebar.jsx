import Icon from './Icon.jsx';

const navigation = [
  { label: 'Dashboard',        icon: 'dashboard', target: 'dashboard'      },
  { label: 'Sensor Monitoring',icon: 'sensors',   target: 'monitoring'     },
  { label: 'Alerts',           icon: 'alerts',    target: 'alerts'         },
  { label: 'Fan Control',      icon: 'fan',       target: 'fan-control'    },
  { label: 'Onion Analysis',   icon: 'image',     target: 'onion-analysis' },
  { label: 'Reports',          icon: 'reports',   target: 'reports'        },
  { label: 'Settings',         icon: 'settings',  target: 'settings'       },
];

export default function Sidebar({ activeSection, onNavigate, simulatorRunning }) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <a
        className="sidebar-brand brand-lockup"
        href="#dashboard"
        onClick={(e) => { e.preventDefault(); onNavigate('dashboard'); }}
        aria-label="OnionOS — go to dashboard"
      >
        <div className="brand-mark"><Icon name="leaf" size={20} /></div>
        <div>
          <strong>Onion<span>OS</span></strong>
          <small>STORAGE INTELLIGENCE</small>
        </div>
      </a>

      <div className="sidebar-label">WORKSPACE</div>

      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map((item) => (
            <button
              key={item.target}
              type="button"
              className={`side-nav-link${activeSection === item.target ? ' is-active' : ''}`}
              onClick={() => onNavigate(item.target)}
              aria-current={activeSection === item.target ? 'page' : undefined}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </button>
          ))}
      </nav>

      {/* Bottom status card */}
      <div className="sidebar-bottom">
        <div className="simulator-card">
          <div className="simulator-card-icon">
            <span className={`status-dot ${simulatorRunning ? 'status-dot--lime' : 'status-dot--muted'}`} />
          </div>
          <div>
            <strong>{simulatorRunning ? 'Simulator online' : 'Simulator offline'}</strong>
            <small>{simulatorRunning ? 'Sending live readings' : 'Waiting for connection'}</small>
          </div>
        </div>
        <div className="sidebar-version">
          SMART ONION STORAGE
          <span>v0.1 · LOCAL</span>
        </div>
      </div>
    </aside>
  );
}
