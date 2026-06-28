import { useState } from "react";
import { generateMessage, generateAIMessage } from "./helpers";
import { SL, Alert } from "./primitives";

export default function MessageComposer({ customer, suggestion, onClose }) {
  const [tab,          setTab]          = useState("template");
  const [messageType,  setMessageType]  = useState(
    suggestion?.type === "winback"  ? "winback"  :
    suggestion?.type === "reminder" ? "reminder" : "reminder"
  );
  const [customInstr,  setCustomInstr]  = useState("");
  const [body,         setBody]         = useState(() => {
    const tpl = generateMessage(customer, messageType);
    return tpl.body;
  });
  const [subject,      setSubject]      = useState(() => {
    const tpl = generateMessage(customer, messageType);
    return tpl.subject;
  });
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(null);
  const [copied,       setCopied]       = useState(false);

  const MESSAGE_TYPES = [
    { id: "reminder",          label: "Job reminder"     },
    { id: "winback",           label: "Win-back"         },
    { id: "upsell_deep",       label: "Deep clean offer" },
    { id: "upsell_carpet",     label: "Carpet add-on"    },
    { id: "crosssell_exterior",label: "Exterior add-on"  },
    { id: "crosssell_regular", label: "Regular clean"    },
  ];

  const handleTypeChange = (type) => {
    setMessageType(type);
    const tpl = generateMessage(customer, type);
    setBody(tpl.body);
    setSubject(tpl.subject);
  };

  const handleAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const text = await generateAIMessage(customer, messageType, customInstr);
      setBody(text);
      setTab("ai");
    } catch {
      setAiError("Couldn't generate message — check your connection.");
    } finally {
      setAiLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />

        <div
          className="relative flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: "linear-gradient(135deg, #0d1e78 0%, #05124a 100%)" }}
        >
          <div>
            <p className="font-black text-sm text-white">Message — {customer.name.split(" ")[0]}</p>
            <p className="text-xs text-[#99c5ff] mt-0.5">{suggestion?.title ?? "Custom message"}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 relative">
          <div className="p-5 space-y-4">
            <div>
              <SL>Message type</SL>
              <div className="flex flex-wrap gap-1.5">
                {MESSAGE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTypeChange(t.id)}
                    className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      messageType === t.id
                        ? "bg-[#1f48ff] text-white border-[#1f48ff]/60"
                        : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SL>Subject line</SL>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <SL>Message body</SL>
                <div className="flex gap-2">
                  <button
                    onClick={handleAI}
                    disabled={aiLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      aiLoading
                        ? "bg-white/5 text-[rgba(153,197,255,0.3)] border-[rgba(153,197,255,0.08)] cursor-not-allowed"
                        : "bg-[rgba(153,197,255,0.08)] border-[rgba(153,197,255,0.15)] text-[#99c5ff] hover:bg-[rgba(153,197,255,0.15)]"
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : (
                      "AI personalise"
                    )}
                  </button>
                  <button
                    onClick={copy}
                    className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      copied
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                        : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                    }`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {aiError && <div className="mb-2"><Alert type="warn">{aiError}</Alert></div>}
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                className="w-full bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors resize-none leading-relaxed font-mono"
              />
            </div>

            <div>
              <SL>Personalisation notes (optional)</SL>
              <input
                value={customInstr}
                onChange={e => setCustomInstr(e.target.value)}
                placeholder="e.g. mention the bank holiday, keep it under 3 sentences..."
                className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="relative px-5 py-4 border-t border-[rgba(153,197,255,0.08)] bg-[#010a4f]/90 flex gap-2 shrink-0">
          <a
            href={`mailto:${customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25 ${
              customer.email
                ? "bg-[#1f48ff] hover:bg-[#3a5eff] text-white"
                : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.3)] cursor-not-allowed pointer-events-none"
            }`}
          >
            {customer.email ? "Send email" : "No email on file"}
          </a>
          <button
            onClick={copy}
            className="flex-1 py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
          >
            {copied ? "Copied" : "Copy text"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[rgba(153,197,255,0.4)] hover:text-white text-xs font-bold uppercase transition-colors rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
