import AuthScreen from './AuthScreen.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <main className="route-loading"><span className="refresh-spinner">Loading secure session…</span></main>;
  }
  if (!session) return <AuthScreen />;
  return children;
}
