import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Kiosk from './pages/Kiosk';
import Login from './pages/SynagogueLogin';
import SynagogueDashboard from './pages/SynagogueDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminSynagogueView from './pages/AdminSynagogueView';
import PWAUpdateBanner from './components/PWAUpdateBanner';
import { LanguageProvider } from './context/LanguageContext';

/**
 * Decode the JWT payload (base64 only).
 * Signature verification happens on the server for every API call.
 * This is used client-side only to read role / synagogueId without
 * trusting tamper-able localStorage values.
 */
function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

/**
 * Protects a route by role.
 * - No token / malformed token / expired token → redirect to /login
 * - Wrong role → redirect to that role's own dashboard
 * Role is read from the JWT payload, NOT from localStorage (which can be tampered).
 */
function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('dp_token');
  if (!token) return <Navigate to="/login" replace />;

  const payload = decodeJwt(token);
  // Reject missing payload or expired token
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    localStorage.removeItem('dp_token');
    return <Navigate to="/login" replace />;
  }

  const role = payload.role;
  if (role !== requiredRole) {
    // Admin trying to hit gabai route → send to admin dashboard (and vice-versa)
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors theme="dark" />
        <PWAUpdateBanner />
        <Routes>
          {/* Public */}
          <Route path="/"                   element={<Home />} />
          <Route path="/kiosk/:synagogueId" element={<Kiosk />} />

          {/* Single unified login — works for admin + gabai */}
          <Route path="/login"       element={<Login />} />
          {/* Legacy admin/login URL → same page */}
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />

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
    </LanguageProvider>
  );
}
