import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Kiosk from './pages/Kiosk';
import SynagogueLogin from './pages/SynagogueLogin';
import SynagogueDashboard from './pages/SynagogueDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminSynagogueView from './pages/AdminSynagogueView';
import PWAUpdateBanner from './components/PWAUpdateBanner';

/**
 * Protects a route by role.
 * - No token           → redirect to the matching login page
 * - Wrong role         → redirect to that role's own dashboard (not home)
 */
function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('dp_token');
  const role  = localStorage.getItem('dp_role');

  if (!token) {
    return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/login'} replace />;
  }

  if (role !== requiredRole) {
    // Admin trying to hit gabai route → send to admin dashboard (and vice-versa)
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
      <PWAUpdateBanner />
      <Routes>
        {/* Public */}
        <Route path="/"                      element={<Home />} />
        <Route path="/kiosk/:synagogueId"    element={<Kiosk />} />

        {/* Login pages (redirect away if already signed in — handled inside each component) */}
        <Route path="/login"                 element={<SynagogueLogin />} />
        <Route path="/admin/login"           element={<AdminLogin />} />

        {/* Gabai dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="synagogue">
              <SynagogueDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin: view a specific synagogue's dashboard */}
        <Route
          path="/admin/synagogue/:synagogueId"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSynagogueView />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
