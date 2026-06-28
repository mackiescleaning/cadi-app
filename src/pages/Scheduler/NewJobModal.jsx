// src/pages/Scheduler/NewJobModal.jsx
// Extracted from Scheduler.jsx. Wrapped in <ModalShell> and uses <Button>.

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import ModalShell from "../../components/ui/ModalShell";
import Button from "../../components/ui/Button";
import { getCatalogue, quotePrice } from "../../lib/catalogue";
import {
  isoDate,
  addDaysToDate,
  buildProfileServiceOptions,
} from "./helpers";

const DEFAULT_STAFF_OPTIONS = [
  { id: "you",        label: "You" },
  { id: "unassigned", label: "Unassigned" },
];

const SERVICE_OPTIONS = {
  residential: ["Regular clean","Deep clean","End of tenancy","One-off clean","Carpet clean","Oven clean","Spring clean","Post-renovation clean"],
  commercial:  ["Regular office clean","Deep commercial clean","Contract clean","Washroom sanitise","Kitchen sanitise","Event clean","Builder's clean","Carpet extraction"],
  exterior:    ["Window clean","Gutter clean","Roof moss treatment","Driveway pressure wash","Fascias & soffits","Render wash","Conservatory roof","Solar panel clean","Patio jet wash"],
};

const RECURRENCE_OPTIONS = [
  { id: "none",        label: "One-off",        group: "all" },
  { id: "daily",       label: "Daily",          group: "res-com" },
  { id: "weekly",      label: "Weekly",         group: "res-com" },
  { id: "fortnightly", label: "Fortnightly",    group: "res-com" },
  { id: "monthly",     label: "Monthly",        group: "res-com" },
  { id: "quarterly",   label: "Quarterly",      group: "res-com" },
  { id: "6weekly",     label: "Every 6 weeks",  group: "exterior" },
  { id: "8weekly",     label: "Every 8 weeks",  group: "exterior" },
  { id: "12weekly",    label: "Every 12 weeks", group: "exterior" },
];

