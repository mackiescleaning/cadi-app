// Cadi wordmark — inline SVG component, no external font dependency
// Renders the gradient "Cadi" text with glowing dot above the i
export default function CadiWordmark({ height = 28, className = "" }) {
  return (
    <span
      className={`inline-flex items-baseline select-none ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: height * 1.15, lineHeight: 1, letterSpacing: "-0.04em" }}
    >
      <span style={{ color: "rgba(196,211,255,0.65)" }}>C</span>
      <span style={{
        background: "linear-gradient(180deg, #fff 0%, #a8c4ff 40%, #4f78ff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0 0 6px rgba(79,120,255,0.4))",
      }}>a</span>
      <span style={{
        background: "linear-gradient(180deg, #fff 0%, #6090ff 55%, #2e55f0 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0 0 6px rgba(79,120,255,0.4))",
      }}>d</span>
      <span className="relative" style={{ color: "rgba(255,255,255,0.35)" }}>
        {/* i without dot */}
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>i</span>
        {/* Glowing dot */}
        <span className="absolute" style={{
          top: "-0.15em",
          left: "50%",
          transform: "translateX(-50%)",
          width: height * 0.35,
          height: height * 0.35,
          borderRadius: "50%",
          background: "radial-gradient(circle, #fff 0%, #a8c4ff 35%, #4f78ff 65%, rgba(29,56,196,0) 100%)",
          filter: "blur(1px)",
          pointerEvents: "none",
        }} />
        <span className="absolute" style={{
          top: "-0.08em",
          left: "50%",
          transform: "translateX(-50%)",
          width: height * 0.15,
          height: height * 0.15,
          borderRadius: "50%",
          background: "#fff",
          pointerEvents: "none",
        }} />
      </span>
    </span>
  );
}
