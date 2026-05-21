import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, AlertCircle } from 'lucide-react';

// Detect type from the stored 'type' field OR by URL extension as fallback
function resolveType(item) {
  if (!item) return 'image';
  // Trust the DB type field first
  const t = (item.type || '').toLowerCase();
  if (t === 'video') return 'video';
  if (t === 'pdf')   return 'pdf';
  if (t === 'image') return 'image';

  // Fallback: detect from URL extension
  const url = item.url || '';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (['mp4', 'webm', 'mov', 'avi', 'ogg'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'image'; // jpg, png, gif, webp, svg, etc.
}

function MediaItem({ item, visible }) {
  const [error, setError] = useState(false);
  const type = resolveType(item);

  // Reset error state when item changes
  useEffect(() => setError(false), [item?.url]);

  if (!item?.url) return null;

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
        <AlertCircle className="w-10 h-10 mb-2" />
        <p className="text-sm">Media unavailable</p>
        <p className="text-xs mt-1 opacity-60 max-w-[200px] truncate">{item.filename}</p>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <img
        key={item.url}
        src={item.url}
        alt={item.filename || 'Media'}
        className="w-full h-full object-contain"
        onError={() => setError(true)}
        loading="eager"
      />
    );
  }

  if (type === 'video') {
    return (
      <video
        key={item.url}
        src={item.url}
        autoPlay={visible}
        muted
        loop
        playsInline
        className="w-full h-full object-contain"
        onError={() => setError(true)}
      />
    );
  }

  if (type === 'pdf') {
    return (
      <iframe
        key={item.url}
        src={item.url}
        title={item.filename || 'Document'}
        className="w-full h-full border-0 bg-white"
        onError={() => setError(true)}
      />
    );
  }

  return null;
}

export default function MediaSlideshow({ mediaItems = [], interval = 10, synagogueName = '' }) {
  // Normalise active field: SQLite stores 0/1, Postgres stores true/false
  const active = mediaItems.filter((m) => m.active === true || m.active === 1);

  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  // Keep current in bounds if items change
  useEffect(() => {
    if (active.length > 0 && current >= active.length) {
      setCurrent(0);
    }
  }, [active.length]);

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
      setCurrent((prev) => {
        const next = (prev + 1) % active.length;
        setFade(false);
        setTimeout(() => setFade(true), 300);
        return next;
      });
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [active.length, interval]);

  // No media state
  if (active.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center card-glass text-center px-8">
        <ImageIcon className="w-16 h-16 text-white/10 mb-4" />
        <p className="font-display text-2xl text-white/30">{synagogueName}</p>
        <p className="text-white/20 text-sm mt-2">No media content</p>
        <p className="text-white/10 text-xs mt-1">Upload images or videos in the dashboard</p>
      </div>
    );
  }

  const item = active[Math.min(current, active.length - 1)];

  return (
    <div className="relative h-full rounded-2xl overflow-hidden bg-ink-900 group">

      {/* Debug badge (dev only) */}
      {import.meta.env.DEV && item && (
        <div className="absolute top-2 left-2 z-10 bg-black/60 text-white/60 text-xs px-2 py-0.5 rounded-md font-mono pointer-events-none">
          {resolveType(item)} · {item.filename}
        </div>
      )}

      {/* Media content with fade transition */}
      <div
        className="h-full w-full transition-opacity duration-300"
        style={{ opacity: fade ? 1 : 0 }}
      >
        <MediaItem item={item} visible={fade} />
      </div>

      {/* Navigation arrows (hover) */}
      {active.length > 1 && (
        <>
          <button
            onClick={() => goTo((current - 1 + active.length) % active.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                       bg-black/50 flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo((current + 1) % active.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full
                       bg-black/50 flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {active.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'bg-gold-400 w-5' : 'bg-white/30 w-2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
