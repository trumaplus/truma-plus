import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage, LANGS } from '../context/LanguageContext';

/**
 * Compact dropdown language switcher.
 * Shows only the current language (flag + code); click to open a dropdown with all options.
 * isDark — true (default) for dark backgrounds, false for light.
 */
export default function LanguageSwitcher({ isDark = true }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" style={{ direction: 'ltr' }}>

      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium
                    transition-all select-none
                    ${isDark
                      ? 'text-white/50 hover:text-white/80 hover:bg-white/8 border border-white/10'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
        title="Change language"
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="font-bold tracking-wide">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className={`absolute top-full mt-1.5 right-0 min-w-[140px] rounded-xl border
                      shadow-2xl z-50 overflow-hidden fade-in
                      ${isDark ? 'bg-ink-800 border-white/10' : 'bg-white border-gray-200'}`}
        >
          {LANGS.map((l) => {
            const isActive = l.code === lang;
            return (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm
                            transition-all text-left
                            ${isActive
                              ? (isDark
                                  ? 'bg-gold-400/15 text-gold-400'
                                  : 'bg-gold-400/10 text-amber-700')
                              : (isDark
                                  ? 'text-white/60 hover:bg-white/5 hover:text-white/90'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                            }`}
              >
                <span className="text-base leading-none shrink-0">{l.flag}</span>
                <span className="flex-1">{l.name}</span>
                {isActive && <span className="text-xs shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
