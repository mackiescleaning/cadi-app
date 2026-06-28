// Step 2 — "Get your customers in. Any format. Seriously."
// File dropzone + paste textarea + "no list?" escape. On submit: each upload
// becomes a customer_imports row, file → bucket, edge function fires, status
// polled. Streamed "Cadi is reading your list" copy plays during parsing.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  createFileImport,
  createTextImport,
  triggerParse,
  listImportsForSession,
  deleteImport,
  updateStep,
  sourceTypeForFile,
  failStuckImports,
} from '../../lib/db/onboardingDb';

// Streamed status copy — plays even if the network is fast, so the wait
// itself feels like Cadi at work.
const PARSING_COPY = [
  { atMs: 0,     text: "Reading your list…" },
  { atMs: 2500,  text: "Finding customers…" },
  { atMs: 5500,  text: "Spotting prices and frequencies…" },
  { atMs: 9000,  text: "Working out due dates…" },
  { atMs: 13000, text: "Nearly there…" },
];

const ACCEPT = '.csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp,.heic,.txt';

export default function StepUpload({ session, onAdvance }) {
  const navigate = useNavigate();
  const [tab, setTab]                 = useState('file'); // 'file' | 'paste' | 'skip'
  const [imports, setImports]         = useState([]);
  const [pasteText, setPasteText]     = useState('');
  const [pasteSaving, setPasteSaving] = useState(false);
  const [dragging, setDragging]       = useState(false);
  const [phase, setPhase]             = useState('idle'); // 'idle' | 'parsing' | 'done' | 'error'
  const [statusCopy, setStatusCopy]   = useState(PARSING_COPY[0].text);
  const [error, setError]             = useState(null);
  const fileInputRef                  = useRef(null);

  // Initial load — pick up any imports from a previous session resume.
  useEffect(() => {
    listImportsForSession(session.id).then(setImports).catch(() => {});
  }, [session.id]);

  // Status-copy stream during parsing.
  useEffect(() => {
    if (phase !== 'parsing') return;
    const t0 = Date.now();
    const timers = PARSING_COPY.map(({ atMs, text }) =>
      setTimeout(() => setStatusCopy(text), atMs)
    );
    // Failsafe to advance copy through the list as wall-clock passes.
    return () => { timers.forEach(clearTimeout); };
  }, [phase]);

  // Poll for parse status. Also runs a server-side watchdog every cycle:
  // if any row has stayed pending/parsing for >180s, mark it failed so we
  // never get stuck "Reading…" forever (the issue that made the diary photo
  // hang on the first run).
  useEffect(() => {
    if (phase !== 'parsing') return;
    let cancelled = false;
    const poll = setInterval(async () => {
      if (cancelled) return;
      // Watchdog first — flips stuck rows to 'failed' before we re-read them.
      await failStuckImports(session.id, 180).catch(() => {});
      const fresh = await listImportsForSession(session.id);
      setImports(fresh);
      const allDone = fresh.length > 0 && fresh.every(i => i.parse_status === 'parsed' || i.parse_status === 'failed');
      if (allDone) {
        clearInterval(poll);
        const successful   = fresh.filter(i => i.parse_status === 'parsed');
        const failedCount  = fresh.filter(i => i.parse_status === 'failed').length;
        const totalCount   = successful.reduce((s, i) => s + (i.raw_row_count || 0), 0);
        if (successful.length > 0) {
          setPhase('done');
          if (failedCount > 0) {
            setStatusCopy(`Found ${totalCount} customer${totalCount === 1 ? '' : 's'}. ${failedCount} file${failedCount === 1 ? '' : 's'} couldn't be read.`);
          } else {
            setStatusCopy(totalCount > 0
              ? `Found ${totalCount} customer${totalCount === 1 ? '' : 's'} across ${fresh.length} file${fresh.length === 1 ? '' : 's'}.`
              : `Couldn't pick out any customers. Try a different file?`);
          }
        } else {
          setPhase('error');
          const firstErr = fresh.find(i => i.parse_error)?.parse_error;
          setError(firstErr || "Couldn't read those files. Try a clearer photo, or paste the text directly.");
        }
      }
    }, 1500);
    return () => { cancelled = true; clearInterval(poll); };
  }, [phase, session.id]);

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setError(null);
    const files = [...fileList];

    // Validate types up front so the user gets one clear error instead of
    // half-uploading then failing.
    const bad = files.find(f => !sourceTypeForFile(f));
    if (bad) {
      setError(`I can't read "${bad.name}" — try CSV, PDF, photo (JPG/PNG), or paste the text.`);
      return;
    }

    // Only flip to "parsing" phase on the first batch; later additions just
    // append to the chip list and trigger parses without resetting the UI.
    if (phase !== 'parsing') {
      setPhase('parsing');
      setStatusCopy(PARSING_COPY[0].text);
    }

    try {
      const created = [];
      for (const file of files) {
        const imp = await createFileImport({ sessionId: session.id, file });
        created.push(imp);
        setImports(prev => [...prev, imp]);
      }
      // Parses run in parallel; Sonnet handles concurrency fine.
      await Promise.all(created.map(imp => triggerParse(imp.id).catch(e => {
        console.warn(`parse trigger failed for ${imp.id}:`, e?.message);
      })));
    } catch (e) {
      setError(e?.message ?? "Couldn't upload that. Try again?");
      setPhase('error');
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setError(null);
    setPasteSaving(true);
    setPhase('parsing');
    setStatusCopy(PARSING_COPY[0].text);
    try {
      const imp = await createTextImport({ sessionId: session.id, text: pasteText });
      setImports(prev => [...prev, imp]);
      await triggerParse(imp.id).catch(() => {});
      setPasteText('');
    } catch (e) {
      setError(e?.message ?? "Couldn't save that text. Try again?");
      setPhase('error');
    } finally {
      setPasteSaving(false);
    }
  };

  const handleRemove = async (imp) => {
    try {
      await deleteImport(imp.id, imp.storage_path);
      setImports(prev => prev.filter(i => i.id !== imp.id));
    } catch (e) {
      setError("Couldn't remove that one. Try refreshing.");
    }
  };

  const goReview = async () => {
    await updateStep(session.id, 'review');
    onAdvance({ ...session, step: 'review' });
  };

  const goSkip = async () => {
    await updateStep(session.id, 'complete');
    navigate('/customers');
  };

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-8 sm:py-14">
      <div className="w-full max-w-2xl">
        {/* Top nav — back to divisions if they want to change which sectors
            their business covers. */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={async () => {
              try {
                await updateStep(session.id, 'divisions');
                onAdvance({ ...session, step: 'divisions' });
              } catch (e) {
                setError(e?.message ?? "Couldn't go back.");
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1f48ff] hover:text-[#010a4f] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f0f4ff]"
          >
            <ArrowLeft size={14} /> Back to divisions
          </button>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#010a4f]/45">
            Step 2 of 5
          </span>
        </div>
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-[#010a4f] mb-2 leading-tight">
            Get your customers in.
          </h1>
          <p className="text-sm text-[#010a4f]/60 max-w-md mx-auto">
            Spreadsheets, screenshots of your diary, exports from other software — drop it all in. I'll sort it.
          </p>
        </div>

        {phase === 'idle' && (
          <>
            <div className="flex border border-[#1f48ff]/15 rounded-xl mb-4 overflow-hidden">
              {[
                { key: 'file',  label: '📂 Upload files' },
                { key: 'paste', label: '✏ Paste text' },
                { key: 'skip',  label: 'No list yet' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setError(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    tab === t.key
                      ? 'bg-[#1f48ff]/8 text-[#010a4f] border-b-2 border-[#1f48ff]'
                      : 'text-[#010a4f]/60 hover:text-[#1f48ff]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'file' && (
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer?.files);
                }}
                className={`flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed cursor-pointer transition-all p-8 sm:p-12 ${
                  dragging
                    ? 'border-[#1f48ff] bg-[#1f48ff]/8'
                    : 'border-[#1f48ff]/15 bg-[#f0f4ff] hover:bg-[#1f48ff]/8 hover:border-[#1f48ff]/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  onChange={e => handleFiles(e.target.files)}
                  className="hidden"
                />
                <Upload size={36} className="text-[#1f48ff] mb-3" />
                <p className="text-base font-black text-[#010a4f] mb-1">Drop your files here</p>
                <p className="text-xs text-[#010a4f]/60 max-w-xs">
                  Multiple files at once is fine. CSVs, photos of your diary, PDFs, screenshots — drop them all in.
                </p>
                <span className="mt-4 px-4 py-2 rounded-lg bg-[#1f48ff] text-white text-xs font-bold">
                  Or browse files…
                </span>
                <p className="mt-2 text-[10px] text-[#010a4f]/45">
                  Tip: hold ⌘ (Mac) or Ctrl (Windows) in the file picker to select more than one.
                </p>
              </label>
            )}

            {tab === 'paste' && (
              <div className="space-y-3">
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={10}
                  placeholder={"Just type or paste — anything goes. For example:\n\nMrs Smith - 12 Acacia Ave SW19 - £25 fortnightly\nGarveston Hall - £56 weekly\nMonday 9am - Dowling £22 windows…"}
                  className="w-full rounded-xl border border-[#1f48ff]/15 bg-[#f0f4ff] text-[#010a4f] text-sm p-3 sm:p-4 placeholder-[#010a4f]/35 font-mono focus:outline-none focus:border-[#1f48ff] resize-y"
                />
                <button
                  onClick={handlePaste}
                  disabled={!pasteText.trim() || pasteSaving}
                  className="w-full py-3 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black shadow-lg shadow-[#1f48ff]/25 transition-all"
                >
                  {pasteSaving ? 'Saving…' : 'Send this to Cadi'}
                </button>
              </div>
            )}

            {tab === 'skip' && (
              <div className="rounded-2xl border border-[#1f48ff]/15 bg-white p-6 text-center">
                <p className="text-sm text-[#010a4f]/75 mb-2">No customer list yet — that's fine.</p>
                <p className="text-xs text-[#010a4f]/60 mb-5">
                  You can add customers one at a time later. We'll finish onboarding and drop you on the Customers tab.
                </p>
                <button
                  onClick={goSkip}
                  className="px-5 py-2.5 rounded-xl border border-[#1f48ff]/15 bg-[#f0f4ff] text-[#1f48ff] hover:text-[#010a4f] hover:border-[#1f48ff] text-xs font-bold transition-all"
                >
                  Skip this step →
                </button>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
                {error}
              </p>
            )}
          </>
        )}

        {/* Files chip list — always visible when there are files. The
            "Add more" pill works in every phase so the user can keep
            stacking. */}
        {imports.length > 0 && phase !== 'error' && (
          <div className="mt-5 space-y-2">
            {imports.map(imp => {
              const failed = imp.parse_status === 'failed';
              return (
                <div
                  key={imp.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    failed
                      ? 'border-red-200 bg-red-50'
                      : 'border-[#1f48ff]/15 bg-[#f0f4ff]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    failed
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-[#1f48ff]/8 border border-[#1f48ff]/15'
                  }`}>
                    <FileText size={14} className={failed ? 'text-red-600' : 'text-[#1f48ff]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#010a4f] truncate">
                      {imp.storage_path?.split('/').pop() || 'pasted text'}
                    </p>
                    <p className={`text-[10px] leading-snug ${failed ? 'text-red-600' : 'text-[#010a4f]/60'}`}>
                      {imp.parse_status === 'parsed'  && `✓ ${imp.raw_row_count || 0} customers found`}
                      {imp.parse_status === 'parsing' && 'Reading…'}
                      {imp.parse_status === 'pending' && 'Queued…'}
                      {failed && (imp.parse_error?.slice(0, 90) || 'Could not read this one')}
                    </p>
                  </div>
                  {imp.parse_status === 'parsed' && <Check size={14} className="text-emerald-600 shrink-0" />}
                  {failed && (
                    <button
                      onClick={() => triggerParse(imp.id).catch(() => {})}
                      aria-label="Retry"
                      title="Try parsing this file again"
                      className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shrink-0"
                    >
                      Retry
                    </button>
                  )}
                  {phase !== 'parsing' && (
                    <button
                      onClick={() => handleRemove(imp)}
                      aria-label="Remove"
                      className="w-6 h-6 rounded-md hover:bg-[#f0f4ff] flex items-center justify-center text-[#010a4f]/45 hover:text-[#010a4f] shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add more — visible during parsing AND done so they can
                always stack more files (e.g. CSV + a diary photo). */}
            <label className="block">
              <input
                type="file"
                multiple
                accept={ACCEPT}
                onChange={e => handleFiles(e.target.files)}
                className="hidden"
              />
              <span className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[#1f48ff]/15 bg-[#f0f4ff] text-[#1f48ff] text-xs font-bold cursor-pointer hover:border-[#1f48ff] hover:bg-[#1f48ff]/8 transition-all">
                <Upload size={12} /> Add more files
              </span>
            </label>
          </div>
        )}

        {/* Parsing state — the "wait IS the wow" moment */}
        {phase === 'parsing' && (
          <div className="mt-8 text-center">
            <ReadingAnimation />
            <p className="text-base font-bold text-[#010a4f] mt-6 mb-1 transition-all duration-500">{statusCopy}</p>
            <p className="text-xs text-[#010a4f]/60">Hang on — I'm being thorough.</p>
          </div>
        )}

        {/* Done — count + celebration. The persistent CTA below the chip
            list handles the actual advance, so this is pure reassurance copy. */}
        {phase === 'done' && (
          <div className="mt-8 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-emerald-50 border border-emerald-200">
              <Check size={32} className="text-emerald-600" strokeWidth={2.5} />
            </div>
            <p className="text-xl font-black text-[#010a4f] mb-2">{statusCopy}</p>
            <p className="text-sm text-[#010a4f]/60 max-w-sm mx-auto">
              Add more if you've got them, or hit Done to review what I've read.
            </p>
          </div>
        )}

        {/* Error retry */}
        {phase === 'error' && (
          <div className="mt-8 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50 border border-red-200">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <p className="text-base font-black text-[#010a4f] mb-2">Something didn't work.</p>
            <p className="text-sm text-[#010a4f]/60 mb-6 max-w-sm mx-auto">
              {error || "I couldn't read those files."}
            </p>
            <button
              onClick={() => { setPhase('idle'); setError(null); }}
              className="px-5 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black"
            >
              Try again
            </button>
          </div>
        )}

        {/* Bottom spacer so the sticky CTA never covers the last chip */}
        {imports.length > 0 && <div className="h-28" />}
      </div>

      {/* Sticky CTA bar — appears the moment a file lands. Disabled while
          any file is still parsing; live count of parsed customers shown. */}
      {imports.length > 0 && phase !== 'error' && (() => {
        const parsedCount   = imports.filter(i => i.parse_status === 'parsed').length;
        const failedCount   = imports.filter(i => i.parse_status === 'failed').length;
        const inFlightCount = imports.length - parsedCount - failedCount;
        const totalCustomers = imports.reduce((s, i) => s + (i.raw_row_count || 0), 0);
        const ready = inFlightCount === 0 && parsedCount > 0;
        const label = ready
          ? `Done — review ${totalCustomers} customer${totalCustomers === 1 ? '' : 's'} →`
          : inFlightCount > 0
            ? `Reading ${inFlightCount} file${inFlightCount === 1 ? '' : 's'}…`
            : 'Add at least one readable file';
        return (
          <div className="sticky bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-[#1f48ff]/15">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
              <button
                onClick={goReview}
                disabled={!ready}
                className={`w-full py-3.5 rounded-xl text-sm font-black shadow-lg transition-all ${
                  ready
                    ? 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-[#1f48ff]/25'
                    : 'bg-[#f0f4ff] border border-[#1f48ff]/15 text-[#010a4f]/45 cursor-not-allowed shadow-none'
                }`}
              >
                {label}
              </button>
              {failedCount > 0 && ready && (
                <p className="text-[11px] text-amber-700 mt-2 text-center">
                  {failedCount} file{failedCount === 1 ? '' : 's'} couldn't be read — remove and try a different format, or carry on.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Animation ───────────────────────────────────────────────────────────────
// Concentric pulsing rings around a central Cadi dot. Restrained — no fluff.
function ReadingAnimation() {
  return (
    <div className="relative w-20 h-20 mx-auto">
      <style>{`
        @keyframes _cadi_ring {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes _cadi_pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.7; transform: scale(1.08); }
        }
        ._cadi_ring { animation: _cadi_ring 1.8s ease-out infinite; }
        ._cadi_pulse { animation: _cadi_pulse 1.8s ease-in-out infinite; }
      `}</style>
      <div className="absolute inset-0 rounded-full border-2 border-[#1f48ff]/40 _cadi_ring" style={{ animationDelay: '0s' }} />
      <div className="absolute inset-0 rounded-full border-2 border-[#1f48ff]/40 _cadi_ring" style={{ animationDelay: '0.6s' }} />
      <div className="absolute inset-0 rounded-full border-2 border-[#1f48ff]/40 _cadi_ring" style={{ animationDelay: '1.2s' }} />
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#1f48ff] to-[#99c5ff] _cadi_pulse shadow-2xl shadow-[#1f48ff]/40" />
    </div>
  );
}
