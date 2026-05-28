import { useState, useEffect } from 'react';
import { Bell, Clock, BookOpen } from 'lucide-react';

const TRANSLATIONS = {
  en: { announcements: 'Announcements', prayerTimes: 'Prayer Times', today: 'Today', shabbat: 'Shabbat' },
  he: { announcements: 'הודעות', prayerTimes: 'זמני תפילה', today: 'היום', shabbat: 'שבת' },
  fr: { announcements: 'Annonces', prayerTimes: 'Horaires de prière', today: "Aujourd'hui", shabbat: 'Chabbat' },
  yi: { announcements: 'בשרייבונגען', prayerTimes: 'דאַוונצייטן', today: 'היינט', shabbat: 'שבת' },
};

function to24h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr;
  if (!/[AaPp][Mm]/.test(timeStr)) return timeStr; // already 24-h or no period
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

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
  const isDark = synagogue?.theme !== 'light';
  const card  = isDark ? 'card-glass' : 'card-light';
  const textMuted  = isDark ? 'text-white/40'  : 'text-gray-500';
  const textMain   = isDark ? 'text-white/75'  : 'text-gray-800';
  const textStrong = isDark ? 'text-white/80'  : 'text-gray-900';
  const border     = isDark ? 'border-gold-400/30' : 'border-gold-500/40';

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
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Clock */}
      <div className={`${card} p-4 text-center shrink-0`}>
        <div className="font-mono text-4xl text-gold-400 font-light tracking-widest">
          {time.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
        <div className={`${textMuted} text-sm mt-1`}>
          {time.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="text-gold-400/50 text-xs mt-0.5">{hebrewDate()}</div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className={`${card} flex-1 min-h-0 flex flex-col overflow-hidden p-4`}>
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <Bell className="w-4 h-4 text-gold-400" />
            <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">{t.announcements}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {announcements.map((a, i) => (
              <div key={a.id || i} className={`${textMain} text-sm leading-relaxed border-l-2 ${border} pl-3`}>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prayer Times */}
      {prayers && (
        <div className={`${card} p-4 shrink-0`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gold-400" />
            <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">{t.prayerTimes}</span>
            <span className={`${textMuted} text-xs ml-auto`}>{isWeekend ? t.shabbat : t.today}</span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(prayers).map(([prayer, pTime]) => (
              <div key={prayer} className="flex justify-between items-center text-sm">
                <span className={`${textMuted} capitalize`}>{prayer}</span>
                <span className={`${textStrong} font-medium`}>{to24h(pTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parasha (placeholder) */}
      <div className={`${card} p-3 text-center shrink-0`}>
        <BookOpen className="w-4 h-4 text-gold-400/50 mx-auto mb-1" />
        <p className={`${textMuted} text-xs`}>Weekly Portion</p>
        <p className={`${textMain} text-sm font-display mt-0.5`}>
          {time.getDay() === 6 ? 'שבת קודש' : 'Check announcements'}
        </p>
      </div>
    </div>
  );
}
