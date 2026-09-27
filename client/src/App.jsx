import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkerDashboard    from './pages/worker/Dashboard';
import CompleteProfile    from './pages/worker/CompleteProfile';
import EmployerDashboard  from './pages/employer/Dashboard';
import SuggestedWorkers   from './pages/employer/SuggestedWorkers';
import AdminDashboard     from './pages/admin/Dashboard';

// ──────────────────────────────────────────────────────────────────────────────
// ProtectedRoute
// Redirects to /login if not authenticated.
// Optionally restricts to a specific role.
// ──────────────────────────────────────────────────────────────────────────────
function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // User is authenticated but wrong role → send to their own dashboard
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return children;
}

// ──────────────────────────────────────────────────────────────────────────────
// RoleRedirect
// When an authenticated user hits "/" they are bounced to their dashboard.
// ──────────────────────────────────────────────────────────────────────────────
function RoleRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}

// ──────────────────────────────────────────────────────────────────────────────
// App
// ──────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Role-aware home redirect */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Protected — Worker */}
          <Route
            path="/worker/dashboard"
            element={
              <ProtectedRoute requiredRole="worker">
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/worker/complete-profile"
            element={
              <ProtectedRoute requiredRole="worker">
                <CompleteProfile />
              </ProtectedRoute>
            }
          />

          {/* Protected — Employer */}
          <Route
            path="/employer/dashboard"
            element={
              <ProtectedRoute requiredRole="employer">
                <EmployerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employer/jobs/:jobId/suggested"
            element={
              <ProtectedRoute requiredRole="employer">
                <SuggestedWorkers />
              </ProtectedRoute>
            }
          />

          {/* Protected — Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
