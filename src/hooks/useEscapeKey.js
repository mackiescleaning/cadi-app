import { useEffect } from 'react';

// Run `onClose` when the user presses Escape. Pass `active` to gate (e.g. only
// while a modal is mounted). Doesn't fire if the keypress target is an
// editable element where Esc may already have semantic meaning (textarea).
export function useEscapeKey(onClose, active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, active]);
}
