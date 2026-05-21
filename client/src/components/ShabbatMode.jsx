import { useState, useEffect } from 'react';
import { Phone, Star } from 'lucide-react';

export default function ShabbatMode({ synagogue, shabbatTimes }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  };

  const hebrewDay = time.toLocaleDateString('he-IL', { weekday: 'long' });

  const emergencyNumbers = synagogue?.emergencyNumbers || {};
  const prayerTimes = synagogue?.prayerTimes?.shabbat || {};

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-ink-900 via-ink-800 to-ink-900 flex flex-col items-center justify-center z-50 px-6">
      {/* Stars decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gold-400/30 rounded-full"
            style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, opacity: Math.random() * 0.6 + 0.2 }}
          />
        ))}
      </div>

      <div className="relative text-center max-w-lg mx-auto">
        {synagogue?.logoUrl && (
          <img src={synagogue.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
        )}

        <h1 className="font-display text-6xl text-gold-400 mb-2">שבת שלום</h1>
        <p className="text-white/60 text-xl mb-1">Shabbat Shalom</p>
        {shabbatTimes?.parsha && (
          <p className="text-gold-400/70 text-base mt-2">פרשת {shabbatTimes.parsha}</p>
        )}

        <div className="text-white/30 text-3xl font-mono mt-8 mb-8">
          {time.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Candles / Havdalah */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card-glass p-4 text-center">
            <p className="text-white/40 text-xs mb-1">🕯 Candle Lighting</p>
            <p className="text-gold-400 font-semibold text-lg">{formatTime(shabbatTimes?.candleLighting)}</p>
          </div>
          <div className="card-glass p-4 text-center">
            <p className="text-white/40 text-xs mb-1">✨ Shabbat Ends</p>
            <p className="text-gold-400 font-semibold text-lg">{formatTime(shabbatTimes?.shabbatEnds)}</p>
          </div>
        </div>

        {/* Shabbat Prayer Times */}
        {Object.keys(prayerTimes).length > 0 && (
          <div className="card-glass p-5 mb-8 text-left">
            <p className="text-gold-400/70 text-sm font-semibold mb-3 text-center">Shabbat Prayer Times</p>
            <div className="space-y-2">
              {Object.entries(prayerTimes).map(([prayer, time]) => (
                <div key={prayer} className="flex justify-between text-sm">
                  <span className="text-white/50 capitalize">{prayer}</span>
                  <span className="text-white/80">{time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency */}
        <div className="flex gap-3 justify-center">
          <a
            href="tel:911"
            className="flex items-center gap-2 bg-red-900/40 border border-red-500/30 text-red-400
                       px-5 py-3 rounded-xl text-sm font-semibold hover:bg-red-900/60 transition-colors"
          >
            <Phone className="w-4 h-4" />
            911
          </a>
          {emergencyNumbers.hatzalah && (
            <a
              href={`tel:${emergencyNumbers.hatzalah}`}
              className="flex items-center gap-2 bg-amber-900/40 border border-amber-500/30 text-amber-400
                         px-5 py-3 rounded-xl text-sm font-semibold hover:bg-amber-900/60 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Hatzalah
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
