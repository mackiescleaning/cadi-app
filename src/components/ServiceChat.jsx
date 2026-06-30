// ServiceChat.jsx — conversational services builder
// Chat-bubble UI that replaces the service form. Cadi asks questions, user
// answers in plain English, structured data is extracted client-side and saved
// to the services table. Three contexts: first_setup, add_new, edit.

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { createService, updateService } from '../lib/db/servicesDb';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

// ── Microcopy ─────────────────────────────────────────────────────────────────

const ACKS = ['Got it.', 'Sorted.', 'Makes sense.', 'Nice.', 'Good one.'];
let _ackIdx = 0;
function ack() { return ACKS[_ackIdx++ % ACKS.length]; }

// ── Client-side parsing (structured extraction without AI) ────────────────────
// These implement the same interface as the Haiku prompts in the spec so they
// can be swapped for real API calls later without changing the step logic.

function extractGBP(text) {
  const m = text.match(/£\s*(\d+(?:\.\d{1,2})?)/i)
    || text.match(/(\d+(?:\.\d{1,2})?)\s*(?:pounds?|quid)\b/i);
  return m ? parseFloat(m[1]) : null;
}

function parsePricing(input) {
  const t = input.toLowerCase().trim();

  if (/\b(varies|vary|depends|depend|quote each|quote every|custom|bespoke|each job|case.by.case|i['']?ll quote|you tell me|not sure|no fixed)\b/.test(t)) {
    return { pricing_type: 'custom', confidence: 0.9, extracted_values: {}, follow_up_question: null };
  }

  if (/\b(per\s*(?:square\s*me?t(?:re|er)|sq\.?\s*m(?:e?t(?:re|er))?|m²|sqm)|\/\s*m²|per\s*sq)\b/.test(t)) {
    const rate = extractGBP(t);
    const minM = t.match(/min(?:imum)?\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
    return {
      pricing_type: 'per_sqm',
      confidence: rate ? 0.92 : 0.7,
      extracted_values: {
        ...(rate && { price_per_sqm: rate }),
        ...(minM && { price_per_sqm_minimum: parseFloat(minM[1]) }),
      },
      follow_up_question: rate ? null : 'What\'s your rate per square metre? For example, £2.50/m².',
    };
  }

  if (/\b(per\s*hour|an\s*hour|\/\s*hr|\/\s*hour|hourly|by\s*the\s*hour)\b/.test(t)) {
    const rate = extractGBP(t);
    const minHM = t.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)s?\s*min(?:imum)?/i)
      || t.match(/min(?:imum)?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
    const minHours = minHM ? parseFloat(minHM[1]) : null;
    return {
      pricing_type: 'hourly',
      confidence: rate ? 0.95 : 0.72,
      extracted_values: {
        ...(rate && { price_hourly_rate: rate }),
        ...(minHours && { price_hourly_minimum_hours: minHours }),
      },
      follow_up_question: rate ? null : 'What\'s your hourly rate? For example, £18/hour.',
    };
  }

  // Per bed / per size
  if (/\b(per\s*bed|by\s*(?:bed|size|bedroom|room)|1\s*bed|2\s*bed|3\s*bed|different\s*(?:prices?|rates?)[\s\w]*(?:for|per|by)|size|bedroom|pricing\s*matrix)\b/.test(t)) {
    const bedPrices = extractBedPrices(t);
    return {
      pricing_type: 'per_size',
      confidence: bedPrices.length ? 0.9 : 0.78,
      extracted_values: bedPrices.length ? { pricing_matrix: bedPrices } : {},
      follow_up_question: null,
    };
  }

  // Fixed price
  const price = extractGBP(t);
  if (price && /\b(per\s*job|flat|fixed|each|a\s*job|for\s*a|for\s*the|per\s*visit|per\s*clean)\b/.test(t)) {
    return {
      pricing_type: 'fixed',
      confidence: 0.9,
      extracted_values: { price_fixed_basic: price },
      follow_up_question: null,
    };
  }

  if (price) {
    return {
      pricing_type: 'fixed',
      confidence: 0.55,
      extracted_values: { price_fixed_basic: price },
      follow_up_question: `Are you saying £${price} per job as a fixed price, or £${price} per hour?`,
    };
  }

  return {
    pricing_type: 'custom',
    confidence: 0.25,
    extracted_values: {},
    follow_up_question: 'How do you usually price this — by the hour, a fixed price per job, or does it vary?',
  };
}

function extractBedPrices(text) {
  const t = text.toLowerCase();
  const SIZES = [
    { label: 'Studio', patterns: [/studio/i] },
    { label: '1 bed',  patterns: [/1\s*bed(?:room)?/i, /one\s*bed(?:room)?/i] },
    { label: '2 bed',  patterns: [/2\s*bed(?:room)?/i, /two\s*bed(?:room)?/i] },
    { label: '3 bed',  patterns: [/3\s*bed(?:room)?/i, /three\s*bed(?:room)?/i] },
    { label: '4 bed',  patterns: [/4\s*bed(?:room)?/i, /four\s*bed(?:room)?/i] },
    { label: '5 bed+', patterns: [/5\s*(?:bed(?:room)?|\+)/i, /five\s*bed(?:room)?/i] },
    { label: 'Small',  patterns: [/small\s*(?:office)?/i] },
    { label: 'Medium', patterns: [/medium\s*(?:office)?/i] },
    { label: 'Large',  patterns: [/large\s*(?:office)?/i] },
  ];

  const found = [];
  SIZES.forEach(({ label, patterns }) => {
    for (const pat of patterns) {
      // Look for price near this size label
      const match = t.match(new RegExp(pat.source + '[^\\d£]*£?\\s*(\\d+(?:\\.\\d{1,2})?)', 'i'));
      if (match) { found.push({ size_label: label, price: parseFloat(match[1]) }); break; }
    }
  });

  // Fallback: sequential prices → assign to 1-bed onwards
  if (!found.length) {
    const prices = [...t.matchAll(/£\s*(\d+(?:\.\d{1,2})?)/gi)].map(m => parseFloat(m[1]));
    if (prices.length >= 2) {
      const sizes = ['1 bed', '2 bed', '3 bed', '4 bed', '5 bed+'];
      prices.slice(0, 5).forEach((p, i) => found.push({ size_label: sizes[i], price: p }));
    }
  }

  return found;
}

