import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import PinUnlockModal from './PinUnlockModal';

export default function KioskModeButton({ kioskPin, isDark }) {
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const wakeLockRef = useRef(null);

  // Re-acquire wake lock when tab regains visibility
  useEffect(() => {
    async function onVisibilityChange() {
      if (isKioskMode && document.visibilityState === 'visible' && !wakeLockRef.current) {
        await acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isKioskMode]);

  // Block keyboard exit shortcuts in kiosk mode
  useEffect(() => {
    if (!isKioskMode) return;
    function blockKeys(e) {
      // Block Alt+F4, F11, Escape, Alt+Tab, Windows key combos
      if (e.key === 'F11' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowPinModal(true);
      }
    }
    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [isKioskMode]);

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (err) {
      console.warn('Wake lock failed:', err.message);
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  async function enterKioskMode() {
    try {
      // Fullscreen
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      toast.error('Fullscreen not available');
      return;
    }

    // Wake lock
    await acquireWakeLock();
    setIsKioskMode(true);
    toast.success('Kiosk mode active — screen will stay on');
  }

  function requestExit() {
    if (kioskPin) {
      setShowPinModal(true);
    } else {
      // No PIN configured — exit directly
      exitKioskMode();
    }
  }

  function exitKioskMode() {
    releaseWakeLock();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsKioskMode(false);
    setShowPinModal(false);
    toast.info('Exited kiosk mode');
  }

  const btnBase = isDark
    ? 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-gold-400/40 hover:bg-white/10'
    : 'bg-black/5 border border-black/10 text-gray-500 hover:text-gray-800';

  return (
    <>
      {!isKioskMode ? (
        <button
          onClick={enterKioskMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                      transition-all duration-200 ${btnBase}`}
          title="Enter kiosk mode (fullscreen + screen always on)"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Kiosk Mode</span>
        </button>
      ) : (
        <button
          onClick={requestExit}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                     bg-gold-400/15 border border-gold-400/30 text-gold-400
                     hover:bg-gold-400/25 transition-all duration-200"
          title="Exit kiosk mode"
        >
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline">Exit Kiosk</span>
        </button>
      )}

      {showPinModal && (
        <PinUnlockModal
          correctPin={kioskPin || '0000'}
          onSuccess={exitKioskMode}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </>
  );
}
