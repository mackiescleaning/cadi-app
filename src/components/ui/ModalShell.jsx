// src/components/ui/ModalShell.jsx
// Shared overlay + panel wrapper for modal dialogs.
//
// Behaviour previously duplicated across RoundBatchModal, ServiceTemplatePicker,
// NewJobModal, AddCustomerModal:
//   • fixed full-screen overlay, semi-transparent bg, click-to-close
//   • panel that stopPropagation on click
//   • Escape closes (via useEscapeKey)
//   • role="dialog" + aria-modal="true"
//   • optional title in a bordered header, optional footer
//   • bottom-sheet on mobile, centred card on sm+
//
// Props:
//   open       — render when truthy
//   onClose    — called on overlay click / Escape / close-button click
//   title      — optional string for header
//   subtitle   — optional secondary line under title
//   maxWidth   — Tailwind max-w-* class (default "max-w-lg")
//   footer     — optional ReactNode rendered in a bordered footer
//   showClose  — render the absolute X button (default true)
//   children   — body content (rendered inside a scroll container)

import { X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = "max-w-lg",
  footer,
  showClose = true,
  ariaLabel,
  children,
}) {
  useEscapeKey(onClose, Boolean(open));
  if (!open) return null;

  const labelId = title ? "modal-shell-title" : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-label={!labelId ? ariaLabel : undefined}
    >
      <div
        className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={14} className="text-slate-600" />
          </button>
        )}

        {title && (
          <div className="p-5 border-b border-slate-100">
            <h2 id={labelId} className="text-lg font-black text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="p-5 border-t border-slate-100 bg-slate-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
