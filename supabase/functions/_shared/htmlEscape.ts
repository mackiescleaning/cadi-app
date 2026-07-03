// Escape user-supplied text before embedding into an HTML email or any
// HTML template string. Ampersand must be replaced FIRST so subsequent
// entity substitutions aren't double-encoded.
//
// Used from every Connect edge function that renders user text inside
// email bodies (notes, messages, comments). Modern mail clients strip
// most active content anyway, but we don't rely on that.
export function htmlEscape(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Common companion helper: escape, then turn newlines into <br/> so
// paragraph breaks in user notes survive the HTML render.
export function htmlEscapeMultiline(s: unknown): string {
  return htmlEscape(s).replace(/\n/g, "<br/>");
}
