import { createContext, useContext, useState } from 'react';

export const LANGS = [
  { code: 'en', label: 'EN', name: 'English',  flag: '🇬🇧' },
  { code: 'fr', label: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'he', label: 'עב', name: 'עברית',    flag: '🇮🇱' },
  { code: 'yi', label: 'יי', name: 'ייִדיש',  flag: '🇾🇪' },
];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('dp_lang') || 'en'
  );

  function setLang(code) {
    setLangState(code);
    localStorage.setItem('dp_lang', code);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, LANGS }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
