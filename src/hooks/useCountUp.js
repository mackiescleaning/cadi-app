import { useEffect, useState } from 'react';

export function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!target || target === 0) {
      setValue(0);
      return;
    }
    let startTs = null;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    let rafId;

    const tick = (ts) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      setValue(Math.round(easeOut(progress) * target));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}
