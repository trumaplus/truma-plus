import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';

export default function MediaSlideshow({ mediaItems = [], interval = 10, synagogueName = '' }) {
  const active = mediaItems.filter((m) => m.active !== false);
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  const goTo = useCallback((index) => {
    setFade(false);
    setTimeout(() => {
      setCurrent(index);
      setFade(true);
    }, 300);
  }, []);

  useEffect(() => {
    if (active.length <= 1) return;
    const timer = setInterval(() => {
      goTo((current + 1) % active.length);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [current, active.length, interval, goTo]);

  if (active.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center card-glass text-center px-8">
        <ImageIcon className="w-16 h-16 text-white/10 mb-4" />
        <p className="font-display text-2xl text-white/30">{synagogueName}</p>
        <p className="text-white/20 text-sm mt-2">No media content</p>
      </div>
    );
  }

  const item = active[current];

  return (
    <div className="relative h-full rounded-2xl overflow-hidden bg-ink-900 group">
      {/* Media content */}
      <div
        className="h-full w-full transition-opacity duration-300"
        style={{ opacity: fade ? 1 : 0 }}
      >
        {item.type === 'image' && (
          <img
            src={item.url}
            alt={item.filename}
            className="w-full h-full object-cover"
          />
        )}
        {item.type === 'pdf' && (
          <iframe
            src={item.url}
            title={item.filename}
            className="w-full h-full border-0"
          />
        )}
        {item.type === 'video' && (
          <video
            src={item.url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Navigation arrows (visible on hover) */}
      {active.length > 1 && (
        <>
          <button
            onClick={() => goTo((current - 1 + active.length) % active.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                       bg-black/50 flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo((current + 1) % active.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                       bg-black/50 flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {active.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-gold-400 w-5' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
