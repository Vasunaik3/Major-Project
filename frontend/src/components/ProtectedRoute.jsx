import AuthScreen from './AuthScreen.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, loading, logout } = useAuth();

  if (loading) {
    return <main className="route-loading"><span className="refresh-spinner">Loading secure session…</span></main>;
  }
  if (!session) return <AuthScreen />;
  if (allowedRoles && !allowedRoles.includes(session.user?.role)) {
    return (
      <main className="route-denied">
        <div><span className="eyebrow">ACCESS CONTROL</span><h1>Access restricted</h1><p>Your account role does not have permission to open this page.</p><button type="button" className="btn btn-forest" onClick={logout}>Sign out</button></div>
      </main>
    );
  }
  return children;
}
