import { useEffect, useState, useRef } from 'react';
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
import { useShabbatTimes } from '../components/useShabbatTimes';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'he', label: 'עב' },
  { code: 'fr', label: 'FR' },
  { code: 'yi', label: 'יי' },
];

// In production: same origin as client (Express serves both)
// In dev: Vite proxy forwards /socket.io to localhost:3001
const SOCKET_URL = window.location.origin;

export default function Kiosk() {
  const { synagogueId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lang, setLang] = useState('en');
  const [shabbatOverride, setShabbatOverride] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const socketRef = useRef(null);

  const { data: synagogue, refetch: refetchSynagogue } = useQuery({
    queryKey: ['synagogue-public', synagogueId],
    queryFn: () => api.get(`/synagogues/public/${synagogueId}`).then((r) => r.data),
  });

  const { data: mediaItems = [], refetch: refetchMedia } = useQuery({
    queryKey: ['media', synagogueId],
    queryFn: () => api.get(`/media/${synagogueId}`).then((r) => r.data),
  });

  const shabbatTimes = useShabbatTimes(synagogue?.latitude, synagogue?.longitude);

  const isShabbat = shabbatOverride !== null
    ? shabbatOverride
    : (synagogue?.shabbatModeActive || shabbatTimes.isShabbat);

  // Success / cancel toasts
  useEffect(() => {
    if (searchParams.get('success')) toast.success('Thank you for your donation! 🙏');
    if (searchParams.get('cancelled')) toast.info('Donation cancelled.');
  }, []);

  // Socket.io
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('kiosk:register', {
        synagogueId,
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
        timestamp: new Date().toISOString(),
      });
    }, 30000);

    return () => {
      clearInterval(statusInterval);
      socket.disconnect();
    };
  }, [synagogueId]);

  // Apply dark/light theme to <html>
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

  const isDark = synagogue.theme !== 'light';
  const bg = isDark ? 'bg-ink-900' : 'bg-gray-100';
  const headerBg = isDark ? 'bg-ink-800/90 border-white/5' : 'bg-white/90 border-gray-200';

  return (
    <div className={`min-h-screen ${bg} font-body`}>
      {isShabbat && <ShabbatMode synagogue={synagogue} shabbatTimes={shabbatTimes} />}

      {/* Floating announcement */}
      {announcement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gold-400 text-ink-900
                        px-8 py-4 rounded-2xl shadow-luxury font-semibold text-lg max-w-lg text-center fade-in">
          {announcement}
        </div>
      )}

      {/* Header */}
      <header className={`${headerBg} border-b backdrop-blur-sm sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* App logo */}
            <img src="/logo.png" alt="Truma Plus" className="h-9 object-contain shrink-0" />
            {/* Divider */}
            <span className={`w-px h-7 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
            {/* Synagogue logo + name */}
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
            {/* Language selector */}
            <div className="flex gap-1 mr-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    lang === l.code
                      ? 'bg-gold-400 text-ink-900'
                      : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Kiosk Mode button */}
            <KioskModeButton kioskPin={synagogue.kioskPin} isDark={isDark} />

            {/* Gabai login button — subtle but visible */}
            <button
              onClick={() => navigate('/login')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${isDark
                  ? 'text-white/30 hover:text-gold-400 hover:bg-white/8 border border-white/10 hover:border-gold-400/30'
                  : 'text-gray-400 hover:text-ink-900 hover:bg-gray-100 border border-gray-200'}`}
              title="Gabai Login"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Gabai</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <main className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-64px)]">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left — Announcements */}
          <div className="col-span-3 overflow-auto">
            <AnnouncementBoard synagogue={synagogue} lang={lang} />
          </div>

          {/* Center — Media Slideshow */}
          <div className="col-span-5">
            <MediaSlideshow
              mediaItems={mediaItems}
              interval={synagogue.slideshowInterval || 10}
              synagogueName={synagogue.synagogueName}
            />
          </div>

          {/* Right — Donation Panel */}
          <div className="col-span-4 overflow-auto">
            <DonationPanel synagogue={synagogue} lang={lang} />
          </div>
        </div>
      </main>
    </div>
  );
}
