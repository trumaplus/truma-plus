import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { Settings } from 'lucide-react';
import api from '../api/client';
import AnnouncementBoard from '../components/AnnouncementBoard';
import MediaSlideshow from '../components/MediaSlideshow';
import DonationPanel from '../components/DonationPanel';
import ShabbatMode from '../components/ShabbatMode';
import KioskModeButton from '../components/KioskModeButton';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useShabbatTimes } from '../components/useShabbatTimes';
import { useLanguage } from '../context/LanguageContext';
import { useLongPress } from '../components/useLongPress';

const SOCKET_URL  = window.location.origin;
const IDLE_MS     = 30_000; // 30 s before countdown starts
const COUNTDOWN_S = 10;     // 10 s countdown
const GEAR_HOLD_MS = 3000;  // 3 s long-press to reach /login

// Idle reset messages per language
const IDLE_MSG = {
  en: (n) => `Returning to home screen in ${n} seconds…`,
  he: (n) => `חוזר למסך הראשי בעוד ${n} שניות…`,
  fr: (n) => `Retour à l'écran principal dans ${n} secondes…`,
  yi: (n) => `צוריק צום הויפּט-עקראַן אין ${n} סעקונדעס…`,
};
const IDLE_BTN = { en: 'Continue', he: 'המשך', fr: 'Continuer', yi: 'ווייַטער' };

