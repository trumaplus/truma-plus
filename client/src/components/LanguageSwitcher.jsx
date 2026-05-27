import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang, LANGS } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div
      ref={ref}
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-1.5"
      style={{ direction: 'ltr' }}
    >
      {/* Options dropdown — slides up from the button */}
      {open && (
        <div className="bg-ink-800 border border-white/10 rounded-2xl p-1.5 shadow-luxury
                        flex flex-col gap-0.5 fade-in">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-medium
                          transition-all text-left whitespace-nowrap
                          ${l.code === lang
                            ? 'bg-gold-400 text-ink-900'
                            : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
            >
              <span className="font-bold w-5 text-center">{l.label}</span>
              <span className="opacity-70 text-xs">{l.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change language / שנה שפה"
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-luxury
                    border transition-all text-sm font-medium select-none
                    ${open
                      ? 'bg-gold-400 text-ink-900 border-gold-400'
                      : 'bg-ink-800 border-white/10 text-white/70 hover:border-gold-400/50 hover:text-gold-400'}`}
      >
        <Globe className="w-4 h-4 shrink-0" />
        <span className="font-bold">{current.label}</span>
      </button>
    </div>
  );
}
