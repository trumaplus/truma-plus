import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Wifi, WifiOff, RefreshCw, Moon, Sun, Megaphone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const SOCKET_URL = window.location.origin;

export default function KioskControl({ synagogueId, synagogueName, isAdmin = false }) {
  const [kiosks, setKiosks] = useState([]);
  const [connected, setConnected] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const socketRef = useRef(null);
  const token = localStorage.getItem('dp_token');

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (isAdmin) {
        socket.emit('admin:join', { token });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('admin:joined', ({ kiosks: list }) => setKiosks(list));
    socket.on('kiosk:connected', (data) => {
      setKiosks((prev) => {
        const exists = prev.find((k) => k.synagogueId === data.synagogueId);
        if (exists) return prev.map((k) => k.synagogueId === data.synagogueId ? { ...k, connected: true } : k);
        return [...prev, { ...data, connected: true }];
      });
      toast.success(`Kiosk connected: ${data.synagogueId}`);
    });
    socket.on('kiosk:disconnected', ({ synagogueId: sid }) => {
      setKiosks((prev) => prev.filter((k) => k.synagogueId !== sid));
    });
    socket.on('kiosk:status-update', (data) => {
      setKiosks((prev) => prev.map((k) => k.synagogueId === data.synagogueId ? { ...k, ...data } : k));
    });

    return () => socket.disconnect();
  }, [isAdmin, token]);

  function sendCommand(targetSynagogueId, type, payload) {
    socketRef.current?.emit('admin:command', { token, synagogueId: targetSynagogueId, type, payload });
    toast.info(`Command sent: ${type}`);
  }

  // For synagogue dashboard — show only their own kiosk
  const displayKiosks = isAdmin
    ? kiosks
    : kiosks.filter((k) => k.synagogueId === synagogueId);

  const targetId = synagogueId || null;

  return (
    <div>
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-white/50 text-sm">{connected ? 'Connected to server' : 'Disconnected'}</span>
      </div>

      {/* Quick actions (for synagogue dashboard) */}
      {!isAdmin && targetId && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => sendCommand(targetId, 'RELOAD_CONTENT', null)}
            className="btn-outline flex items-center justify-center gap-2 py-3"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Content
          </button>
          <button
            onClick={() => sendCommand(targetId, 'SET_SHABBAT_MODE', true)}
            className="btn-outline flex items-center justify-center gap-2 py-3"
          >
            <Moon className="w-4 h-4" />
            Shabbat Mode
          </button>
          <button
            onClick={() => sendCommand(targetId, 'SET_SHABBAT_MODE', false)}
            className="btn-outline flex items-center justify-center gap-2 py-3"
          >
            <Sun className="w-4 h-4" />
            Exit Shabbat
          </button>
          <button
            onClick={() => sendCommand(targetId, 'RELOAD_PAGE', null)}
            className="btn-outline flex items-center justify-center gap-2 py-3"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      )}

      {/* Send announcement */}
      {targetId && (
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Send announcement to kiosk…"
            className="flex-1 input-dark"
          />
          <button
            onClick={() => {
              sendCommand(targetId, 'SHOW_ANNOUNCEMENT', { text: announcement });
              setAnnouncement('');
            }}
            className="btn-gold px-4 flex items-center gap-2"
          >
            <Megaphone className="w-4 h-4" />
            Send
          </button>
        </div>
      )}

      {/* Kiosk list (admin only) */}
      {isAdmin && (
        <>
          <h3 className="text-white/50 text-sm mb-3">
            {kiosks.length === 0 ? 'No kiosks connected' : `${kiosks.length} kiosk(s) connected`}
          </h3>
          <div className="space-y-4">
            {kiosks.map((kiosk) => (
              <div key={kiosk.synagogueId} className="card-glass p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-white/80 font-medium">{kiosk.synagogueId}</p>
                      <p className="text-white/30 text-xs">
                        Last seen: {kiosk.lastSeen ? new Date(kiosk.lastSeen).toLocaleTimeString() : '—'}
                      </p>
                    </div>
                  </div>
                  {kiosk.currentState?.shabbatMode && (
                    <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      Shabbat Mode
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => sendCommand(kiosk.synagogueId, 'RELOAD_CONTENT', null)}
                    className="text-xs btn-outline py-2 px-2 flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reload
                  </button>
                  <button onClick={() => sendCommand(kiosk.synagogueId, 'SET_SHABBAT_MODE', true)}
                    className="text-xs btn-outline py-2 px-2 flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" /> Shabbat
                  </button>
                  <button onClick={() => sendCommand(kiosk.synagogueId, 'SET_SHABBAT_MODE', false)}
                    className="text-xs btn-outline py-2 px-2 flex items-center justify-center gap-1">
                    <Sun className="w-3 h-3" /> Exit
                  </button>
                  <button onClick={() => sendCommand(kiosk.synagogueId, 'RELOAD_PAGE', null)}
                    className="text-xs btn-outline py-2 px-2 flex items-center justify-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Page
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isAdmin && displayKiosks.length === 0 && (
        <div className="text-center py-12 text-white/30">
          <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Kiosk not connected</p>
          <p className="text-sm mt-1 text-white/20">Open the kiosk page on your tablet</p>
        </div>
      )}
    </div>
  );
}
