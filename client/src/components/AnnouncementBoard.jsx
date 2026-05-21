import { useState, useEffect } from 'react';
import { Bell, Clock, BookOpen } from 'lucide-react';

const TRANSLATIONS = {
  en: { announcements: 'Announcements', prayerTimes: 'Prayer Times', today: 'Today', shabbat: 'Shabbat' },
  he: { announcements: 'הודעות', prayerTimes: 'זמני תפילה', today: 'היום', shabbat: 'שבת' },
  fr: { announcements: 'Annonces', prayerTimes: 'Horaires de prière', today: "Aujourd'hui", shabbat: 'Chabbat' },
  yi: { announcements: 'בשרייבונגען', prayerTimes: 'דאַוונצייטן', today: 'היינט', shabbat: 'שבת' },
};

function hebrewDate() {
  try {
    return new Date().toLocaleDateString('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function AnnouncementBoard({ synagogue, lang = 'en' }) {
  const [time, setTime] = useState(new Date());
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  let announcements = [];
  try {
    const raw = synagogue?.announcements;
    announcements = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
    announcements = announcements.filter((a) => a.active !== false);
  } catch {}

  let prayerTimes = null;
  try {
    const raw = synagogue?.prayerTimes;
    prayerTimes = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {}

  const isWeekend = time.getDay() === 5 || time.getDay() === 6;
  const prayers = isWeekend ? prayerTimes?.shabbat : prayerTimes?.weekday;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Clock */}
      <div className="card-glass p-5 text-center">
        <div className="font-mono text-4xl text-gold-400 font-light tracking-widest">
          {time.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-white/40 text-sm mt-1">
          {time.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="text-gold-400/50 text-xs mt-0.5">{hebrewDate()}</div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="card-glass p-5 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-gold-400" />
            <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">{t.announcements}</span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[240px]">
            {announcements.map((a, i) => (
              <div key={a.id || i} className="text-white/75 text-sm leading-relaxed border-l-2 border-gold-400/30 pl-3">
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prayer Times */}
      {prayers && (
        <div className="card-glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gold-400" />
            <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">{t.prayerTimes}</span>
            <span className="text-white/25 text-xs ml-auto">{isWeekend ? t.shabbat : t.today}</span>
          </div>
          <div className="space-y-2">
            {Object.entries(prayers).map(([prayer, time]) => (
              <div key={prayer} className="flex justify-between items-center text-sm">
                <span className="text-white/50 capitalize">{prayer}</span>
                <span className="text-white/80 font-medium">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parasha (placeholder) */}
      <div className="card-glass p-4 text-center">
        <BookOpen className="w-4 h-4 text-gold-400/50 mx-auto mb-1" />
        <p className="text-white/30 text-xs">Weekly Portion</p>
        <p className="text-white/60 text-sm font-display mt-1">
          {time.getDay() === 6 ? 'שבת קודש' : 'Check announcements'}
        </p>
      </div>
    </div>
  );
}
