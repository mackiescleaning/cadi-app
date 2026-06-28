import { useState } from "react";
import { Download } from "lucide-react";

// Two-tier delete UX:
//   • Archive — soft delete, reversible, leaves all data in place. Default
//     action for "I'm not working with this customer any more". Reachable in
//     one click.
//   • Permanently erase — GDPR Article 17. Hard-deletes the customer record,
//     cascades rounds/recurring/etc., redacts PII on jobs/invoices that must
//     be kept for HMRC. Reversible only from backups. Requires typing the
//     customer's name to confirm and is hidden behind a "Show GDPR options"
//     toggle so the owner doesn't fire it by accident.
export default function ArchiveButton({ onConfirm, onErase, onExport, name }) {
  const [confirming, setConfirming] = useState(false);
  const [showErase,  setShowErase]  = useState(false);
  const [eraseText,  setEraseText]  = useState('');
  const [erasing,    setErasing]    = useState(false);
  const [eraseResult, setEraseResult] = useState(null);
  const [eraseError, setEraseError] = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const [exportError, setExportError] = useState(null);

  const handleExport = async () => {
    if (!onExport || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await onExport();
    } catch (err) {
      setExportError(err?.message ?? 'Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const eraseConfirmed = eraseText.trim().toLowerCase() === (name || '').trim().toLowerCase();

  const handleErase = async () => {
    if (!eraseConfirmed || !onErase) return;
    setErasing(true);
    setEraseError(null);
    try {
      const result = await onErase();
      setEraseResult(result);
    } catch (err) {
      setEraseError(err?.message ?? 'Erasure failed. Try again.');
      setErasing(false);
    }
  };

  // Success view — shown once erasure completes. The parent will usually
  // close the detail panel, but we render briefly so the user sees confirmation.
  if (eraseResult) {
    return (
      <div className="px-5 py-4 border-t border-[rgba(153,197,255,0.08)] space-y-2">
        <p className="text-xs text-emerald-400 font-bold">
          Erased {name}. Receipt logged for your records.
        </p>
        <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
          {eraseResult.jobsRedacted} job{eraseResult.jobsRedacted === 1 ? '' : 's'} redacted ·
          {' '}{eraseResult.invoicesRedacted} invoice{eraseResult.invoicesRedacted === 1 ? '' : 's'} redacted ·
          {' '}{eraseResult.parsedRemoved} staging row{eraseResult.parsedRemoved === 1 ? '' : 's'} removed
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="px-5 py-4 border-t border-[rgba(153,197,255,0.08)]">
        <p className="text-xs text-[rgba(153,197,255,0.6)] mb-3 text-center">
          Remove <span className="font-bold text-white">{name}</span> from your customer list?
          <br /><span className="text-[rgba(153,197,255,0.4)]">Their data is kept — you can find them under Archived.</span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-2.5 text-xs font-bold text-[rgba(153,197,255,0.6)] border border-[rgba(153,197,255,0.15)] rounded-xl hover:bg-white/5 transition-all"
          >Keep</button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-xs font-bold text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all"
          >Archive</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-t border-[rgba(153,197,255,0.08)] space-y-2">
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2.5 text-xs font-bold text-red-400/60 border border-red-500/15 rounded-xl hover:bg-red-500/8 hover:text-red-400 hover:border-red-500/30 transition-all"
      >
        Archive customer
      </button>

      {/* GDPR erasure — only revealed after explicit toggle so it's hard to
          fire by accident, and locked behind a name-typed confirmation. */}
      {!showErase ? (
        <button
          onClick={() => setShowErase(true)}
          className="w-full text-[10px] font-semibold text-[rgba(153,197,255,0.45)] hover:text-red-400/80 transition-colors"
        >
          GDPR options →
        </button>
      ) : (
        <div className="space-y-2.5">
          {/* SAR / Article 15+20 export. Lives in the GDPR panel because it's
              a data-rights action even though it's non-destructive. */}
          {onExport && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.18)] bg-[rgba(31,72,255,0.06)] p-3 space-y-1.5">
              <p className="text-[11px] font-black text-[#99c5ff]">Export this customer's data (SAR)</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.6)] leading-snug">
                Downloads a JSON file with everything Cadi holds about {name} — profile, jobs, rounds, invoices, surveys, conversations. Use this to fulfil a Subject Access Request within 30 days.
              </p>
              {exportError && <p className="text-[10px] text-red-400">{exportError}</p>}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full mt-1 py-2 text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-lg bg-[#1f48ff] hover:bg-[#3a6bff] text-white disabled:opacity-40 transition-all"
              >
                <Download size={11} /> {exporting ? 'Preparing…' : 'Download JSON'}
              </button>
            </div>
          )}

        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 space-y-2">
          <p className="text-[11px] font-black text-red-300">Permanently erase (GDPR Article 17)</p>
          <p className="text-[10px] text-red-300/70 leading-snug">
            Deletes the customer record and cascades to rounds, recurring jobs and notes.
            Invoices and completed jobs are kept for HMRC but have personal details redacted.
            This cannot be undone.
          </p>
          <input
            type="text"
            value={eraseText}
            onChange={e => setEraseText(e.target.value)}
            placeholder={`Type "${name}" to confirm`}
            className="w-full px-3 py-2 rounded-lg bg-black/20 border border-red-500/20 text-xs text-white placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:border-red-400"
          />
          {eraseError && (
            <p className="text-[10px] text-red-400">{eraseError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowErase(false); setEraseText(''); setEraseError(null); }}
              disabled={erasing}
              className="flex-1 py-2 text-[10px] font-bold text-[rgba(153,197,255,0.5)] border border-[rgba(153,197,255,0.15)] rounded-lg hover:bg-white/5 disabled:opacity-40"
            >Cancel</button>
            <button
              onClick={handleErase}
              disabled={!eraseConfirmed || erasing}
              className="flex-1 py-2 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {erasing ? 'Erasing…' : 'Erase permanently'}
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