export default function NewJobModal({ onClose, onSave, onUpdate, editJob, preCustomer = "", customers = [], defaultDate }) {
  const { profile } = useAuth();
  const profileServices = buildProfileServiceOptions(profile);

  const hourToTime = (h) => {
    const hours = Math.floor(h ?? 9);
    const mins  = Math.round(((h ?? 9) - hours) * 60);
    return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  };

  const initAssignees = () => {
    if (editJob?.assigneeIds?.length > 0) return editJob.assigneeIds;
    if (editJob?.status === 'unassigned') return ['unassigned'];
    if (editJob) return ['you'];
    return ['you'];
  };

  const [staffOptions, setStaffOptions] = useState(DEFAULT_STAFF_OPTIONS);
  useEffect(() => {
    import('../../lib/supabase').then(({ supabase }) => {
      supabase.from('team_members')
        .select('id, first_name, last_name, work_pattern')
        .eq('is_active', true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const dbStaff = data.map(s => ({
              id: s.id,
              label: [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || 'Unnamed',
              work_pattern: s.work_pattern ?? null,
            }));
            setStaffOptions([{ id: "you", label: "You" }, ...dbStaff, { id: "unassigned", label: "Unassigned" }]);
          }
        }).catch(() => {});
    }).catch(() => {});
  }, []);

  const [customer,     setCustomer]     = useState(editJob?.customer     ?? preCustomer);
  // Resolved customers.id when the user picks from the autocomplete list.
  // Lets the saved job link directly to a customer row instead of relying on
  // a string match (which breaks on rename/typo and produces orphan jobs).
  const [customerId,   setCustomerId]   = useState(editJob?.customerId    ?? null);
  const [addressLine1, setAddressLine1] = useState(editJob?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(editJob?.addressLine2 ?? "");
  const [town,         setTown]         = useState(editJob?.town         ?? "");
  const [postcode,     setPostcode]     = useState(editJob?.postcode     ?? "");
  const [date,         setDate]         = useState(editJob?.date         ?? defaultDate ?? isoDate(new Date()));
  const [startTime,    setStartTime]    = useState(editJob ? hourToTime(editJob.startHour) : "09:00");
  const [jobType,      setJobType]      = useState(editJob?.type         ?? "residential");
  const [service,      setService]      = useState(editJob?.service      ?? "");
  const [durationHrs,  setDuration]     = useState(editJob ? String(editJob.durationHrs) : "2");
  const [price,        setPrice]        = useState(editJob ? String(editJob.price)       : "");
  const [assignees,    setAssignees]    = useState(initAssignees);
  const [recurrence,   setRecurrence]   = useState(editJob?.recurrence   ?? "fortnightly");
  const [notes,        setNotes]        = useState(editJob?.notes        ?? "");
  const [customService,setCustomService]= useState("");
  const [serviceMode,  setServiceMode]  = useState("quick");

  // ── Catalogue-aware service picker ────────────────────────────────────
  // Loads the live catalogue on mount so the service dropdown reads from
  // the same source of truth as the Front Desk widget, public menu and
  // monthly reports. Falls back gracefully when the catalogue is empty.
  const [catalogue, setCatalogue] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedTierKey,   setSelectedTierKey]   = useState(null);
  const [selectedModKeys,   setSelectedModKeys]   = useState([]);
  // Track manual overrides so auto-fill from quotePrice doesn't clobber
  // a price/duration the owner has tweaked by hand.
  const [priceEditedByUser,    setPriceEditedByUser]    = useState(Boolean(editJob));
  const [durationEditedByUser, setDurationEditedByUser] = useState(Boolean(editJob));

  useEffect(() => {
    getCatalogue()
      .then(c => setCatalogue(c))
      .catch(() => setCatalogue({ services: [], business: { divisions: [] } }));
  }, []);

  const selectedService = useMemo(() => {
    if (!catalogue?.services || !selectedServiceId) return null;
    return catalogue.services.find(s => s.id === selectedServiceId) ?? null;
  }, [catalogue, selectedServiceId]);

  // Re-run quotePrice + duration auto-fill whenever the catalogue selection
  // changes. Owner can still override either field manually — once they
  // type, we set the *EditedByUser flag and stop auto-overwriting.
  useEffect(() => {
    if (!selectedService) return;
    const { price: quoted } = quotePrice(selectedService, {
      tier_key:  selectedTierKey || undefined,
      modifiers: selectedModKeys,
    });
    if (!priceEditedByUser && quoted !== 'enquiry') {
      setPrice(String(quoted));
    } else if (!priceEditedByUser && quoted === 'enquiry' && selectedTierKey) {
      // Enquiry-mode service with a tier picked — seed the input with the
      // tier price as a starting point so Cadi can still learn from what the
      // owner actually charges. Owner can override before saving.
      const tier = selectedService.tiers?.find(t => t.key === selectedTierKey);
      if (tier && Number.isFinite(Number(tier.price))) setPrice(String(tier.price));
    }
    if (!durationEditedByUser && selectedService.duration_mins != null) {
      setDuration(String((selectedService.duration_mins / 60).toFixed(2)));
    }
    // Mirror service label + division onto the existing free-text fields so
    // downstream code (which still reads from `service` / `jobType`) keeps
    // working unchanged.
    const tierLabel = selectedTierKey
      ? selectedService.tiers?.find(t => t.key === selectedTierKey)?.label
      : null;
    setService(tierLabel ? `${selectedService.name} — ${tierLabel}` : selectedService.name);
    if (selectedService.division) setJobType(selectedService.division);
  }, [selectedService, selectedTierKey, selectedModKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group catalogue services by division for the dropdown's <optgroup>s.
  const servicesByDivision = useMemo(() => {
    const map = new Map();
    for (const s of (catalogue?.services ?? [])) {
      const k = s.division || 'other';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return map;
  }, [catalogue]);

  const handleTypeChange = (t) => {
    setJobType(t);
    setService("");
    if (t === "exterior")        setRecurrence("8weekly");
    else if (t === "commercial") setRecurrence("weekly");
    else                         setRecurrence("fortnightly");
    if (t === "exterior") setDuration("0.33");
    else setDuration("2");
  };

  const recurrenceOpts = RECURRENCE_OPTIONS.filter(r =>
    r.group === "all" ||
    (r.group === "exterior" && jobType === "exterior") ||
    (r.group === "res-com"  && jobType !== "exterior") ||
    (jobType === "exterior" && ["weekly", "fortnightly", "monthly"].includes(r.id))
  );

  const selectedRec  = RECURRENCE_OPTIONS.find(r => r.id === recurrence);
  const profileList  = profileServices?.[jobType];
  const services     = (profileList && profileList.length > 0) ? profileList : (SERVICE_OPTIONS[jobType] ?? []);
  const usingProfile = !!(profileList && profileList.length > 0);
  const valid        = customer && date && startTime && service && parseFloat(price) > 0;

  const toggleAssignee = (id) => {
    if (id === "unassigned") { setAssignees(["unassigned"]); return; }
    setAssignees(prev => {
      const withoutUnassigned = prev.filter(v => v !== "unassigned");
      if (withoutUnassigned.includes(id)) {
        const next = withoutUnassigned.filter(v => v !== id);
        return next.length > 0 ? next : ["unassigned"];
      }
      return [...withoutUnassigned, id];
    });
  };

  const nextDateStr = () => {
    const map = { "6weekly":42, "8weekly":56, "12weekly":84, weekly:7, fortnightly:14, monthly:30, quarterly:91, daily:1 };
    const days = map[recurrence];
    return days ? addDaysToDate(date, days) : null;
  };

  const handleSave = () => {
    if (!valid) return;
    const [h, m] = startTime.split(":").map(Number);
    const startHour = h + m / 60;
    const selectedOptions = staffOptions
      .filter(s => assignees.includes(s.id) && s.id !== "unassigned");
    const selectedStaff = selectedOptions.map(s => s.label);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const selectedStaffIds = selectedOptions
      .map(s => s.id)
      .filter(id => UUID_RE.test(id));

    if (editJob) {
      const newStatus = selectedStaff.length === 0
        ? "unassigned"
        : editJob.status === 'unassigned' ? "scheduled" : editJob.status;
      onUpdate?.(editJob.id, {
        customer, postcode, date,
        start_hour: startHour,
        duration_hrs: parseFloat(durationHrs) || 2,
        type: jobType, service,
        price: parseFloat(price),
        assignee_ids: selectedStaffIds,
        assignees: selectedStaff,
        assignee: selectedStaff.length > 0 ? selectedStaff.join(", ") : null,
        recurrence, notes,
        status: newStatus,
        // Preserve the customer link if the user didn't change it. null on
        // free-text edits so we don't strand a stale id behind a new name.
        customer_id: customerId ?? null,
      });
      onClose();
      return;
    }

    const baseJob = {
      customer, customerId, addressLine1, addressLine2, town, postcode, startHour,
      durationHrs: parseFloat(durationHrs) || 2,
      type: jobType, service,
      price: parseFloat(price),
      assignee_ids: selectedStaffIds,
      assignees: selectedStaff,
      assignee: selectedStaff.length > 0 ? selectedStaff.join(", ") : null,
      recurrence, notes,
      status: selectedStaff.length === 0 ? "unassigned" : "scheduled",
    };

    // crypto.randomUUID() — collision-free even when two users create jobs
    // in the same millisecond. The DB regenerates a real UUID on insert
    // either way, but these temp IDs are used as React keys and for
    // optimistic-update reconciliation in DataContext, so they need to be
    // unique within a single client tick.
    onSave?.({ ...baseJob, id: crypto.randomUUID(), date });

    if (recurrence !== "none") {
      const dayMap = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 91, "6weekly": 42, "8weekly": 56, "12weekly": 84 };
      const interval = dayMap[recurrence];
      if (interval) {
        let [ry, rm, rd] = date.split('-').map(Number);
        for (let i = 0; i < 11; i++) {
          rd += interval;
          const next = new Date(ry, rm - 1, rd);
          onSave?.({ ...baseJob, id: crypto.randomUUID(), date: isoDate(next) });
        }
      }
    }

    onClose();
  };

  const FL = ({ children }) => (
    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500 mb-1.5">{children}</label>
  );
  const inp = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors";
  const chip = (active) =>
    `px-2.5 py-1.5 text-xs font-bold border rounded-lg transition-all ${
      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
    }`;

  const durationOpts = jobType === "exterior"
    ? ["0.33","0.67","1","1.5","2","3","4"]
    : ["0.5","1","1.5","2","2.5","3","4","5","6"];
  const durLabel = (h) => {
    if (h === "0.33") return "20m";
    if (h === "0.67") return "40m";
    if (h === "0.5")  return "30m";
    return `${h}h`;
  };

  const title    = editJob ? 'Edit Job' : 'Add New Job';
  const subtitle = !editJob && recurrence !== "none" && selectedRec ? `${selectedRec.label} · recurring` : undefined;

  const footer = (
    <div className="flex gap-2">
      <Button variant="primary" onClick={handleSave} disabled={!valid} className="flex-1 uppercase tracking-wide">
        {editJob ? "Save changes" : recurrence === "none" ? "Save job" : "Save & schedule recurring"}
      </Button>
      <Button variant="ghost" onClick={onClose} className="px-5 uppercase">
        Cancel
      </Button>
    </div>
  );

  return (
    <ModalShell open onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      <div className="p-5 space-y-4">
        <div>
          <FL>Job type</FL>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "residential", label: "Residential" },
              { id: "commercial",  label: "Commercial" },
              { id: "exterior",    label: "Exterior" },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => handleTypeChange(id)} className={chip(jobType === id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FL>Service</FL>
          {/* Catalogue-aware picker. Grouped by division. Reads from the
              same getCatalogue() that the Front Desk widget / public menu
              / reports all use — one source of truth. Owner can pick
              "Custom" to fall back to free text for one-offs. */}
          {(catalogue?.services?.length ?? 0) > 0 ? (
            <>
              <select
                value={selectedServiceId ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '__custom') {
                    setSelectedServiceId(null);
                    setSelectedTierKey(null);
                    setSelectedModKeys([]);
                    setServiceMode('custom');
                    setService('');
                  } else {
                    setSelectedServiceId(v || null);
                    setSelectedTierKey(null);
                    setSelectedModKeys([]);
                    setServiceMode('quick');
                  }
                }}
                className={inp}
              >
                <option value="">Choose a service…</option>
                {Array.from(servicesByDivision.entries()).map(([div, list]) => (
                  <optgroup key={div} label={div.charAt(0).toUpperCase() + div.slice(1)}>
                    {list.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom">+ Custom service (type my own)</option>
              </select>

              {/* Tier picker — only for pricing_model='tiered' services */}
              {selectedService?.pricing_model === 'tiered' && (selectedService.tiers?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <FL>Tier</FL>
                  <select
                    value={selectedTierKey ?? ''}
                    onChange={e => setSelectedTierKey(e.target.value || null)}
                    className={inp}
                  >
                    <option value="">Pick a tier…</option>
                    {selectedService.tiers.map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label} — £{Number(t.price).toFixed(2)}{t.is_default ? '  (most common)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modifier checkboxes — first-clean surcharge, conservatory etc. */}
              {(selectedService?.modifiers?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-1.5">
                  <FL>Add-ons</FL>
                  {selectedService.modifiers.map(m => {
                    const checked = selectedModKeys.includes(m.key);
                    const sign = m.type === 'discount' ? '−£' : (m.type === 'addon_percent' ? '+' : '+£');
                    const valLabel = m.type === 'addon_percent' ? `${m.value}%` : Number(m.value).toFixed(2);
                    return (
                      <label key={m.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedModKeys(curr =>
                            curr.includes(m.key) ? curr.filter(k => k !== m.key) : [...curr, m.key]
                          )}
                        />
                        <span className="flex-1">{m.label}</span>
                        <span className="font-mono text-emerald-700 font-semibold">{sign}{valLabel}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Enquiry-mode hint — wording adapts to whether a tier has been
                  picked so the message never contradicts the visible tier price. */}
              {selectedService?.booking_mode === 'enquiry' && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                  {selectedTierKey
                    ? 'Tier price is a starting point — adjust below to what you actually agreed. Cadi learns from the real number.'
                    : 'This service is set to enquiry only — pick a tier above as a starting point, or type the agreed price below.'}
                </p>
              )}

              {/* Custom-service fallback */}
              {serviceMode === 'custom' && (
                <input
                  type="text"
                  value={customService}
                  onChange={e => { setCustomService(e.target.value); setService(e.target.value); }}
                  placeholder="Type your service name…"
                  className={`${inp} mt-2`}
                />
              )}
            </>
          ) : (
            /* No catalogue yet — fall back to the legacy quick-pick / custom
                modes so the modal still works pre-onboarding. */
            <>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-2">
                {['quick','custom'].map(mode => (
                  <button key={mode}
                    onClick={() => { setServiceMode(mode); setService(''); setCustomService(''); }}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                      serviceMode === mode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                    }`}>
                    {mode === 'quick' ? (usingProfile ? '✓ Your Services' : 'Quick Pick') : '+ Custom'}
                  </button>
                ))}
              </div>
              {serviceMode === 'quick' ? (
                <div className="flex flex-wrap gap-1.5">
                  {services.map(s => (
                    <button key={s} onClick={() => setService(s)} className={chip(service === s)}>{s}</button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={customService}
                  onChange={e => { setCustomService(e.target.value); setService(e.target.value); }}
                  placeholder="Type your service name…"
                  className={inp}
                />
              )}
            </>
          )}
        </div>

        <div>
          <FL>Customer name</FL>
          <div className="relative">
            <input
              type="text"
              value={customer}
              // Typing a fresh name detaches any previously-resolved customer
              // link so we don't keep a stale customerId tied to a name the
              // user has since edited.
              onChange={e => { setCustomer(e.target.value); setCustomerId(null); }}
              placeholder="e.g. Mrs Davies"
              className={inp}
            />
            {customer.length > 0 && customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xl">
                {customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).slice(0, 5).map(c => (
                  <button key={c.id} type="button"
                    onClick={() => {
                      setCustomer(c.name);
                      setCustomerId(c.id);
                      setAddressLine1(c.address_line1 || "");
                      setAddressLine2(c.address_line2 || "");
                      setTown(c.town || "");
                      setPostcode(c.postcode || "");
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                    <span className="font-semibold">{c.name}</span>
                    {(c.address_line1 || c.postcode) && <span className="ml-2 text-slate-500 text-xs">{[c.address_line1, c.town, c.postcode].filter(Boolean).join(', ')}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <FL>Address</FL>
          <input type="text" value={addressLine1} onChange={e=>setAddressLine1(e.target.value)}
            placeholder="12 High Street" className={`${inp} mb-2`} />
          <input type="text" value={addressLine2} onChange={e=>setAddressLine2(e.target.value)}
            placeholder="Flat / building (optional)" className={`${inp} mb-2`} />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={town} onChange={e=>setTown(e.target.value)}
              placeholder="Town / City" className={inp} />
            <input type="text" value={postcode} onChange={e=>setPostcode(e.target.value.toUpperCase())}
              placeholder="Postcode" className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FL>Date</FL>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp} />
          </div>
          <div>
            <FL>Start time</FL>
            <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FL>Duration</FL>
            <div className="flex flex-wrap gap-1.5">
              {durationOpts.map(h => (
                <button key={h} onClick={() => { setDuration(h); setDurationEditedByUser(true); }} className={chip(durationHrs === h)}>
                  {durLabel(h)}
                </button>
              ))}
            </div>
            {jobType === "exterior" && (
              <p className="text-[10.5px] text-slate-500 mt-1.5">Exterior jobs support 20-min minimum blocks.</p>
            )}
          </div>
          <div>
            <FL>Price (£)</FL>
            <input type="number" min="0" step="5" value={price} onChange={e=>{ setPrice(e.target.value); setPriceEditedByUser(true); }} placeholder="e.g. 65" className={inp} />
            {parseFloat(price)>0 && parseFloat(durationHrs)>0 && (
              <p className="text-xs text-slate-500 mt-1">£{(parseFloat(price)/parseFloat(durationHrs)).toFixed(0)}/hr</p>
            )}
          </div>
        </div>

        <div>
          <FL>Assign to</FL>
          <div className="grid grid-cols-4 gap-2">
            {staffOptions.map(s => {
              const isSelected = assignees.includes(s.id);
              const isOffDay = (() => {
                if (!s.work_pattern || !date || s.id === 'you' || s.id === 'unassigned') return false;
                const dow   = new Date(date + 'T12:00:00').getDay();
                const entry = s.work_pattern[String(dow)];
                return !entry;
              })();
              return (
                <button key={s.id} onClick={() => toggleAssignee(s.id)}
                  className={`${chip(isSelected)} flex flex-col items-center gap-0.5`}>
                  <span>{s.label}</span>
                  {isOffDay && !isSelected && (
                    <span className="text-[8px] font-bold text-amber-500 leading-none">Off</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FL>Schedule / recurrence</FL>
          <div className="flex flex-wrap gap-1.5">
            {recurrenceOpts.map(r => (
              <button key={r.id} onClick={() => setRecurrence(r.id)} className={chip(recurrence === r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          {recurrence !== "none" && (
            <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-semibold text-slate-900">
                {selectedRec?.label} · {editJob ? 'frequency updated on save' : 'next job auto-scheduled'}
              </p>
              {!editJob && nextDateStr() && (
                <p className="text-xs text-slate-500 mt-0.5">Next occurrence: {nextDateStr()}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <FL>Notes / access details</FL>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
            placeholder="Key code, parking, pets, access instructions…"
            className={`${inp} resize-none`} />
        </div>
      </div>
    </ModalShell>
  );
}
