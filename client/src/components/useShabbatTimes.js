import { useState, useEffect } from 'react';

export function useShabbatTimes(latitude = 45.5017, longitude = -73.5673) {
  const [data, setData] = useState({
    isShabbat: false,
    candleLighting: null,
    shabbatEnds: null,
    parsha: '',
  });

  useEffect(() => {
    async function fetchTimes() {
      try {
        const url = `https://www.hebcal.com/shabbat?cfg=json&latitude=${latitude}&longitude=${longitude}&m=50&fmt=json`;
        const res = await fetch(url);
        const json = await res.json();

        let candleLighting = null;
        let shabbatEnds = null;
        let parsha = '';

        for (const item of json.items || []) {
          if (item.category === 'candles') candleLighting = item.date;
          if (item.category === 'havdalah') shabbatEnds = item.date;
          if (item.category === 'parashat') parsha = item.title;
        }

        const now = new Date();
        const isShabbat =
          candleLighting && shabbatEnds
            ? now >= new Date(candleLighting) && now <= new Date(shabbatEnds)
            : false;

        setData({ isShabbat, candleLighting, shabbatEnds, parsha });
      } catch {
        // fallback: check if Friday after sunset or Saturday before havdalah
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const isShabbat = (day === 5 && hour >= 18) || (day === 6 && hour < 21);
        setData((prev) => ({ ...prev, isShabbat }));
      }
    }

    fetchTimes();
    const interval = setInterval(fetchTimes, 60_000);
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  return data;
}
