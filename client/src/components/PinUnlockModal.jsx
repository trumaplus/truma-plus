import { useState, useEffect, useRef } from 'react';
import { Lock, Delete, X, Clock } from 'lucide-react';

const DIGITS       = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
const LOCKOUT_KEY  = 'dp_pin_lockout';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS   = 5 * 60 * 1000; // 5 minutes

// ── localStorage helpers ───────────────────────────────────────────────────────
function loadLockout() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.until) {
      localStorage.removeItem(LOCKOUT_KEY);
      return null;
    }
    return data; // { until: timestamp }
  } catch {
    return null;
  }
}

function saveLockout(until) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ until }));
}

function clearLockout() {
  localStorage.removeItem(LOCKOUT_KEY);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PinUnlockModal({ onSuccess, onCancel, correctPin }) {
  const [entered,   setEntered]   = useState('');
  const [shake,     setShake]     = useState(false);
  const [attempts,  setAttempts]  = useState(0);         // wrong attempts this session
  const [lockout,   setLockout]   = useState(loadLockout); // { until } | null
  const [remaining, setRemaining] = useState(0);          // seconds left in lockout
  const timerRef = useRef(null);

  // ── Lockout countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockout) return;

    function tick() {
      const secs = Math.max(0, Math.ceil((lockout.until - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearLockout();
        setLockout(null);
        setAttempts(0);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 500);
    return () => clearInterval(timerRef.current);
  }, [lockout]);

  // ── Numpad input ─────────────────────────────────────────────────────────────
  function handleDigit(d) {
    if (lockout) return;
    if (d === '⌫') { setEntered((p) => p.slice(0, -1)); return; }
    if (!d) return;
    const next = entered + d;
    if (next.length > 4) return;
    setEntered(next);

    if (next.length === 4) {
      setTimeout(() => {
        if (next === correctPin) {
          clearLockout();
          onSuccess();
        } else {
          setShake(true);
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);

          if (newAttempts >= MAX_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_MS;
            saveLockout(until);
            setLockout({ until });
            setAttempts(0);
          }

          setTimeout(() => { setShake(false); setEntered(''); }, 600);
        }
      }, 150);
    }
  }

  // Keyboard support
  useEffect(() => {
    function onKey(e) {
      if (lockout) return;
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleDigit('⌫');
      if (e.key === 'Escape') onCancel?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered, lockout, attempts]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`bg-ink-800 border border-white/10 rounded-3xl p-8 w-80 shadow-luxury
                       ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>

        {/* Header */}
        <div className="text-center mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3
                           ${lockout ? 'bg-red-500/10' : 'bg-gold-400/10'}`}>
            {lockout
              ? <Clock className="w-7 h-7 text-red-400" />
              : <Lock  className="w-7 h-7 text-gold-400" />
            }
          </div>
          <h2 className="font-display text-xl text-white">Exit Kiosk Mode</h2>

          {lockout ? (
            <>
              <p className="text-red-400 text-sm mt-2 font-medium">Too many attempts</p>
              <p className="text-white/40 text-sm mt-1">
                Try again in&nbsp;
                <span className="font-mono text-white/70">
                  {mins}:{String(secs).padStart(2, '0')}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-white/40 text-sm mt-1">Enter 4-digit PIN</p>
              {attempts > 0 && (
                <p className="text-red-400 text-xs mt-2">
                  Incorrect PIN ·&nbsp;
                  {MAX_ATTEMPTS - attempts}&nbsp;attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''}&nbsp;remaining
                </p>
              )}
            </>
          )}
        </div>

        {/* Lockout: big countdown */}
        {lockout ? (
          <div className="text-center py-4 mb-4">
            <div className="text-5xl font-mono font-bold text-red-400">
              {mins}:{String(secs).padStart(2, '0')}
            </div>
            <p className="text-white/30 text-xs mt-2">minutes remaining</p>
          </div>
        ) : (
          <>
            {/* Dots */}
            <div className="flex justify-center gap-3 mb-8">
              {[0,1,2,3].map((i) => (
                <div key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    i < entered.length
                      ? 'bg-gold-400 border-gold-400 scale-110'
                      : 'border-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {DIGITS.map((d, i) => (
                <button key={i} onClick={() => handleDigit(d)}
                  disabled={!d && d !== ''}
                  className={`h-14 rounded-xl font-semibold text-lg transition-all duration-150
                              active:scale-95 select-none
                              ${d === '⌫'
                                ? 'text-white/50 hover:bg-white/10 hover:text-white'
                                : d === ''
                                ? 'invisible'
                                : 'bg-white/5 text-white hover:bg-white/10 hover:text-gold-400'
                              }`}
                >
                  {d === '⌫' ? <Delete className="w-5 h-5 mx-auto" /> : d}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Cancel */}
        <button onClick={onCancel}
          className="w-full mt-4 py-2.5 text-white/30 hover:text-white/60 text-sm
                     transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
