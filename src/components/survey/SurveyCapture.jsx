/**
 * SurveyCapture.jsx
 * Phase 1 — mobile-first live capture: raw notes, photos, checklist backstop.
 *
 * Props:
 *   survey          — site_surveys row (with .customers)
 *   onNotesChange   — (notes: string) => void  (auto-saves to DB)
 *   onPhotoAdded    — (mediaRow) => void
 *   onDone          — () => void  (triggers Phase 2 structuring)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  updateSurveyNotes,
  uploadSurveyPhoto,
  addSurveyMedia,
  listSurveyMedia,
  deleteSurveyMedia,
  listChecklistsForSurvey,
} from '../../lib/db/surveyDb';
import { supabase } from '../../lib/supabase';

const DEBOUNCE_MS_SAVE = 800; // notes auto-save debounce
const DEBOUNCE_MS_CLARIFY = 3500; // pause clarification debounce

// ── Checklist coverage check ──────────────────────────────────────────────────
// Simple keyword presence — enough for the backstop nudge.
function isCovered(label, notes) {
  const keywords = label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter((w) => w.length > 3);
  const lnotes = notes.toLowerCase();
  return keywords.some((kw) => lnotes.includes(kw));
}

export default function SurveyCapture({ survey, onNotesChange, onPhotoAdded, onDone }) {
  const [notes, setNotes] = useState(survey.raw_notes ?? '');
  const [media, setMedia] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [clarifyQ, setClarifyQ] = useState(null); // {question: string} | null
  const [structuring, setStructuring] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'

  const saveTimer = useRef(null);
  const clarifyTimer = useRef(null);
  const fileRef = useRef(null);

  // Load media and checklists on mount
  useEffect(() => {
    listSurveyMedia(survey.id).then(setMedia).catch(console.error);
    listChecklistsForSurvey([]).then(setChecklists).catch(console.error);
  }, [survey.id]);

  // Auto-save notes with debounce
  const handleNotesChange = useCallback(
    (val) => {
      setNotes(val);
      setSaveStatus('saving');
      onNotesChange?.(val);

      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await updateSurveyNotes(survey.id, val);
          setSaveStatus('saved');
        } catch {
          setSaveStatus('error');
        }
      }, DEBOUNCE_MS_SAVE);

      // Pause clarification — only if notes are substantial
      if (val.trim().length > 60) {
        clearTimeout(clarifyTimer.current);
        clarifyTimer.current = setTimeout(() => triggerClarify(val), DEBOUNCE_MS_CLARIFY);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerClarify/onNotesChange are redefined each render; keyed on survey.id
    [survey.id]
  );

  const triggerClarify = async (currentNotes) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('survey-clarify', {
        body: { survey_id: survey.id, raw_notes: currentNotes },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data?.ask && res.data?.question) {
        setClarifyQ(res.data.question);
      }
    } catch {
      /* non-fatal — clarify is best-effort */
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadSurveyPhoto(survey.id, file);
      const row = await addSurveyMedia({ surveyId: survey.id, kind: 'photo', storagePath: path });
      const url = URL.createObjectURL(file);
      setMedia((prev) => [...prev, { ...row, _objectUrl: url }]);
      onPhotoAdded?.(row);
    } catch (err) {
      alert(`Photo upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteMedia = async (id) => {
    try {
      await deleteSurveyMedia(id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleStructure = async () => {
    if (notes.trim().length < 20) {
      alert('Add some site notes before structuring.');
      return;
    }
    setStructuring(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('survey-structure', {
        body: { survey_id: survey.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message ?? 'Structuring failed');
      onDone?.();
    } catch (err) {
      alert(`Structuring failed: ${err.message}`);
      setStructuring(false);
    }
  };

  const uncoveredItems = checklists.filter((c) => c.unrecoverable && !isCovered(c.label, notes));
  const coveredCount = checklists.length - uncoveredItems.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Customer header strip */}
      <div className="px-4 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.03)]">
        <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-0.5">
          Site
        </p>
        <p className="text-white font-bold">{survey.customers?.name ?? '—'}</p>
        {survey.customers?.address_line1 && (
          <p className="text-xs text-[rgba(153,197,255,0.6)]">
            {survey.customers.address_line1}
            {survey.customers.town ? `, ${survey.customers.town}` : ''}
          </p>
        )}
      </div>

      {/* Pause clarification bubble */}
      {clarifyQ && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold mt-0.5">
            ?
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-300 mb-0.5">Before you leave site</p>
            <p className="text-sm text-amber-200">{clarifyQ}</p>
          </div>
          <button
            onClick={() => setClarifyQ(null)}
            className="shrink-0 text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.8)] text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Raw notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)]">
            Site notes
          </p>
          <span
            className={`text-[10px] font-medium ${saveStatus === 'saving' ? 'text-amber-400' : saveStatus === 'error' ? 'text-red-400' : 'text-[rgba(153,197,255,0.35)]'}`}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save error' : 'Saved'}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={12}
          placeholder="Dump everything — access, surfaces, hazards, sizes, height, who's on site, how it smells. Don't format it. Cadi reads the mess."
          className="w-full rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(255,255,255,0.04)] text-white placeholder-[rgba(153,197,255,0.25)] text-sm px-4 py-3 resize-none focus:outline-none focus:border-[rgba(153,197,255,0.35)] leading-relaxed"
        />
        <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-1">
          {notes.length} characters · raw notes are never overwritten
        </p>
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)]">
            Photos
          </p>
          <label
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
              uploading
                ? 'border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.3)]'
                : 'border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.4)] hover:text-[#99c5ff]'
            }`}
          >
            {uploading ? 'Uploading…' : '+ Add photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="sr-only"
              disabled={uploading}
            />
          </label>
        </div>

        {media.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {media.map((m) => (
              <div
                key={m.id}
                className="relative group rounded-lg overflow-hidden aspect-square bg-white/5 border border-[rgba(153,197,255,0.12)]"
              >
                <PhotoThumb storagePath={m.storage_path} objectUrl={m._objectUrl} />
                <button
                  onClick={() => handleDeleteMedia(m.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/80 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[rgba(153,197,255,0.3)]">
            No photos yet — tap to add from camera or files
          </p>
        )}
      </div>

      {/* Checklist backstop */}
      {checklists.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)]">
              Still to confirm
            </p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                uncoveredItems.length === 0
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {uncoveredItems.length === 0 ? 'All covered' : `${uncoveredItems.length} remaining`}
            </span>
          </div>

          {uncoveredItems.length > 0 && (
            <div className="space-y-1.5">
              {uncoveredItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-[rgba(153,197,255,0.10)] bg-[rgba(255,255,255,0.02)] text-xs text-[rgba(153,197,255,0.55)]"
                >
                  <span className="mt-0.5 w-3 h-3 rounded-full border border-[rgba(153,197,255,0.2)] shrink-0" />
                  {item.label}
                </div>
              ))}
              {uncoveredItems.length > 8 && (
                <p className="text-[10px] text-[rgba(153,197,255,0.3)] pl-1">
                  +{uncoveredItems.length - 8} more…
                </p>
              )}
            </div>
          )}

          {uncoveredItems.length === 0 && coveredCount > 0 && (
            <p className="text-xs text-emerald-400">
              All {coveredCount} checklist items covered in your notes.
            </p>
          )}
        </div>
      )}

      {/* Structure button */}
      <div className="pt-2 border-t border-[rgba(153,197,255,0.08)]">
        {uncoveredItems.length > 0 && (
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-3">
            {uncoveredItems.length} checklist item{uncoveredItems.length !== 1 ? 's' : ''} still
            uncovered. You can continue — Cadi will flag them in the review.
          </p>
        )}
        <button
          onClick={handleStructure}
          disabled={structuring || notes.trim().length < 20}
          className="w-full h-12 rounded-xl bg-[#1f48ff] hover:bg-[#2a55ff] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          {structuring ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Cadi is reading your notes…
            </>
          ) : (
            'Structure my notes →'
          )}
        </button>
        <p className="text-[10px] text-[rgba(153,197,255,0.3)] text-center mt-2">
          Your raw notes are kept exactly as typed. Cadi proposes — you confirm.
        </p>
      </div>
    </div>
  );
}

// Lazy-load the signed URL for photos already in Storage
function PhotoThumb({ storagePath, objectUrl }) {
  const [url, setUrl] = useState(objectUrl ?? null);

  useEffect(() => {
    if (!url && storagePath) {
      supabase.storage
        .from('survey-media')
        .createSignedUrl(storagePath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setUrl(data.signedUrl);
        })
        .catch(() => {});
    }
  }, [storagePath, url]);

  if (!url) return <div className="w-full h-full bg-white/5 animate-pulse" />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}
