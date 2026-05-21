import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Kiosk from './pages/Kiosk';
import SynagogueLogin from './pages/SynagogueLogin';
import SynagogueDashboard from './pages/SynagogueDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import PWAUpdateBanner from './components/PWAUpdateBanner';

function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('dp_token');
  const role = localStorage.getItem('dp_role');
  if (!token) return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/login'} replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
      <PWAUpdateBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kiosk/:synagogueId" element={<Kiosk />} />
        <Route path="/login" element={<SynagogueLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="synagogue">
              <SynagogueDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
