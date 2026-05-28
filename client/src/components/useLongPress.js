import { useState, useRef, useCallback } from 'react';

/**
 * Long-press hook — fires onComplete after `duration` ms of continuous pressing.
 * Uses requestAnimationFrame for smooth progress (0–100).
 * Cancels cleanly if released before the threshold is reached.
 */
export function useLongPress(onComplete, duration = 3000) {
  const [progress, setProgress] = useState(0); // 0–100
  const rafRef     = useRef(null);
  const startRef   = useRef(null);
  const doneRef    = useRef(false); // prevent double-fire

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min((elapsed / duration) * 100, 100);
    setProgress(pct);
    if (pct < 100) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      doneRef.current = true;
      setProgress(0);
      onComplete?.();
    }
  }, [duration, onComplete]);

  const start = useCallback((e) => {
    e?.preventDefault();
    doneRef.current = false;
    startRef.current = Date.now();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setProgress(0);
  }, []);

  return {
    progress,               // 0–100
    isHolding: progress > 0,
    handlers: {
      onMouseDown:   start,
      onMouseUp:     cancel,
      onMouseLeave:  cancel,
      onTouchStart:  start,
      onTouchEnd:    cancel,
      onTouchCancel: cancel,
    },
  };
}
