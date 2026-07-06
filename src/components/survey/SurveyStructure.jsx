/**
 * SurveyStructure.jsx
 * Phase 2 — desk review: Cadi's proposed structure, pricing helper, quote builder.
 *
 * Props:
 *   survey      — site_surveys row
 *   structured  — survey_structured row (Cadi's proposal)
 *   onConfirm   — (quoteData) => void  (advances to 'quoted' status)
 *   onBack      — () => void
 */

import { useState, useEffect } from 'react';
import {
  saveSurveyStructured,
  confirmSurveyStructured,
  listComparables,
  createCommercialQuote,
} from '../../lib/db/surveyDb';
import { updateSurveyStatus } from '../../lib/db/surveyDb';

function Card({ title, children, action }) {
  return (
    <div className="rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(153,197,255,0.08)]">
        <p className="text-xs font-bold text-[rgba(153,197,255,0.7)]">{title}</p>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function EditableText({ value, onChange, placeholder = '—', multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    const props = {
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      autoFocus: true,
      className:
        'w-full bg-[rgba(255,255,255,0.06)] text-white text-sm px-2 py-1 rounded border border-[rgba(153,197,255,0.25)] focus:outline-none resize-none',
    };
    return multiline ? <textarea {...props} rows={3} /> : <input {...props} />;
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left text-sm text-white hover:text-[#99c5ff] transition-colors group w-full"
    >
      {value || <span className="text-[rgba(153,197,255,0.3)]">{placeholder}</span>}
      <span className="ml-1.5 text-[10px] text-[rgba(153,197,255,0.3)] group-hover:text-[rgba(153,197,255,0.6)]">
        edit
      </span>
    </button>
  );
}

export default function SurveyStructure({
  survey,
  structured: initialStructured,
  onConfirm,
  onBack,
}) {
  const [s, setS] = useState(
    initialStructured ?? {
      services: [],
      site_variables: {},
      hazards: {},
      height: {},
      open_questions: [],
    }
  );
  const [price, setPrice] = useState('');
  const [frequency, setFrequency] = useState('one_off');
  const [comparables, setComparables] = useState([]);
  const [showComps, setShowComps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstVisit, setFirstVisit] = useState('');

  useEffect(() => {
    if (s.service_tags?.length > 0) {
      listComparables({ serviceTags: s.service_tags, involvesHeight: s.involves_height ?? null })
        .then(setComparables)
        .catch(() => {});
    } else {
      listComparables()
        .then((rows) => setComparables(rows.slice(0, 10)))
        .catch(() => {});
    }
  }, [s.service_tags, s.involves_height]);

  const updateField = (path, value) => {
    setS((prev) => {
      const next = { ...prev };
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!price || isNaN(parseFloat(price))) {
      alert('Enter a price before confirming.');
      return;
    }
    setSaving(true);
    try {
      // Save confirmed structure
      await saveSurveyStructured(survey.id, { ...s, confirmed: true });
      await confirmSurveyStructured(survey.id);

      // Build cleaning plan
      const cleaningPlan = {
        type: frequency === 'one_off' ? 'one_off' : 'contract',
        services: s.services ?? [],
        schedule: { frequency, first_visit: firstVisit || null },
        assigned_crew: [],
      };

      // Create quote
      const quote = await createCommercialQuote({
        customerId: survey.customer_id,
        surveyId: survey.id,
        price: parseFloat(price),
        services: s.services,
        cleaningPlan,
        segment: 'commercial',
      });

      // Advance survey status
      await updateSurveyStatus(survey.id, 'quoted');

      onConfirm?.({ quote, structured: { ...s, confirmed: true } });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const sv = s.site_variables ?? {};
  const hz = s.hazards ?? {};
  const ht = s.height ?? {};
  const oq = s.open_questions ?? [];

  const compStats =
    comparables.length > 0
      ? {
          min: Math.min(...comparables.map((c) => c.final_price)),
          max: Math.max(...comparables.map((c) => c.final_price)),
          avg: Math.round(comparables.reduce((a, c) => a + c.final_price, 0) / comparables.length),
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] transition-colors w-fit"
      >
        ← Back to notes
      </button>

      {/* Open questions */}
      {oq.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <p className="text-xs font-bold text-amber-400 mb-2">Cadi's unresolved questions</p>
          <ul className="space-y-1.5">
            {oq.map((q, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-200/80">
                <span className="shrink-0 text-amber-500">·</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Services */}
      <Card title="Services proposed">
        {(s.services ?? []).length > 0 ? (
          <div className="space-y-2">
            {s.services.map((svc, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-[rgba(153,197,255,0.06)] last:border-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{svc.name}</p>
                  <p className="text-xs text-[rgba(153,197,255,0.5)]">{svc.frequency ?? '—'}</p>
                  {svc.notes && (
                    <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">{svc.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[rgba(153,197,255,0.4)]">
            No services proposed — review raw notes.
          </p>
        )}
      </Card>

      {/* Site variables */}
      <Card title="Site conditions">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          {[
            { key: 'access', label: 'Access' },
            { key: 'keyholding', label: 'Keyholding' },
            { key: 'hours_in', label: 'Start time' },
            { key: 'hours_out', label: 'Finish time' },
            { key: 'parking', label: 'Parking' },
            { key: 'welfare', label: 'Welfare' },
            { key: 'signoff_contact', label: 'Sign-off contact' },
          ].map(({ key, label }) => (
            <div key={key}>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-0.5">{label}</p>
              <EditableText
                value={sv[key]}
                placeholder="not noted"
                onChange={(v) => updateField(`site_variables.${key}`, v)}
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(sv.lone_working_flag)}
                onChange={(e) => updateField('site_variables.lone_working_flag', e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-[rgba(153,197,255,0.7)]">
                Lone-working flag (out-of-hours scope)
              </span>
            </label>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(sv.induction_required)}
                onChange={(e) => updateField('site_variables.induction_required', e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-[rgba(153,197,255,0.7)]">Site induction required</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Hazards */}
      {(hz.fragile_surfaces ||
        hz.anchor_points ||
        hz.exclusion_zone ||
        hz.runoff_drainage ||
        hz.chemical_restrictions ||
        hz.other?.length > 0) && (
        <Card title="Hazards noted">
          <div className="space-y-2 text-xs">
            {[
              { key: 'fragile_surfaces', label: 'Fragile surfaces' },
              { key: 'anchor_points', label: 'Anchor points' },
              { key: 'exclusion_zone', label: 'Exclusion zone' },
              { key: 'runoff_drainage', label: 'Run-off / drainage' },
              { key: 'chemical_restrictions', label: 'Chemical restrictions' },
            ]
              .filter(({ key }) => hz[key])
              .map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-0.5">{label}</p>
                  <EditableText
                    value={hz[key]}
                    onChange={(v) => updateField(`hazards.${key}`, v)}
                    multiline
                  />
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Height (Reg 6) */}
      {ht.involves_height && (
        <Card title="Working at height — Reg 6">
          <div className="space-y-2 text-xs">
            {[
              { key: 'proposed_method', label: 'Method agreed' },
              { key: 'avoid_ground_level_first', label: 'Ground-level option considered?' },
              {
                key: 'collective_before_personal',
                label: 'Collective protection (MEWP/tower) considered?',
              },
              { key: 'ladders_justification', label: 'If ladders: short-duration justification' },
            ].map(({ key, label }) => (
              <div key={key}>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-0.5">{label}</p>
                <EditableText
                  value={ht[key]}
                  placeholder="not recorded"
                  onChange={(v) => updateField(`height.${key}`, v)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pricing */}
      <Card
        title="Price"
        action={
          comparables.length > 0 && (
            <button
              onClick={() => setShowComps((v) => !v)}
              className="text-[10px] font-bold text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] transition-colors"
            >
              {showComps ? 'Hide' : 'Help me price this'}
            </button>
          )
        }
      >
        {showComps && compStats && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(31,72,255,0.08)] border border-[rgba(31,72,255,0.2)]">
            <p className="text-xs font-bold text-[#99c5ff] mb-2">
              From your job history ({comparables.length} comparable
              {comparables.length !== 1 ? 's' : ''})
            </p>
            <div className="flex gap-4">
              <div>
                <p className="text-[10px] text-[rgba(153,197,255,0.5)]">Range</p>
                <p className="text-sm font-bold text-white">
                  £{compStats.min} – £{compStats.max}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[rgba(153,197,255,0.5)]">Average</p>
                <p className="text-sm font-bold text-white">£{compStats.avg}</p>
              </div>
            </div>
            <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-2">
              Starting point from your history — you set the number.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-white font-bold text-lg">£</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent text-white text-xl font-bold placeholder-[rgba(153,197,255,0.2)] focus:outline-none border-b border-[rgba(153,197,255,0.2)] focus:border-[rgba(153,197,255,0.5)] pb-1"
            />
          </div>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(153,197,255,0.15)] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="one_off">One-off</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="four_weekly">4-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-1">
            First visit date (optional)
          </p>
          <input
            type="date"
            value={firstVisit}
            onChange={(e) => setFirstVisit(e.target.value)}
            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(153,197,255,0.15)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
          />
        </div>
      </Card>

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={saving || !price}
        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving quote…
          </>
        ) : (
          'Confirm structure and create quote →'
        )}
      </button>
    </div>
  );
}
