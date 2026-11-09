import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    </AuthProvider>
  );
}
