import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 minutes
      r && setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4
                    bg-ink-700 border border-gold-400/30 rounded-2xl px-5 py-3 shadow-luxury
                    text-sm text-white/80 fade-in">
      <span>A new version is available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex items-center gap-1.5 bg-gold-400 text-ink-900 font-semibold
                   px-3 py-1.5 rounded-lg hover:bg-gold-500 transition-colors text-xs"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-white/30 hover:text-white/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
