import { useState, useEffect, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

const KIOSK_PIN_KEY = 'dp_kiosk_pin';

/**
 * Enter-only kiosk mode button.
 * The EXIT button lives exclusively on the /login page for security.
 * Stores kioskPin in localStorage so the /login exit-flow can verify it.
 */
export default function KioskModeButton({ isDark, kioskPin = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const wakeLockRef = useRef(null);

  // Track fullscreen state changes
  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Re-acquire wake lock when tab regains visibility
  useEffect(() => {
    async function onVisibilityChange() {
      if (isFullscreen && document.visibilityState === 'visible' && !wakeLockRef.current) {
        await acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isFullscreen]);

  // Block accidental keyboard exits in kiosk mode
  useEffect(() => {
    if (!isFullscreen) return;
    function blockKeys(e) {
      if (e.key === 'F11' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [isFullscreen]);

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
      }
    } catch (err) {
      console.warn('Wake lock failed:', err.message);
    }
  }

  async function enterKioskMode() {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      toast.error('Fullscreen not available');
      return;
    }
    await acquireWakeLock();
    // Persist PIN so the /login exit-flow can verify it without a server round-trip
    if (kioskPin) localStorage.setItem(KIOSK_PIN_KEY, kioskPin);
    else          localStorage.removeItem(KIOSK_PIN_KEY);
    toast.success('Kiosk mode active — screen will stay on');
  }

  // When already in fullscreen, render nothing (exit is on /login)
  if (isFullscreen) return null;

  const btnBase = isDark
    ? 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-gold-400/40 hover:bg-white/10'
    : 'bg-black/5 border border-black/10 text-gray-500 hover:text-gray-800';

  return (
    <button
      onClick={enterKioskMode}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                  transition-all duration-200 ${btnBase}`}
      title="Enter kiosk mode (fullscreen + screen always on)"
    >
      <Maximize2 className="w-4 h-4" />
      <span className="hidden sm:inline">Kiosk Mode</span>
    </button>
  );
}
