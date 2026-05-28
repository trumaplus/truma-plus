import { useLanguage, LANGS } from '../context/LanguageContext';

/**
 * Compact pill-row language switcher — drop it anywhere in a header.
 * isDark  — true (default) for dark backgrounds, false for light backgrounds.
 */
export default function LanguageSwitcher({ isDark = true }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`flex gap-0.5 rounded-xl p-0.5 ${isDark ? 'bg-white/6' : 'bg-black/6'}`}
      style={{ direction: 'ltr' }}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          title={l.name}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-all ${
            lang === l.code
              ? 'bg-gold-400 text-ink-900 shadow-sm'
              : isDark
                ? 'text-white/45 hover:text-white/80 hover:bg-white/8'
                : 'text-gray-500 hover:text-gray-800 hover:bg-black/8'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