export default function Kiosk() {
  const { synagogueId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang } = useLanguage();

  const previewShabbat = searchParams.get('preview_shabbat') === '1';
  const [shabbatOverride, setShabbatOverride] = useState(previewShabbat ? true : null);
  const [announcement, setAnnouncement] = useState(null);
  const socketRef = useRef(null);

  // ── Auto-reset state ───────────────────────────────────────────────────────
  const [resetKey,  setResetKey]  = useState(0);
  const [countdown, setCountdown] = useState(null); // null = idle, 1–10 = counting
  const idleTimerRef  = useRef(null);
  const countTimerRef = useRef(null);
  const isShabbatRef  = useRef(false);

  const { data: synagogue, refetch: refetchSynagogue } = useQuery({
    queryKey: ['synagogue-public', synagogueId],
    queryFn:  () => api.get(`/synagogues/public/${synagogueId}`).then((r) => r.data),
  });

  const { data: mediaItems = [], refetch: refetchMedia } = useQuery({
    queryKey: ['media', synagogueId],
    queryFn:  () => api.get(`/media/${synagogueId}`).then((r) => r.data),
  });

  const shabbatTimes = useShabbatTimes(synagogue?.latitude, synagogue?.longitude);

  const isShabbat = shabbatOverride !== null
    ? shabbatOverride
    : (synagogue?.shabbatModeActive || shabbatTimes.isShabbat);

  // Keep ref in sync so timer callbacks can read current value without stale closure
  useEffect(() => { isShabbatRef.current = isShabbat; }, [isShabbat]);

  // ── ⚙ Gabai button — 3-second long press ──────────────────────────────────
  const { progress: gearProgress, isHolding: gearHolding, handlers: gearHandlers } =
    useLongPress(() => navigate('/login'), GEAR_HOLD_MS);

  // ── Idle / auto-reset logic ────────────────────────────────────────────────
  const cancelCountdown = useCallback(() => {
    clearInterval(countTimerRef.current);
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_S);
    countTimerRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(countTimerRef.current);
          setResetKey((k) => k + 1); // remount DonationPanel → reset all state
          return null;
        }
        return n - 1;
      });
    }, 1_000);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (isShabbatRef.current) return;
    cancelCountdown();
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(startCountdown, IDLE_MS);
  }, [cancelCountdown, startCountdown]);

  // Global activity listeners
  useEffect(() => {
    const events = ['touchstart', 'mousemove', 'mousedown', 'keydown'];
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(idleTimerRef.current);
      clearInterval(countTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Pause/resume idle timer when Shabbat mode toggles
  useEffect(() => {
    if (isShabbat) {
      clearTimeout(idleTimerRef.current);
      clearInterval(countTimerRef.current);
      setCountdown(null);
    } else {
      resetIdleTimer();
    }
  }, [isShabbat, resetIdleTimer]);

  // ── Success / cancel toasts ────────────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('success'))   toast.success('Thank you for your donation! 🙏');
    if (searchParams.get('cancelled')) toast.info('Donation cancelled.');
  }, []);

  // ── Socket.io ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('kiosk:register', {
        synagogueId,
        synagogueName: synagogue?.synagogueName || null,
        deviceInfo: { userAgent: navigator.userAgent, platform: navigator.platform },
      });
    });

    socket.on('admin:command', ({ type, payload }) => {
      switch (type) {
        case 'SET_SHABBAT_MODE':
          setShabbatOverride(payload);
          break;
        case 'RELOAD_CONTENT':
          refetchSynagogue();
          refetchMedia();
          toast.info('Content refreshed');
          break;
        case 'SHOW_ANNOUNCEMENT':
          setAnnouncement(payload?.text || '');
          setTimeout(() => setAnnouncement(null), 15000);
          break;
        case 'RELOAD_PAGE':
          window.location.reload();
          break;
        case 'PING':
          socket.emit('kiosk:pong', { synagogueId });
          break;
      }
    });

    const statusInterval = setInterval(() => {
      socket.emit('kiosk:status', {
        synagogueId,
        shabbatMode: isShabbat,
        timestamp:   new Date().toISOString(),
      });
    }, 30000);

    return () => {
      clearInterval(statusInterval);
      socket.disconnect();
    };
  }, [synagogueId, synagogue?.synagogueName]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (synagogue?.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8f9fa';
      document.body.style.color = '#1a1a2a';
    } else {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#07131a';
      document.body.style.color = 'white';
    }
    return () => {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, [synagogue?.theme]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!synagogue) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading kiosk…</p>
        </div>
      </div>
    );
  }

  const isDark   = synagogue.theme !== 'light';
  const bg       = isDark ? 'bg-ink-900'                    : 'bg-gray-100';
  const headerBg = isDark ? 'bg-ink-800/90 border-white/5'  : 'bg-white/90 border-gray-200';
  const idleMsg  = IDLE_MSG[lang] || IDLE_MSG.en;
  const idleBtn  = IDLE_BTN[lang] || IDLE_BTN.en;

  // SVG arc constants for gear long-press indicator
  const GEAR_R = 22;
  const GEAR_CIRC = 2 * Math.PI * GEAR_R;

  return (
    <div className={`h-screen overflow-hidden flex flex-col ${bg} font-body`}>
      {isShabbat && <ShabbatMode synagogue={synagogue} shabbatTimes={shabbatTimes} />}

      {/* ── Idle countdown overlay ──────────────────────────────────────────── */}
      {countdown !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onMouseDown={resetIdleTimer}
          onTouchStart={resetIdleTimer}
        >
          <div className="card-glass p-8 text-center max-w-sm mx-4 fade-in">
            <p className="text-gold-400 font-display text-2xl mb-2 leading-snug">
              {lang === 'he' || lang === 'yi' ? 'חוזר למסך הראשי…' : 'Returning to home screen…'}
            </p>
            <p className="text-white/50 text-sm mb-6">{idleMsg(countdown)}</p>
            <div className="w-20 h-20 rounded-full border-4 border-gold-400/60 flex items-center
                            justify-center mx-auto mb-6 relative">
              <span className="text-gold-400 text-3xl font-bold font-mono">{countdown}</span>
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#ffd166" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - countdown / COUNTDOWN_S)}`}
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
            </div>
            <button onClick={resetIdleTimer} className="btn-gold px-8">
              {idleBtn}
            </button>
          </div>
        </div>
      )}

      {/* ── Gear long-press overlay ─────────────────────────────────────────── */}
      {gearHolding && (
        <div className="fixed inset-0 z-[55] flex items-end justify-end pb-4 pr-4 pointer-events-none">
          <div className="card-glass p-4 flex items-center gap-3 fade-in">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90 shrink-0">
              <circle cx="24" cy="24" r={GEAR_R} fill="rgba(0,0,0,0.4)" strokeWidth="0" />
              <circle cx="24" cy="24" r={GEAR_R}
                fill="none" stroke="rgba(255,209,102,0.25)" strokeWidth="3" />
              <circle cx="24" cy="24" r={GEAR_R}
                fill="none" stroke="#ffd166" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={GEAR_CIRC}
                strokeDashoffset={GEAR_CIRC * (1 - gearProgress / 100)}
              />
            </svg>
            <span className="text-white/60 text-sm">Keep holding…</span>
          </div>
        </div>
      )}

      {/* Floating announcement */}
      {announcement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gold-400 text-ink-900
                        px-8 py-4 rounded-2xl shadow-luxury font-semibold text-lg max-w-lg text-center fade-in">
          {announcement}
        </div>
      )}

      {/* Header */}
      <header className={`shrink-0 ${headerBg} border-b backdrop-blur-sm z-40`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Truma Plus" className="h-9 object-contain shrink-0" />
            <span className={`w-px h-7 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
            {synagogue.logoUrl && (
              <img src={synagogue.logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
            )}
            <div>
              <h1 className={`font-display text-xl leading-tight ${isDark ? 'text-gold-400' : 'text-ink-900'}`}>
                {synagogue.synagogueName}
              </h1>
              {synagogue.city && (
                <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{synagogue.city}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher isDark={isDark} />
            <KioskModeButton isDark={isDark} kioskPin={synagogue.kioskPin || ''} />

            {/* ⚙ Icon-only — 3-second long press for Gabai access */}
            <div className="relative">
              <button
                {...gearHandlers}
                className={`p-2 rounded-xl transition-all select-none
                            ${isDark
                              ? 'text-white/20 hover:text-white/45 hover:bg-white/8 border border-white/8'
                              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
                title="Hold 3 seconds for Gabai access"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <main className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-4 py-3 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-full">
          <div className="col-span-3 h-full min-h-0 overflow-hidden">
            <AnnouncementBoard synagogue={synagogue} lang={lang} />
          </div>
          <div className="col-span-5 h-full min-h-0">
            <MediaSlideshow
              mediaItems={mediaItems}
              interval={synagogue.slideshowInterval || 10}
              synagogueName={synagogue.synagogueName}
            />
          </div>
          <div className="col-span-4 h-full min-h-0 overflow-hidden">
            {/* key={resetKey} forces full remount → resets all donation state */}
            <DonationPanel key={resetKey} synagogue={synagogue} lang={lang} />
          </div>
        </div>
      </main>
    </div>
  );
}
