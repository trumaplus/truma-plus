import { useState, useEffect } from 'react';

/**
 * Fetches daily Halachic times (zmanim) from Hebcal API.
 * Refreshes automatically at midnight.
 */
export function useZmanim(latitude = 45.5017, longitude = -73.5673) {
  const [zmanim, setZmanim] = useState(null);

  useEffect(() => {
    async function fetchZmanim() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
        const url =
          `https://www.hebcal.com/zmanim?cfg=json` +
          `&latitude=${latitude}&longitude=${longitude}` +
          `&tzid=${encodeURIComponent(tz)}&date=${today}`;

        const res  = await fetch(url);
        const json = await res.json();
        const t    = json.times || {};

        setZmanim({
          shmaGRA:      t.sofZmanShmaGRA      ?? null,
          shmaMGA:      t.sofZmanShmaMGA      ?? null,
          shacharitGRA: t.sofZmanTfillaGRA    ?? null,
          shacharitMGA: t.sofZmanTfillaMGA    ?? null,
          sunset:       t.sunset              ?? null,
        });
      } catch {
        setZmanim(null);
      }
    }

    fetchZmanim();

    // Refresh at midnight so zmanim reflect the new day
    const now       = new Date();
    const midnight  = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(fetchZmanim, midnight - now);
    return () => clearTimeout(timer);
  }, [latitude, longitude]);

  return zmanim;
}
