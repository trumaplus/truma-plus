import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Minimize2 } from 'lucide-react';
import api from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PinUnlockModal from '../components/PinUnlockModal';
import { useLongPress } from '../components/useLongPress';

const KIOSK_PIN_KEY = 'dp_kiosk_pin'; // stored when entering kiosk mode

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const [kioskPin]                       = useState(() => localStorage.getItem(KIOSK_PIN_KEY) || '');
  const [showPinModal, setShowPinModal] = useState(false);
  const navigate = useNavigate();

  // Already logged in → go straight to the right dashboard
  const existingToken = localStorage.getItem('dp_token');
  const existingRole  = localStorage.getItem('dp_role');
  if (existingToken && existingRole === 'synagogue') return <Navigate to="/dashboard" replace />;
  if (existingToken && existingRole === 'admin')     return <Navigate to="/admin"     replace />;

  // Track fullscreen state
  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Exit kiosk: 3-second long press ────────────────────────────────────────
  const { progress: exitProgress, isHolding: exitHolding, handlers: exitHandlers } =
    useLongPress(() => {
      if (kioskPin) {
        setShowPinModal(true);
      } else {
        doExitKiosk();
      }
    }, 3000);

  function doExitKiosk() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    // Release wake lock if any
    navigator?.wakeLock?.request('screen').then((wl) => wl.release()).catch(() => {});
    setShowPinModal(false);
    toast.info('Exited kiosk mode');
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('dp_token', data.token);
      localStorage.setItem('dp_role',  data.role);

      if (data.role === 'admin') {
        toast.success('Welcome, Admin');
        navigate('/admin');
      } else {
        localStorage.setItem('dp_synagogueId',   data.synagogueId);
        localStorage.setItem('dp_synagogueName', data.synagogueName);
        toast.success(`Welcome, ${data.synagogueName}`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // Arc constants for the exit long-press indicator
  const EXIT_R    = 26;
  const EXIT_CIRC = 2 * Math.PI * EXIT_R;

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
      {/* Language switcher — top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* ── Exit Kiosk Mode section — only shown when in fullscreen ─────────── */}
      {isFullscreen && (
        <div className="fixed top-4 left-4 z-50">
          <div className="relative">
            <button
              {...exitHandlers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                         bg-gold-400/15 border border-gold-400/30 text-gold-400
                         hover:bg-gold-400/25 transition-all duration-200 select-none"
              title="Hold 3 seconds to exit kiosk mode"
            >
              <Minimize2 className="w-4 h-4" />
              Exit Kiosk
              {/* Inline arc progress ring */}
              {exitHolding && (
                <svg
                  className="absolute pointer-events-none"
                  style={{
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                    width: 72, height: 72, zIndex: 10,
                  }}
                  viewBox="0 0 60 60"
                >
                  <circle cx="30" cy="30" r={EXIT_R} fill="rgba(0,0,0,0.55)" />
                  <circle cx="30" cy="30" r={EXIT_R}
                    fill="none" stroke="rgba(255,209,102,0.2)" strokeWidth="3" />
                  <circle cx="30" cy="30" r={EXIT_R}
                    fill="none" stroke="#ffd166" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={EXIT_CIRC}
                    strokeDashoffset={EXIT_CIRC * (1 - exitProgress / 100)}
                  />
                </svg>
              )}
            </button>
          </div>

          <p className="text-white/25 text-xs mt-1.5 text-center">Hold 3 s to exit</p>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <img src="/logo.png" alt="Truma Plus" className="h-20 mx-auto object-contain" />
          </Link>
          <p className="text-white/40 mt-3 text-sm">כניסה לפאנל ניהול</p>
        </div>

        {/* Card */}
        <div className="card-dark p-8">
          <h2 className="font-display text-2xl text-white mb-8 text-center">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <input
                type="email" required autoComplete="email"
                className="w-full input-dark"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <input
                type="password" required autoComplete="current-password"
                className="w-full input-dark"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-gold w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* PIN modal */}
      {showPinModal && (
        <PinUnlockModal
          correctPin={kioskPin || '0000'}
          onSuccess={doExitKiosk}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
