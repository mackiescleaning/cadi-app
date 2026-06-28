// src/components/ui/Button.jsx
// Lightweight button primitive. Captures the 4–5 dominant inline-style
// buckets used across modals and forms so we stop re-typing them.
//
// Variants:
//   primary    — filled brand-blue, white text, shadow
//   secondary  — slate fill, dark text (neutral confirm)
//   danger     — red filled
//   ghost      — text-only slate (Cancel-style)
//
// Sizes:
//   md (default) — px-4 py-2.5 text-sm
//   sm           — px-3 py-2   text-xs
//
// All standard <button> props pass through (onClick, disabled, type, etc).
// Forwards `ref` so it can be focused programmatically.

import { forwardRef } from "react";

const VARIANTS = {
  primary:   "bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black shadow-lg shadow-blue-600/25 transition-all",
  secondary: "bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold transition-colors",
  danger:    "bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black shadow-lg shadow-red-600/25 transition-all",
  ghost:     "text-slate-500 hover:text-slate-700 font-semibold transition-colors",
};

const SIZES = {
  md: "px-4 py-2.5 text-sm rounded-xl",
  sm: "px-3 py-2 text-xs rounded-lg",
};

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", className = "", children, ...props },
  ref
) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.md;
  const base = variant === "ghost" ? "" : s;
  return (
    <button
      ref={ref}
      className={`${variant === "ghost" ? "text-xs" : ""} ${base} ${v} inline-flex items-center justify-center gap-2 ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
