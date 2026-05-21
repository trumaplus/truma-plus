import { useState, useEffect, useRef } from 'react';
import { Lock, Delete, X } from 'lucide-react';

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinUnlockModal({ onSuccess, onCancel, correctPin }) {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  function handleDigit(d) {
    if (d === '⌫') { setEntered((p) => p.slice(0, -1)); return; }
    if (!d) return;
    const next = entered + d;
    if (next.length > 4) return;
    setEntered(next);

    if (next.length === 4) {
      setTimeout(() => {
        if (next === correctPin) {
          onSuccess();
        } else {
          setShake(true);
          setAttempts((a) => a + 1);
          setTimeout(() => { setShake(false); setEntered(''); }, 600);
        }
      }, 150);
    }
  }

  // Keyboard support
  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleDigit('⌫');
      if (e.key === 'Escape') onCancel?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`bg-ink-800 border border-white/10 rounded-3xl p-8 w-80 shadow-luxury
                       ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gold-400/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-gold-400" />
          </div>
          <h2 className="font-display text-xl text-white">Exit Kiosk Mode</h2>
          <p className="text-white/40 text-sm mt-1">Enter 4-digit PIN</p>
          {attempts >= 3 && (
            <p className="text-red-400 text-xs mt-2">Incorrect PIN ({attempts} attempts)</p>
          )}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0,1,2,3].map((i) => (
            <div
              key={i}
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
            <button
              key={i}
              onClick={() => handleDigit(d)}
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

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full mt-4 py-2.5 text-white/30 hover:text-white/60 text-sm transition-colors flex items-center justify-center gap-1.5"
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
