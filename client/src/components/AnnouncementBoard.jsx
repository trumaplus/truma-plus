import { useState, useEffect } from 'react';
import { Bell, Clock, BookOpen, Sun } from 'lucide-react';
import { useZmanim } from './useZmanim';

const TRANSLATIONS = {
  en: {
    announcements: 'Announcements', prayerTimes: 'Prayer Times',
    today: 'Today', shabbat: 'Shabbat',
    zmanHeader: 'Daily Zmanim',
    shmaGRA: 'Shema (GRA)', shmaMGA: 'Shema (M"A)',
    shacharitGRA: 'Shacharit (GRA)', shacharitMGA: 'Shacharit (M"A)',
    sunset: 'Sunset',
  },
  he: {
    announcements: 'הודעות', prayerTimes: 'זמני תפילה',
    today: 'היום', shabbat: 'שבת',
    zmanHeader: 'זמנים הלכתיים',
    shmaGRA: 'ק"ש (גר"א)', shmaMGA: 'ק"ש (מג"א)',
    shacharitGRA: 'שחרית (גר"א)', shacharitMGA: 'שחרית (מג"א)',
    sunset: 'שקיעה',
  },
  fr: {
    announcements: 'Annonces', prayerTimes: 'Horaires de prière',
    today: "Aujourd'hui", shabbat: 'Chabbat',
    zmanHeader: 'Zmanim du jour',
    shmaGRA: 'Chema (GRA)', shmaMGA: 'Chema (M"A)',
    shacharitGRA: 'Chacharit (GRA)', shacharitMGA: 'Chacharit (M"A)',
    sunset: 'Coucher',
  },
  yi: {
    announcements: 'בשרייבונגען', prayerTimes: 'דאַוונצייטן',
    today: 'היינט', shabbat: 'שבת',
    zmanHeader: 'הלכה צייטן',
    shmaGRA: 'ק"ש (גר"א)', shmaMGA: 'ק"ש (מג"א)',
    shacharitGRA: 'שחרית (גר"א)', shacharitMGA: 'שחרית (מג"א)',
    sunset: 'שקיעה',
  },
};

// ── Prayer name translations ───────────────────────────────────────────────────
const PRAYER_NAMES = {
  kabbalatShabbat: { en: 'Kabbalat Shabbat', he: 'קבלת שבת',    fr: 'Kabbala Chabbat',       yi: 'קבלת שבת'    },
  shacharit:       { en: 'Shacharit',         he: 'שחרית',       fr: 'Chacharit',             yi: 'שחרית'       },
  minchaGedola:    { en: 'Mincha Gedola',     he: 'מנחה גדולה',  fr: 'Minha Gedola',          yi: 'מנחה גדולה'  },
  mincha:          { en: 'Mincha',            he: 'מנחה',        fr: 'Minha',                 yi: 'מנחה'        },
  maariv:          { en: 'Maariv',            he: 'ערבית',       fr: 'Arvit',                 yi: 'מעריב'       },
  motzeiShabbat:   { en: 'Motzei Shabbat',    he: 'מוצ"ש',       fr: "Motsa'é Chabbat",       yi: 'מוצ"ש'       },
};

// Canonical display order for prayer entries
const PRAYER_ORDER = ['kabbalatShabbat', 'shacharit', 'minchaGedola', 'mincha', 'maariv', 'motzeiShabbat'];

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

function fmt(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function AnnouncementBoard({ synagogue, lang = 'en' }) {
  const [time, setTime] = useState(new Date());
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const isDark = synagogue?.theme !== 'light';
  const zmanim = useZmanim(synagogue?.latitude, synagogue?.longitude);
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

      {/* Prayer Times — ordered, translated, empty-filtered */}
      {(() => {
        if (!prayerTimes) return null;
        const prayersObj = isWeekend ? prayerTimes.shabbat : prayerTimes.weekday;
        if (!prayersObj) return null;
        // Keep canonical order; skip empty / null / whitespace-only values
        const entries = PRAYER_ORDER
          .filter((key) => prayersObj[key] && String(prayersObj[key]).trim())
          .map((key) => ({
            key,
            label: (PRAYER_NAMES[key] || {})[lang] || key,
            time:  to24h(prayersObj[key]),
          }));
        if (entries.length === 0) return null;
        return (
          <div className={`${card} p-4 shrink-0`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gold-400" />
              <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">{t.prayerTimes}</span>
              <span className={`${textMuted} text-xs ml-auto`}>{isWeekend ? t.shabbat : t.today}</span>
            </div>
            <div className="space-y-1.5">
              {entries.map(({ key, label, time }) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className={textMuted}>{label}</span>
                  <span className={`${textStrong} font-medium`}>{time}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Halachic Zmanim */}
      {zmanim && (
        <div className={`${card} p-4 shrink-0`}>
          <div className="flex items-center gap-2 mb-2">
            <Sun className="w-4 h-4 text-gold-400" />
            <span className="text-gold-400 text-sm font-semibold tracking-wide uppercase">
              {t.zmanHeader}
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: t.shmaGRA,      val: zmanim.shmaGRA      },
              { label: t.shmaMGA,      val: zmanim.shmaMGA      },
              { label: t.shacharitGRA, val: zmanim.shacharitGRA },
              { label: t.shacharitMGA, val: zmanim.shacharitMGA },
              { label: t.sunset,       val: zmanim.sunset        },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className={`${textMuted} text-xs`}>{label}</span>
                <span className={`${textStrong} font-mono text-xs`}>{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parasha */}
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