function parseDuration(input) {
  const t = input.toLowerCase().trim();
  if (/\b(varies|vary|depends|depend|different|not sure|no idea|it depends)\b/.test(t)) {
    return { varies: true };
  }
  if (/half\s*(?:a\s*)?day/.test(t)) return { duration_value: 4, duration_unit: 'hours' };
  if (/(?:full|all)\s*(?:a\s*)?day/.test(t)) return { duration_value: 8, duration_unit: 'hours' };

  const rangeM = t.match(/(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
  if (rangeM) return { duration_value: parseFloat(rangeM[1]), range_max: parseFloat(rangeM[2]), duration_unit: 'hours', is_range: true };

  const hoursM = t.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
  if (hoursM) return { duration_value: parseFloat(hoursM[1]), duration_unit: 'hours' };

  const minM = t.match(/(\d+)\s*(?:min|minute)/i);
  if (minM) return { duration_value: parseInt(minM[1]), duration_unit: 'minutes' };

  const daysM = t.match(/(\d+(?:\.\d+)?)\s*day/i);
  if (daysM) return { duration_value: parseFloat(daysM[1]), duration_unit: 'days' };

  const justNum = t.match(/^(\d+(?:\.\d+)?)$/);
  if (justNum) return { duration_value: parseFloat(justNum[1]), duration_unit: 'hours' };

  return { varies: true };
}

function parseIncEx(input) {
  const lines = input.split(/[.,;\n]+/).map(s => s.trim()).filter(Boolean);
  const included = [], excluded = [];
  const NOT_RE = /\b(not\s+includ|don'?t\s+do|no\s+(?:oven|iron|carpet|outside|window|conserv)|doesn'?t\s+includ|not\s+cover|exclud|except)\b/i;
  const INC_RE = /\b(includ(?:es?|ing)|cover(?:s|ing)?|do\s+includ)\b/i;
  const NO_WORD_RE = /^(?:not|no|without)\s+/i;

  lines.forEach(line => {
    if (NOT_RE.test(line) || NO_WORD_RE.test(line)) {
      const item = line.replace(NOT_RE, '').replace(NO_WORD_RE, '').trim();
      if (item) excluded.push(item);
    } else if (INC_RE.test(line)) {
      const item = line.replace(INC_RE, '').trim();
      if (item) included.push(item);
    } else if (line) {
      included.push(line);
    }
  });

  return { included, excluded };
}

function parseFrequency(input) {
  const t = input.toLowerCase();
  const all = /\b(any|all|whatever|all\s*of\s*the\s*above|all\s*the\s*above|depends)\b/.test(t);
  return {
    frequency_one_off:     all || /\b(one.off|one\s*off|single|once|one\s*time)\b/.test(t),
    frequency_weekly:      all || /\b(weekly|every\s*week|each\s*week)\b/.test(t),
    frequency_fortnightly: all || /\b(fortnightly|every\s*two\s*weeks?|bi.?weekly)\b/.test(t),
    frequency_monthly:     all || /\b(monthly|every\s*month|4.?weekly|four.?weekly)\b/.test(t),
    frequency_quarterly:   /\b(quarterly|every\s*(three|3)\s*months?|every\s*quarter)\b/.test(t),
    frequency_annually:    /\b(annually|yearly|every\s*year|annual)\b/.test(t),
  };
}

function parseNoteCategory(input) {
  const t = input.toLowerCase();
  if (/\b(price|pricing|charge|rate|cost|discount|surcharge|markup|extra|add.?on)\b/.test(t))
    return 'pricing_notes';
  if (/\b(area|postcode|location|region|zone|cover|travel|radius|london)\b/.test(t))
    return 'service_area_custom';
  if (/\b(bring|supply|supplies|equipment|tools|chemicals|products|cloths|hoover|mop)\b/.test(t))
    return 'materials_equipment_notes';
  return 'private_notes';
}

// ── Haiku NLP helper (falls back to regex parsers above on any error) ─────────

async function callNlp(step, input) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-service-nlp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${session.access_token}`,
          apikey:         SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ step, input }),
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtPricing(c) {
  if (c.pricing_type === 'hourly') {
    let s = `£${c.price_hourly_rate}/hour`;
    if (c.price_hourly_minimum_hours) s += `, with a ${c.price_hourly_minimum_hours}-hour minimum`;
    return s;
  }
  if (c.pricing_type === 'fixed') return `£${c.price_fixed_basic} per job`;
  if (c.pricing_type === 'per_sqm') {
    let s = `£${c.price_per_sqm} per square metre`;
    if (c.price_per_sqm_minimum) s += `, minimum £${c.price_per_sqm_minimum}`;
    return s;
  }
  if (c.pricing_type === 'per_size') return 'different prices by size';
  if (c.pricing_type === 'custom')   return 'you quote each job';
  return '—';
}

function fmtDuration(d) {
  if (!d || d.varies) return 'varies';
  const unit = d.duration_unit === 'minutes' ? 'min' : d.duration_unit === 'days' ? 'day' : 'hour';
  const pl = (n) => n === 1 ? unit : `${unit}s`;
  if (d.is_range && d.range_max) return `${d.duration_value}–${d.range_max} ${pl(d.range_max)}`;
  return `${d.duration_value} ${pl(d.duration_value)}`;
}

function fmtFrequency(f) {
  if (!f) return '';
  const map = [
    ['frequency_weekly', 'weekly'], ['frequency_fortnightly', 'fortnightly'],
    ['frequency_monthly', 'monthly'], ['frequency_quarterly', 'quarterly'],
    ['frequency_annually', 'annually'], ['frequency_one_off', 'one-off'],
  ];
  const labels = map.filter(([k]) => f[k]).map(([, l]) => l);
  if (!labels.length) return 'one-off';
  if (labels.length === 1) return labels[0];
  return labels.slice(0, -1).join(', ') + ' or ' + labels.slice(-1)[0];
}

// ── Record builder ────────────────────────────────────────────────────────────

function toRecord(c) {
  const freq = c.frequency || { frequency_one_off: true };
  const dur   = c.duration  || {};
  return {
    name:       c.name,
    category:   c.category || 'residential',
    pricing_type: c.pricing_type || 'custom',
    pricing_matrix: c.pricing_type === 'per_size' ? (c.pricing_matrix || []) : null,
    price_hourly_rate:          c.price_hourly_rate          || null,
    price_hourly_minimum_hours: c.price_hourly_minimum_hours || null,
    price_fixed_basic:          c.price_fixed_basic          || null,
    price_per_sqm:              c.price_per_sqm              || null,
    price_per_sqm_minimum:      c.price_per_sqm_minimum      || null,
    pricing_notes:              c.pricing_notes              || null,
    duration_value:             dur.varies ? null : (dur.duration_value || null),
    duration_unit:              dur.duration_unit || 'hours',
    description_included:       c.description_included       || null,
    description_excluded:       c.description_excluded       || null,
    materials_equipment_notes:  c.materials_equipment_notes  || null,
    private_notes:              c.private_notes              || null,
    service_area_custom:        c.service_area_custom        || null,
    service_area_uses_default:  true,
    frequency_one_off:     !!freq.frequency_one_off,
    frequency_weekly:      !!freq.frequency_weekly,
    frequency_fortnightly: !!freq.frequency_fortnightly,
    frequency_monthly:     !!freq.frequency_monthly,
    frequency_quarterly:   !!freq.frequency_quarterly,
    frequency_annually:    !!freq.frequency_annually,
    is_active: true,
  };
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function CadiAvatar() {
  return (
    <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f48ff] text-[12px] font-extrabold text-white shadow-[0_0_12px_rgba(31,72,255,0.45)] select-none">
      C
    </div>
  );
}

function Bubble({ role, children }) {
  const base = 'max-w-[82%] rounded-[18px] px-4 py-3 text-sm leading-[1.65] whitespace-pre-line';
  return role === 'cadi'
    ? <div className={`${base} rounded-tl-sm bg-[#05124a] text-white border border-[rgba(153,197,255,0.12)]`}>{children}</div>
    : <div className={`${base} rounded-tr-sm bg-[#1f48ff] text-white`}>{children}</div>;
}

function QuickBtn({ onClick, children, secondary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 ${
        secondary
          ? 'border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.4)] hover:text-white'
          : 'border-[#4f78ff] bg-[#4f78ff] text-white hover:bg-[#3d68ff] shadow-[0_4px_16px_rgba(79,120,255,0.35)]'
      }`}
    >
      {children}
    </button>
  );
}

function CategoryBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all ${
        active
          ? 'border-[#4f78ff] bg-[#1f48ff]/20 text-white'
          : 'border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.6)] hover:border-[#4f78ff] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function ChatInput({ value, onChange, onSubmit, placeholder, disabled }) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !disabled) onSubmit(); }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 rounded-[10px] border border-[rgba(153,197,255,0.15)] bg-[#091660] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(153,197,255,0.3)] focus:border-[#99c5ff] focus:ring-2 focus:ring-[rgba(153,197,255,0.1)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="rounded-[10px] bg-[#1f48ff] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] transition hover:bg-[#3a5eff] disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}

function ConfirmCard({ title, rows, onEdit }) {
  return (
    <div className="rounded-xl border border-[rgba(153,197,255,0.18)] bg-[#091660] overflow-hidden">
      {title && <p className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.45)]">{title}</p>}
      <div className="divide-y divide-[rgba(153,197,255,0.08)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <span className="text-xs text-[rgba(153,197,255,0.5)] shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-white font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] transition border-t border-[rgba(153,197,255,0.08)] w-full">
          <Edit2 size={11} /> Edit
        </button>
      )}
    </div>
  );
}

// ── Step IDs ──────────────────────────────────────────────────────────────────

const S = {
  WELCOME:          'welcome',
  NAME:             'name',
  NAME_CLARIFY:     'name_clarify',
  CATEGORY:         'category',
  PRICING:          'pricing',
  PRICING_CLARIFY:  'pricing_clarify',
  PRICING_CONFIRM:  'pricing_confirm',
  PRICING_PERBED:   'pricing_perbed',
  PRICING_CUSTOM:   'pricing_custom',
  PRICING_EDIT:     'pricing_edit',
  DURATION:         'duration',
  INCLUSIONS:       'inclusions',
  FREQUENCY:        'frequency',
  NOTES:            'notes',
  NOTES_TEXT:       'notes_text',
  DONE:             'done',
};

const QUICK_DONE_AFTER = S.DURATION; // in quick mode, save after this step

// ── Main component ────────────────────────────────────────────────────────────

/**
 * ServiceChat
 *
 * Props:
 *   context           'first_setup' | 'add_new' | 'edit'
 *   onboardingServices  string[] — services named during onboarding (first_setup only)
 *   editService         object   — existing service record (edit only)
 *   editField           string   — 'pricing' | 'duration' | 'inclusions' | 'frequency' | 'notes' (edit only, scoped entry)
 *   onDone              fn(savedService?) — called when flow ends
 *   onUseForm           fn()    — called when user wants the form instead
 */
export default function ServiceChat({
  context = 'add_new',
  onboardingServices = [],
  editService = null,
  editField = null,
  onDone,
  onUseForm,
}) {
  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────

  const [messages,  setMessages]  = useState([]);
  const [step,      setStep]      = useState(null);
  const [collected, setCollected] = useState({});
  const [chatMode,  setChatMode]  = useState('quick');
  const [isTyping,  setIsTyping]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [textInput, setTextInput] = useState('');
  const [pendingFollowUp, setPendingFollowUp] = useState(null);
  const [bedPriceRows,    setBedPriceRows]    = useState([]);
  const [pendingBedPrices, setPendingBedPrices] = useState([]);
  const [pendingServices, setPendingServices]   = useState([]); // remaining from onboarding
  const [quickDoneShown,  setQuickDoneShown]   = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const patch = useCallback((fields) => setCollected(prev => ({ ...prev, ...fields })), []);

  function addMessage(role, text) {
    setMessages(prev => [...prev, { id: `${role}-${Date.now()}-${Math.random()}`, role, text }]);
  }

  function scrollDown() {
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 60);
  }

  // Cadi speaks with a typing delay
  function cadiSay(text, afterFn, delay = 700) {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addMessage('cadi', text);
      scrollDown();
      if (afterFn) afterFn();
    }, delay);
  }

  // User speaks + cadi responds
  function userReply(label, cadiResponse, nextStep, collectPatch, extraAfter) {
    addMessage('user', label);
    setTextInput('');
    if (collectPatch) patch(collectPatch);
    scrollDown();
    cadiSay(cadiResponse, () => {
      setStep(nextStep);
      if (extraAfter) extraAfter();
      scrollDown();
      setTimeout(() => inputRef.current?.focus(), 80);
    });
  }

  // Skip current step
  function skipStep(nextStep) {
    addMessage('user', 'Skip');
    setTextInput('');
    cadiSay('No worries, leaving that blank. Front Desk will work with what we\'ve got.', () => {
      setStep(nextStep);
      scrollDown();
    }, 400);
  }

  // ── Step navigation helpers ───────────────────────────────────────────────

  function nextAfterDuration(currentCollected) {
    if (chatMode === 'quick' && !quickDoneShown) {
      setQuickDoneShown(true);
      cadiSay(
        `Quickest version saved. Front Desk has enough to start quoting.\n\nWant to add more detail now, or leave it?`,
        () => setStep('quick_done'),
      );
    } else {
      cadiSay('Last few questions, then we\'re done.\n\nWhat\'s normally included in a ' + (currentCollected?.name || collected.name) + '? And what\'s NOT included that customers sometimes ask about? You can answer both together — I\'ll sort it out.', () => setStep(S.INCLUSIONS));
    }
  }

  function nextAfterInclusions() {
    cadiSay('How often do customers usually want this? Weekly, monthly, one-off?', () => setStep(S.FREQUENCY));
  }

  function nextAfterFrequency() {
    cadiSay(
      'That\'s the basics done. Anything else worth Front Desk knowing? Things like:\n— Adjustments to pricing in certain situations\n— Areas you do or don\'t cover for this service\n— What customers bring vs what you bring\n\nOr if not, we can save this and move on.',
      () => setStep(S.NOTES),
    );
  }

  function saveAndContinue(extraCollected) {
    const data = { ...collected, ...(extraCollected || {}) };
    setSaving(true);
    const record = toRecord(data);

    const doSave = editService?.id
      ? updateService(editService.id, record)
      : createService(record);

    doSave
      .then(() => {
        setSaving(false);
        const name = data.name;
        addMessage('cadi', `✓ ${name} is in your menu. Front Desk can quote it now.`);
        scrollDown();

        const remaining = pendingServices.filter(s => s !== name);
        setPendingServices(remaining);

        setTimeout(() => {
          if (context === 'edit') {
            onDone?.();
            return;
          }

          if (remaining.length) {
            const nextName = remaining[0];
            cadiSay(
              `Want to add another service? You mentioned ${nextName}, or you can add something different.`,
              () => setStep(S.DONE),
              400,
            );
          } else {
            cadiSay('All done for now. Head to your services menu whenever you want to add more.', () => setStep(S.DONE), 400);
          }
        }, 600);
      })
      .catch(() => {
        setSaving(false);
        addMessage('cadi', 'My fault — something didn\'t save. Want to try that answer again?');
        scrollDown();
      });
  }

  // ── Initialise conversation ───────────────────────────────────────────────

  useEffect(() => {
    if (context === 'edit' && editField) {
      // Scoped edit — jump straight to that field
      const initial = editService ? {
        name:     editService.name,
        category: editService.category,
        pricing_type: editService.pricing_type,
        price_hourly_rate: editService.price_hourly_rate,
        price_hourly_minimum_hours: editService.price_hourly_minimum_hours,
        price_fixed_basic: editService.price_fixed_basic,
        price_per_sqm: editService.price_per_sqm,
        price_per_sqm_minimum: editService.price_per_sqm_minimum,
        pricing_matrix: editService.pricing_matrix,
        pricing_notes: editService.pricing_notes,
        duration: editService.duration_value ? { duration_value: editService.duration_value, duration_unit: editService.duration_unit } : { varies: true },
        description_included: editService.description_included,
        description_excluded: editService.description_excluded,
        frequency: {
          frequency_one_off:     editService.frequency_one_off,
          frequency_weekly:      editService.frequency_weekly,
          frequency_fortnightly: editService.frequency_fortnightly,
          frequency_monthly:     editService.frequency_monthly,
          frequency_quarterly:   editService.frequency_quarterly,
          frequency_annually:    editService.frequency_annually,
        },
        private_notes: editService.private_notes,
        materials_equipment_notes: editService.materials_equipment_notes,
      } : {};
      setCollected(initial);

      const fieldMessages = {
        pricing:    `Editing pricing for *${editService?.name}*. How do you want to price this?`,
        duration:   `Editing duration for *${editService?.name}*. Roughly how long does this take you?`,
        inclusions: `Editing what's included and excluded for *${editService?.name}*. What's normally included, and what's not?`,
        frequency:  `Editing frequency for *${editService?.name}*. How often do customers usually want this?`,
        notes:      `Got any extra notes for *${editService?.name}* that Front Desk should know?`,
      };

      const fieldSteps = {
        pricing: S.PRICING, duration: S.DURATION, inclusions: S.INCLUSIONS,
        frequency: S.FREQUENCY, notes: S.NOTES,
      };

      cadiSay(fieldMessages[editField] || `Editing *${editService?.name}*.`, () => setStep(fieldSteps[editField] || S.PRICING), 400);
      return;
    }

    if (context === 'edit' && editService) {
      const initial = {
        name:     editService.name,
        category: editService.category,
      };
      setCollected(initial);
      cadiSay(
        `Editing *${editService.name}*. What do you want to change?`,
        () => setStep('edit_menu'),
        400,
      );
      return;
    }

    if (context === 'first_setup' && onboardingServices.length) {
      const first  = onboardingServices[0];
      const rest   = onboardingServices.slice(1);
      setPendingServices(rest);
      setCollected({ name: first });

      const listText = onboardingServices.length > 1
        ? `You mentioned a few services in onboarding: ${onboardingServices.join(', ')}. Want to start with ${first}?`
        : `Right, let's get your services properly set up so Front Desk can quote them.\n\nYou mentioned ${first} in onboarding. Want to start with that?`;

      cadiSay(
        `Right, let's get your services properly set up so Front Desk can quote them. I'll ask you about each one — just answer the way you would on the phone to a customer. We'll go quick.\n\n${listText}`,
        () => setStep(S.WELCOME),
        500,
      );
      return;
    }

    // add_new or first_setup with no onboarding services
    cadiSay(
      context === 'first_setup'
        ? 'Let\'s build your services menu. What\'s the first service you want to add?'
        : 'Let\'s add a service. What\'s it called? Use the name your customers would use.',
      () => setStep(S.NAME),
      500,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input handlers per step ───────────────────────────────────────────────

  // Step: NAME
  function handleName() {
    const val = textInput.trim();
    if (!val) return;
    const tooVague = val.length < 4 || /^cleaning$/i.test(val);
    if (tooVague) {
      addMessage('user', val);
      setTextInput('');
      cadiSay(`Got it — '${val}'. Anything more specific? Like 'weekly clean' or 'one-off deep clean'?`, () => setStep(S.NAME_CLARIFY));
      return;
    }
    userReply(val, `Got it — *${val}*. Is this residential, exterior, or commercial?`, S.CATEGORY, { name: val });
  }

  // Step: NAME_CLARIFY (already nudged, accept whatever they say now)
  function handleNameClarify() {
    const val = textInput.trim();
    if (!val) return;
    userReply(val, `Got it — *${val}*. Is this residential, exterior, or commercial?`, S.CATEGORY, { name: val });
  }

  // Step: CATEGORY (button choices, no text input)
  function handleCategory(cat) {
    const labels = { residential: 'Residential', exterior: 'Exterior', commercial: 'Commercial' };
    const label = labels[cat];
    patch({ category: cat });
    addMessage('user', label);
    const name = collected.name;
    cadiSay(`How do you usually price a ${name}? Tell me how you'd explain it to a customer — by the hour, by the size of the place, fixed price, however you naturally do it.`, () => setStep(S.PRICING));
  }

  // Step: PRICING (free text)
  async function handlePricing(inputOverride) {
    const val = (inputOverride || textInput).trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    setIsTyping(true);
    const nlp = await callNlp('pricing', val);
    setIsTyping(false);
    const parsed = nlp ?? parsePricing(val);

    if (parsed.confidence < 0.7) {
      setPendingFollowUp(parsed.follow_up_question);
      cadiSay(`I want to make sure I get this right — ${parsed.follow_up_question}`, () => setStep(S.PRICING_CLARIFY));
      return;
    }

    if (parsed.pricing_type === 'custom') {
      patch({ pricing_type: 'custom' });
      cadiSay(`Got it — you quote each job. That works fine. When customers ask through Front Desk, I'll gather the details and flag it for you to quote. Sound good?`, () => setStep(S.PRICING_CUSTOM));
      return;
    }

    if (parsed.pricing_type === 'per_size') {
      if (parsed.extracted_values.pricing_matrix?.length) {
        // Full per-bed data extracted
        patch({ pricing_type: 'per_size', pricing_matrix: parsed.extracted_values.pricing_matrix });
        showPricingConfirm(parsed);
      } else {
        patch({ pricing_type: 'per_size' });
        cadiSay(`Got it — you price by size. Tell me what you charge for each — just type them out, like '£40 for 1 bed, £50 for 2 bed'.`, () => setStep(S.PRICING_PERBED));
      }
      return;
    }

    // Hourly, fixed, per_sqm — show confirmation
    patch({ pricing_type: parsed.pricing_type, ...parsed.extracted_values });
    showPricingConfirm(parsed);
  }

  // Step: PRICING_CLARIFY (follow-up after low confidence)
  async function handlePricingClarify() {
    const val = textInput.trim();
    if (!val) return;
    await handlePricing(val); // re-parse with clarified input
  }

  function showPricingConfirm(parsed) {
    const summary = fmtPricing({ pricing_type: parsed.pricing_type, ...parsed.extracted_values, ...collected });
    setPendingFollowUp(summary);
    const pricingType = parsed.pricing_type;
    let confirmText = `Got it — ${summary}. Does that look right?`;
    if (pricingType === 'per_size' && parsed.extracted_values.pricing_matrix) {
      const matrix = parsed.extracted_values.pricing_matrix;
      confirmText = `Got it — ${summary}:\n${matrix.map(r => `  ${r.size_label}: £${r.price}`).join('\n')}\n\nLook right?`;
    }
    cadiSay(confirmText, () => setStep(S.PRICING_CONFIRM));
  }

  // Step: PRICING_PERBED (ask for each size price)
  function handlePricingPerBed() {
    const val = textInput.trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    const rows = extractBedPrices(val);
    if (!rows.length) {
      cadiSay('Hmm, I didn\'t quite catch that. Try something like: "1 bed £45, 2 bed £60, 3 bed £80"', () => setStep(S.PRICING_PERBED));
      return;
    }
    setBedPriceRows(rows);
    patch({ pricing_matrix: rows });
    const summary = rows.map(r => `${r.size_label}: £${r.price}`).join('\n');
    cadiSay(`Got it. Here's what I've captured:\n${summary}\n\nLook right?`, () => setStep('pricing_perbed_confirm'));
  }

  // Step: PRICING_CUSTOM (buttons)
  function handlePricingCustom(answer) {
    if (answer === 'perfect') {
      addMessage('user', 'Perfect');
      cadiSay(`Roughly how long does a ${collected.name} take you? A range is fine.`, () => setStep(S.DURATION));
    } else {
      addMessage('user', 'Let me give you a rough idea');
      cadiSay(`How do you usually price a ${collected.name}?`, () => setStep(S.PRICING));
    }
  }

  // Step: DURATION (free text)
  async function handleDuration() {
    const val = textInput.trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    setIsTyping(true);
    const nlp = await callNlp('duration', val);
    setIsTyping(false);
    const dur = nlp ?? parseDuration(val);
    patch({ duration: dur });
    const summary = dur.varies ? 'duration varies — I\'ll ask the customer details to estimate per job.' : `about ${fmtDuration(dur)}.`;
    const confirmText = `${ack()} ${dur.is_range ? 'Between' : 'About'} ${fmtDuration(dur)}.`;
    cadiSay(confirmText, () => nextAfterDuration({ ...collected, duration: dur }));
  }

  // Step: INCLUSIONS (free text)
  async function handleInclusions() {
    const val = textInput.trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    setIsTyping(true);
    const nlp = await callNlp('inclusions', val);
    setIsTyping(false);
    const { included, excluded } = nlp ?? parseIncEx(val);
    const desc_inc = included.join(', ') || null;
    const desc_exc = excluded.join(', ') || null;
    patch({ description_included: desc_inc, description_excluded: desc_exc });

    let confirmText = 'Got it.\n\n';
    if (included.length) confirmText += `**Included:** ${included.join(', ')}\n`;
    if (excluded.length) confirmText += `**Not included:** ${excluded.join(', ')}\n`;
    confirmText += '\nAnything to add or change?';

    cadiSay(confirmText, () => setStep('inclusions_confirm'));
  }

  // Step: FREQUENCY (free text)
  async function handleFrequency() {
    const val = textInput.trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    setIsTyping(true);
    const nlp = await callNlp('frequency', val);
    setIsTyping(false);
    const freq = nlp ?? parseFrequency(val);
    // Ensure at least one is set
    if (!Object.values(freq).some(Boolean)) freq.frequency_one_off = true;
    patch({ frequency: freq });
    cadiSay(`${ack()} ${fmtFrequency(freq)}.`, () => nextAfterFrequency());
  }

  // Step: NOTES_TEXT (free text)
  async function handleNotesText() {
    const val = textInput.trim();
    if (!val) return;
    addMessage('user', val);
    setTextInput('');
    setIsTyping(true);
    const nlp = await callNlp('notes_category', val);
    setIsTyping(false);
    const category = nlp?.category ?? parseNoteCategory(val);
    const noteLabels = {
      pricing_notes: 'pricing note',
      service_area_custom: 'service area note',
      materials_equipment_notes: 'materials note',
      private_notes: 'private note',
    };
    patch({ [category]: val });
    cadiSay(`Got it — saved that as a ${noteLabels[category]} for Front Desk to use when quoting.`, () => setStep('notes_saved'));
  }

  // ── Render input area by step ─────────────────────────────────────────────

  function renderInput() {
    if (isTyping || !step) return null;

    // ── Welcome buttons (first_setup with onboarding services)
    if (step === S.WELCOME) {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => {
            addMessage('user', "Let's go");
            cadiSay(`How do you usually price a ${collected.name}? Tell me how you'd explain it to a customer — by the hour, by the size of the place, fixed price, however you naturally do it.`, () => setStep(S.PRICING));
          }}>Let's go</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Start somewhere else');
            cadiSay('Which service do you want to start with?', () => setStep(S.NAME));
          }}>Start somewhere else</QuickBtn>
        </div>
      );
    }

    // ── Name input
    if (step === S.NAME) {
      return <ChatInput ref={inputRef} value={textInput} onChange={setTextInput} onSubmit={handleName} placeholder="e.g. Weekly clean, Gutter clearance…" />;
    }
    if (step === S.NAME_CLARIFY) {
      return <ChatInput value={textInput} onChange={setTextInput} onSubmit={handleNameClarify} placeholder="e.g. Weekly domestic clean…" />;
    }

    // ── Category buttons
    if (step === S.CATEGORY) {
      return (
        <div className="flex gap-2">
          {['Residential', 'Exterior', 'Commercial'].map(label => (
            <CategoryBtn key={label} label={label} active={collected.category === label.toLowerCase()} onClick={() => handleCategory(label.toLowerCase())} />
          ))}
        </div>
      );
    }

    // ── Pricing free text
    if (step === S.PRICING) {
      const ph = {
        residential: 'e.g. "£18 an hour, 3 hour minimum" or "£45 for a standard job"',
        exterior:    'e.g. "£2.50 per m²" or "£40 flat for gutters"',
        commercial:  'e.g. "depends on the job" or "£22/hour, min 2 hours"',
      }[collected.category] || 'e.g. "£18/hour" or "£45 per job"';
      return (
        <div className="space-y-2">
          <ChatInput value={textInput} onChange={setTextInput} onSubmit={() => handlePricing()} placeholder={ph} />
          <p className="text-xs text-[rgba(153,197,255,0.35)] px-1">Answer naturally — I'll sort out the details.</p>
        </div>
      );
    }

    if (step === S.PRICING_CLARIFY) {
      return <ChatInput value={textInput} onChange={setTextInput} onSubmit={handlePricingClarify} placeholder="Clarify your pricing…" />;
    }

    // ── Pricing confirm (branches A / per_size)
    if (step === S.PRICING_CONFIRM) {
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <QuickBtn onClick={() => {
              addMessage('user', 'Yes, that\'s right');
              cadiSay(`Roughly how long does a ${collected.name} take you? A range is fine.`, () => setStep(S.DURATION));
            }}>Yes, that's right</QuickBtn>
            <QuickBtn secondary onClick={() => {
              addMessage('user', 'Not quite');
              cadiSay('No problem — how do you price it?', () => setStep(S.PRICING));
            }}>Not quite</QuickBtn>
          </div>
        </div>
      );
    }

    // ── Per-bed breakdown
    if (step === S.PRICING_PERBED) {
      return (
        <div className="space-y-2">
          <ChatInput value={textInput} onChange={setTextInput} onSubmit={handlePricingPerBed} placeholder="e.g. 1 bed £40, 2 bed £55, 3 bed £70…" />
          <p className="text-xs text-[rgba(153,197,255,0.35)] px-1">List each size and price together.</p>
        </div>
      );
    }

    if (step === 'pricing_perbed_confirm') {
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <QuickBtn onClick={() => {
              addMessage('user', 'Yes');
              cadiSay(`Roughly how long does a ${collected.name} take you?`, () => setStep(S.DURATION));
            }}>Yes</QuickBtn>
            <QuickBtn secondary onClick={() => {
              addMessage('user', 'Edit something');
              cadiSay('Go ahead — give me the full list again and I\'ll replace what I have.', () => setStep(S.PRICING_PERBED));
            }}>Edit something</QuickBtn>
            <QuickBtn secondary onClick={() => {
              addMessage('user', 'Add another size');
              cadiSay('What size and price?', () => setStep('pricing_perbed_addrow'));
            }}>Add another size</QuickBtn>
          </div>
        </div>
      );
    }

    // Add single row to per-bed matrix
    if (step === 'pricing_perbed_addrow') {
      return <ChatInput value={textInput} onChange={setTextInput} onSubmit={() => {
        const val = textInput.trim();
        if (!val) return;
        addMessage('user', val);
        setTextInput('');
        const newRows = extractBedPrices(val);
        if (newRows.length) {
          const combined = [...(collected.pricing_matrix || bedPriceRows), ...newRows];
          patch({ pricing_matrix: combined });
          setBedPriceRows(combined);
          cadiSay(`Added. Anything else to add?`, () => setStep('pricing_perbed_addrow'), 400);
        } else {
          cadiSay('Sorry, I didn\'t catch that. Try "4 bed £90".', () => setStep('pricing_perbed_addrow'), 400);
        }
      }} placeholder="e.g. 5 bed+ £120" />;
    }

    // ── Custom pricing acknowledgement
    if (step === S.PRICING_CUSTOM) {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => handlePricingCustom('perfect')}>Perfect</QuickBtn>
          <QuickBtn secondary onClick={() => handlePricingCustom('rough_idea')}>Actually let me give you a rough idea</QuickBtn>
        </div>
      );
    }

    // ── Duration
    if (step === S.DURATION) {
      return (
        <div className="space-y-2">
          <ChatInput value={textInput} onChange={setTextInput} onSubmit={handleDuration} placeholder="e.g. 2–3 hours, half a day…" />
          <button type="button" onClick={() => {
            patch({ duration: { varies: true } });
            skipStep(chatMode === 'quick' ? 'quick_check' : S.INCLUSIONS);
          }} className="text-xs text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)] px-1 transition">Skip</button>
        </div>
      );
    }

    // ── Quick mode: done or continue
    if (step === 'quick_done') {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => {
            addMessage('user', 'Add more detail');
            cadiSay(`What's normally included in a ${collected.name}? And what's NOT included?`, () => {
              setChatMode('thorough');
              setStep(S.INCLUSIONS);
            });
          }}>Add more detail</QuickBtn>
          <QuickBtn secondary onClick={() => saveAndContinue()}>Leave it for now</QuickBtn>
        </div>
      );
    }

    // ── Inclusions
    if (step === S.INCLUSIONS) {
      const ph = {
        residential: 'e.g. "Hoovering, dusting, kitchen and bathrooms. Not ovens or ironing."',
        exterior:    'e.g. "Includes outside glass and frames. Not inside or roof."',
        commercial:  'e.g. "Desks, kitchens, bathrooms, bins, floors. Carpet cleaning is extra."',
      }[collected.category] || 'What\'s included and what\'s not…';
      return (
        <div className="space-y-2">
          <ChatInput value={textInput} onChange={setTextInput} onSubmit={handleInclusions} placeholder={ph} />
          <button type="button" onClick={() => {
            addMessage('user', 'Skip');
            addMessage('cadi', 'No worries — I\'ll let Front Desk handle scope on this one.');
            nextAfterInclusions();
          }} className="text-xs text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)] px-1 transition">Skip</button>
        </div>
      );
    }

    // ── Inclusions confirm (yes / edit)
    if (step === 'inclusions_confirm') {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => {
            addMessage('user', 'Looks right');
            nextAfterInclusions();
          }}>Looks right</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Add more');
            cadiSay('Go ahead — what else?', () => setStep(S.INCLUSIONS));
          }}>Add more</QuickBtn>
        </div>
      );
    }

    // ── Frequency
    if (step === S.FREQUENCY) {
      return (
        <div className="space-y-2">
          <ChatInput value={textInput} onChange={setTextInput} onSubmit={handleFrequency} placeholder="e.g. Weekly or fortnightly / always one-off…" />
          <button type="button" onClick={() => {
            patch({ frequency: { frequency_one_off: true } });
            skipStep(S.NOTES);
          }} className="text-xs text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)] px-1 transition">Skip</button>
        </div>
      );
    }

    // ── Notes / anything else
    if (step === S.NOTES) {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => {
            addMessage('user', 'All done, save it');
            saveAndContinue();
          }}>All done, save it</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Yes, add a note');
            cadiSay('What\'s the note?', () => setStep(S.NOTES_TEXT));
          }}>Yes, add a note</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Skip for now');
            addMessage('cadi', 'No worries — notes saved blank.');
            saveAndContinue();
          }}>Skip for now</QuickBtn>
        </div>
      );
    }

    if (step === S.NOTES_TEXT) {
      return <ChatInput value={textInput} onChange={setTextInput} onSubmit={handleNotesText} placeholder="e.g. Add £15 for parking in central London…" />;
    }

    if (step === 'notes_saved') {
      return (
        <div className="flex gap-2 flex-wrap">
          <QuickBtn onClick={() => {
            addMessage('user', 'All done, save it');
            saveAndContinue();
          }}>All done, save it</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Add another note');
            cadiSay('What else?', () => setStep(S.NOTES_TEXT));
          }}>Add another note</QuickBtn>
        </div>
      );
    }

    // ── Edit menu (generic edit entry — what do you want to change?)
    if (step === 'edit_menu') {
      const fields = [
        { label: 'Pricing',              field: 'pricing',    step: S.PRICING },
        { label: 'Duration',             field: 'duration',   step: S.DURATION },
        { label: 'What\'s included / excluded', field: 'inclusions', step: S.INCLUSIONS },
        { label: 'Frequency',            field: 'frequency',  step: S.FREQUENCY },
        { label: 'Notes',                field: 'notes',      step: S.NOTES },
      ];
      return (
        <div className="flex flex-col gap-2">
          {fields.map(f => (
            <button
              key={f.field}
              type="button"
              onClick={() => {
                addMessage('user', f.label);
                const q = {
                  pricing:    `How do you want to price ${collected.name}?`,
                  duration:   `How long does a ${collected.name} take?`,
                  inclusions: `What's included and not included in a ${collected.name}?`,
                  frequency:  'How often do customers usually want this?',
                  notes:      'What\'s the note?',
                }[f.field];
                cadiSay(q, () => setStep(f.step));
              }}
              className="text-left px-4 py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] text-sm text-[rgba(153,197,255,0.8)] hover:border-[#4f78ff] hover:text-white transition"
            >
              {f.label}
            </button>
          ))}
        </div>
      );
    }

    // ── Done — next service prompt
    if (step === S.DONE) {
      const nextName = pendingServices[0];
      return (
        <div className="flex gap-2 flex-wrap">
          {nextName && (
            <QuickBtn onClick={() => {
              addMessage('user', `Add ${nextName}`);
              setCollected({ name: nextName });
              cadiSay(`How do you usually price a ${nextName}?`, () => setStep(S.PRICING));
            }}>Add {nextName}</QuickBtn>
          )}
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'Add a different service');
            setCollected({});
            cadiSay('What\'s the service called?', () => setStep(S.NAME));
          }}>Add a different service</QuickBtn>
          <QuickBtn secondary onClick={() => {
            addMessage('user', 'I\'m done for now');
            const rem = pendingServices;
            if (rem.length) {
              addMessage('cadi', `All saved. You've still got ${rem.join(', ')} to add when you're ready — they're waiting on your menu page.`);
            }
            setTimeout(() => onDone?.(), 800);
          }}>I'm done for now</QuickBtn>
        </div>
      );
    }

    return null;
  }

  // ── Step progress indicator ───────────────────────────────────────────────

  const QUICK_STEPS_ORDER  = [S.NAME, S.CATEGORY, S.PRICING, S.DURATION];
  const THOROUGH_STEPS_ORDER = [S.NAME, S.CATEGORY, S.PRICING, S.DURATION, S.INCLUSIONS, S.FREQUENCY, S.NOTES];

  function stepProgress() {
    const order = chatMode === 'thorough' ? THOROUGH_STEPS_ORDER : QUICK_STEPS_ORDER;
    const idx   = order.indexOf(step);
    if (idx < 0) return null;
    return { current: idx + 1, total: order.length };
  }

  const progress = stepProgress();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.15)] overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.12)] shrink-0">
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <button
              type="button"
              onClick={() => setChatMode(m => m === 'quick' ? 'thorough' : 'quick')}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.06)] px-3 py-1 text-[11px] text-[rgba(153,197,255,0.6)] hover:text-[#99c5ff] transition"
            >
              {chatMode === 'quick'
                ? <><ToggleLeft size={13} /> Quick mode</>
                : <><ToggleRight size={13} className="text-[#4f78ff]" /> Thorough mode</>
              }
            </button>
            {/* Progress */}
            {progress && (
              <span className="text-[10px] text-[rgba(153,197,255,0.4)]">Step {progress.current} of {progress.total}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onUseForm && (
              <button onClick={onUseForm} className="text-xs text-[rgba(153,197,255,0.4)] hover:text-[#99c5ff] transition">
                Use form instead
              </button>
            )}
            <button onClick={() => onDone?.()} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* AI disclosure — required at point of processing per Privacy Policy */}
        <p className="relative px-5 pt-3 text-[10px] text-[rgba(153,197,255,0.4)] shrink-0">
          Cadi uses AI (Anthropic) to help build your service menu. Your answers aren't trained on. <a href="/privacy#ai" target="_blank" rel="noopener noreferrer" className="text-[rgba(153,197,255,0.6)] hover:text-white underline">Read more</a>
        </p>

        {/* Chat feed */}
        <div
          ref={chatRef}
          className="relative flex-1 overflow-y-auto space-y-4 px-5 py-5"
          style={{ scrollbarWidth: 'thin' }}
        >
          <style>{`
            @keyframes bubbleIn { from { opacity:0;transform:translateY(8px); } to { opacity:1;transform:translateY(0); } }
            .sc-bubble { animation: bubbleIn 0.28s ease forwards; }
            @keyframes dotBlink { 0%,80%,100%{opacity:0.25}40%{opacity:1} }
          `}</style>

          {messages.map(msg => (
            <div key={msg.id} className={`sc-bubble flex ${msg.role === 'cadi' ? 'justify-start' : 'justify-end'}`}>
              {msg.role === 'cadi' && <CadiAvatar />}
              <Bubble role={msg.role}>{msg.text}</Bubble>
            </div>
          ))}

          {isTyping && (
            <div className="sc-bubble flex justify-start">
              <CadiAvatar />
              <div className="rounded-[18px] rounded-tl-sm border border-[rgba(153,197,255,0.12)] bg-[#05124a] px-4 py-3">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <span key={i} className="h-2 w-2 rounded-full bg-[rgba(153,197,255,0.55)]"
                      style={{ animation: `dotBlink 1.2s ease ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input panel */}
        {!isTyping && step && (
          <div className="relative px-5 py-4 border-t border-[rgba(153,197,255,0.12)] shrink-0">
            <div className="sc-bubble">
              {renderInput()}
            </div>
            {saving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-b-2xl">
                <div className="w-5 h-5 rounded-full border-2 border-[#4f78ff] border-t-transparent animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
