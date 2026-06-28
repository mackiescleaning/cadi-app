// PriceListImporter.jsx — point Cadi at a photo / website / paste, get a
// structured service menu back. Calls the extract-service-menu edge function.
// User reviews + edits prices before bulk-inserting via bulkCreateServices.

import { useState } from 'react';
import { X, Check, Upload, Link as LinkIcon, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { bulkCreateServices } from '../lib/db/servicesDb';
import { useEscapeKey } from '../hooks/useEscapeKey';

const TABS = [
  { key: 'image', label: 'Photo / image', icon: Upload },
  { key: 'url',   label: 'Website URL',   icon: LinkIcon },
  { key: 'text',  label: 'Paste text',    icon: FileText },
];

const CATEGORY_LABEL = { residential: 'Residential', exterior: 'Exterior', commercial: 'Commercial' };

function formatPriceLine(s) {
  if (s.pricing_type === 'hourly' && s.price_hourly_rate)  return `£${s.price_hourly_rate}/hr`;
  if (s.pricing_type === 'fixed'  && s.price_fixed_basic) {
    const tiers = [s.price_fixed_basic, s.price_fixed_standard, s.price_fixed_premium].filter(Boolean);
    return tiers.length > 1 ? `£${Math.min(...tiers)}–£${Math.max(...tiers)}` : `£${tiers[0]}`;
  }
  if (s.pricing_type === 'per_sqm'  && s.price_per_sqm)    return `£${s.price_per_sqm}/m²`;
  if (s.pricing_type === 'per_room' && s.price_per_room)   return `£${s.price_per_room}/room`;
  if (s.pricing_type === 'per_size' && s.pricing_matrix?.length) {
    const prices = s.pricing_matrix.map(r => r.price);
    return `£${Math.min(...prices)}–£${Math.max(...prices)}`;
  }
  return 'Custom';
}

export default function PriceListImporter({ onClose, onApplied }) {
  useEscapeKey(onClose);
  const [tab, setTab] = useState('image');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | extracting | review | applying
  const [drafts, setDrafts] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        const comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const extract = async () => {
    setError(null);
    setStatus('extracting');
    try {
      let body;
      if (tab === 'image') {
        if (!imageFile) { setError('Pick a photo first.'); setStatus('idle'); return; }
        const image_base64 = await fileToBase64(imageFile);
        body = { image_base64, image_mime: imageFile.type || 'image/jpeg' };
      } else if (tab === 'url') {
        if (!url.trim()) { setError('Paste a URL first.'); setStatus('idle'); return; }
        body = { url: url.trim() };
      } else {
        if (!text.trim()) { setError('Paste some text first.'); setStatus('idle'); return; }
        body = { text: text.trim() };
      }
      const { data, error: invokeError } = await supabase.functions.invoke('extract-service-menu', { body });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      const list = Array.isArray(data?.services) ? data.services : [];
      if (!list.length) {
        setError("Couldn't find any services. Try a clearer image or paste the text directly.");
        setStatus('idle');
        return;
      }
      setDrafts(list);
      setPicked(new Set(list.map((_, i) => i)));
      setStatus('review');
    } catch (err) {
      const msg = err?.message || 'Extraction failed';
      setError(msg.includes('ANTHROPIC_API_KEY') ? 'AI extraction isn\'t available yet — ANTHROPIC_API_KEY needs to be added to Supabase secrets.' : msg);
      setStatus('idle');
    }
  };

  const togglePick = (i) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const editDraft = (i, patch) => setDrafts(prev => prev.map((d, j) => j === i ? { ...d, ...patch } : d));

  const apply = async () => {
    setStatus('applying');
    setError(null);
    try {
      const chosen = drafts.filter((_, i) => picked.has(i));
      const created = await bulkCreateServices(chosen);
      onApplied?.({ count: created.length });
      onClose?.();
    } catch (err) {
      setError(err?.message ?? 'Could not save services.');
      setStatus('review');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-2 sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="plimp-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
          <X size={14} className="text-slate-600" />
        </button>

        <div className="p-5 border-b border-slate-100">
          <h2 id="plimp-title" className="text-lg font-black text-slate-900">Bring in your price list</h2>
          <p className="text-sm text-slate-500 mt-0.5">Snap a photo, paste a URL, or paste the text — Cadi reads it and builds your menu.</p>
        </div>

        {status !== 'review' && (
          <>
            <div className="flex border-b border-slate-100 bg-slate-50">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                    tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'image' && (
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Price list" className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        aria-label="Remove image"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => handleFile(e.target.files?.[0])}
                        className="hidden"
                      />
                      <Upload size={28} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-bold text-slate-700">Tap to snap or upload</p>
                      <p className="text-xs text-slate-500 mt-1">JPG, PNG, screenshot — anything with prices on it.</p>
                    </label>
                  )}
                </div>
              )}

              {tab === 'url' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Paste a page URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://yourcleaningsite.co.uk/prices"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400">Your own site, a competitor's, or a Squarespace/WordPress page. Cadi only reads visible text — no logins, no scrolling required.</p>
                </div>
              )}

              {tab === 'text' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Paste price list text</label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={9}
                    placeholder="Regular clean — £20/hr (min 2 hrs)\nDeep clean — £180 (2 bed) / £240 (3 bed) / £320 (4 bed+)\nOven clean — £65\n…"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                  />
                </div>
              )}

              {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 bg-slate-50/50">
              <button onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              <button
                onClick={extract}
                disabled={status === 'extracting'}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black shadow-sm"
              >
                {status === 'extracting' ? 'Reading…' : 'Extract services →'}
              </button>
            </div>
          </>
        )}

        {status === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs text-slate-500 mb-3">
                <span className="font-bold text-slate-700">{drafts.length}</span> service{drafts.length === 1 ? '' : 's'} found ·
                <span className="font-bold text-slate-700"> {picked.size}</span> picked. Edit anything that looks off — these go straight into your menu.
              </p>
              <ul className="space-y-2">
                {drafts.map((s, i) => {
                  const isPicked = picked.has(i);
                  return (
                    <li key={i} className={`rounded-xl border ${isPicked ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-white'} p-3`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isPicked}
                          onChange={() => togglePick(i)}
                          className="mt-1 w-4 h-4 rounded border-slate-300"
                          aria-label={`Include ${s.name}`}
                        />
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_8rem] gap-2">
                          <input
                            type="text"
                            value={s.name}
                            onChange={e => editDraft(i, { name: e.target.value })}
                            className="text-sm font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none"
                          />
                          <select
                            value={s.category}
                            onChange={e => editDraft(i, { category: e.target.value })}
                            className="text-[11px] text-slate-600 bg-transparent border border-slate-200 rounded-md px-2 py-0.5"
                          >
                            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <span className="text-xs font-black text-emerald-600 tabular-nums sm:text-right">{formatPriceLine(s)}</span>
                        </div>
                      </div>
                      {s.description_included && (
                        <p className="text-[11px] text-slate-500 mt-2 ml-7 leading-snug">{s.description_included}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {error && <p className="px-5 py-2 text-xs font-semibold text-red-600 bg-red-50 border-t border-red-200">{error}</p>}

            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 bg-slate-50/50">
              <button onClick={() => setStatus('idle')} className="text-xs font-semibold text-slate-500 hover:text-slate-700">← Start over</button>
              <button
                onClick={apply}
                disabled={!picked.size || status === 'applying'}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black shadow-sm flex items-center gap-2"
              >
                {status === 'applying' ? 'Adding…' : <><Check size={14} /> Add {picked.size} service{picked.size === 1 ? '' : 's'}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
