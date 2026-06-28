import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// useWeather — fetch 7-day forecast for a postcode via the met-office edge fn.
// Returns { forecast, loading, source } where forecast is keyed by date (YYYY-MM-DD).
// `forecast` is null when the API key isn't configured server-side — let the
// UI degrade gracefully (no overlay shown).

export function useWeather(postcode) {
  const [state, setState] = useState({ forecast: null, byDate: null, loading: false, source: null });

  useEffect(() => {
    if (!postcode) { setState({ forecast: null, byDate: null, loading: false, source: null }); return; }
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    supabase.functions.invoke('met-office', { body: { postcode } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.source === 'unavailable' || !data.forecast?.length) {
          setState({ forecast: null, byDate: null, loading: false, source: data?.source ?? 'error' });
          return;
        }
        const byDate = {};
        for (const day of data.forecast) byDate[day.date] = day;
        setState({ forecast: data.forecast, byDate, loading: false, source: data.source });
      })
      .catch(() => { if (!cancelled) setState({ forecast: null, byDate: null, loading: false, source: 'error' }); });

    return () => { cancelled = true; };
  }, [postcode]);

  return state;
}

// Helpers for the UI

export function weatherEmoji(condition = '') {
  const c = condition.toLowerCase();
  if (c.includes('thunder'))  return '⛈️';
  if (c.includes('snow'))     return '❄️';
  if (c.includes('hail') || c.includes('sleet')) return '🌨️';
  if (c.includes('heavy rain'))  return '🌧️';
  if (c.includes('rain') || c.includes('drizzle')) return '🌦️';
  if (c.includes('fog') || c.includes('mist'))    return '🌫️';
  if (c.includes('overcast') || c.includes('cloudy')) return '☁️';
  if (c.includes('partly'))   return '⛅';
  if (c.includes('clear night')) return '🌙';
  if (c.includes('sunny'))    return '☀️';
  return '';
}

export function isRainy(day) {
  if (!day) return false;
  if ((day.rainPct ?? 0) >= 60) return true;
  const c = (day.condition || '').toLowerCase();
  return c.includes('rain') || c.includes('thunder');
}
