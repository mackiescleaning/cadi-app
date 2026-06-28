// src/components/ui/UndoToast.jsx
// "Done · Undo" snackbar — dark slate pill, message + amber Undo button.
// Currently bottom-centered, z-50. Renders nothing when `open` is false,
// so consumers can drop it in unconditionally.
//
// Props:
//   open    — render when truthy
//   message — string or ReactNode shown to the left
//   onUndo  — click handler for the Undo button (button hidden if absent)
//   label   — Undo button text (default "Undo")

export default function UndoToast({ open, message, onUndo, label = "Undo" }) {
  if (!open) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-white/10 shadow-2xl flex items-center gap-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-white">{message}</p>
      {onUndo && (
        <button
          onClick={onUndo}
          className="text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors uppercase tracking-wider"
        >
          {label}
        </button>
      )}
    </div>
  );
}
