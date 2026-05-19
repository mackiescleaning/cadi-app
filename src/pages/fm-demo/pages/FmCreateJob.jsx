import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import clients from '../mock/clients.json';
import sites   from '../mock/sites.json';

// ─── constants ────────────────────────────────────────────────────────────────

const SERVICES    = ['Retail morning clean','Daily office clean','Evening clean','Deep clean','Hospital clean','School clean','Industrial clean','Window clean','Washroom service','Carpet clean','End of tenancy'];
const FREQUENCIES = ['Mon–Fri daily','Mon–Sat daily','Daily (7 days)','3× per week','Weekly','Fortnightly','Monthly','One-off'];
const SLA_WINDOWS = ['05:00–07:00','06:00–08:00','06:30–08:30','07:00–09:00','07:30–08:30','08:00–10:00','17:00–19:00','18:00–20:00'];
const PHOTO_REQS  = ['Before & after (standard)','After only','Before, after & sign-off','None required'];
const DBS_OPTS    = ['Enhanced DBS','Standard DBS','Basic DBS','None required'];
const PAYMENT_TERMS = ['14 days','30 days','45 days','60 days'];
const NOTICE_PERIODS = ['1 month','2 months','3 months','6 months'];
const CONTRACT_TYPES = [
  { id: 'new',       label: 'New contract',      desc: 'First-time agreement with this client' },
  { id: 'renewal',   label: 'Renewal',           desc: 'Renewing an existing contract' },
  { id: 'extension', label: 'Extension',         desc: 'Adding sites or scope to existing contract' },
  { id: 'oneoff',    label: 'One-off job',        desc: 'Single job, no ongoing commitment' },
];

const SECTOR_EMOJI = { Retail: '🛍️', Healthcare: '🏥', Government: '🏛️', Education: '🎓', Hospitality: '🏨', Industrial: '🏭' };

const glass  = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };
const input  = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', borderRadius: '0.75rem', padding: '0.625rem 1rem', fontSize: '0.875rem', width: '100%', outline: 'none' };
const lbl    = { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.375rem' };

const STEPS = ['Contract & client','Sites & schedule','SLA & compliance','Pricing & terms'];

// helper: visits/month from frequency string
function visitsPerMonth(freq) {
  if (freq.includes('7 days'))    return 30;
  if (freq.includes('Mon–Sat'))   return 26;
  if (freq.includes('Mon–Fri'))   return 22;
  if (freq.includes('3×'))        return 13;
  if (freq === 'Weekly')          return 4;
  if (freq === 'Fortnightly')     return 2;
  if (freq === 'Monthly')         return 1;
  if (freq === 'One-off')         return 1;
  return 4;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-[#4f78ff] text-white ring-4 ring-[#4f78ff]/20' :
                         'text-white/30'
              }`} style={done || active ? {} : { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <div className={`text-[10px] font-bold text-center leading-tight ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-white/30'}`}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-1 mb-5" style={{ background: i < current ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionHead({ title }) {
  return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1rem' }}>{title}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function SiteConfigCard({ site, config, onChange, onRemove }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors">
        <span className="text-lg">{SECTOR_EMOJI[site.type] || '🏢'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm truncate">{site.name}</div>
          <div className="text-white/35 text-xs truncate">{site.address} · {site.postcode}</div>
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-white/20 hover:text-red-400 transition-colors p-1 mr-1">
          <X size={14} />
        </button>
        {open ? <ChevronUp size={14} className="text-white/30 shrink-0" /> : <ChevronDown size={14} className="text-white/30 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-2 gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Field label="Service type">
            <select value={config.service || ''} onChange={e => onChange({ service: e.target.value })} style={{ ...input, appearance: 'none' }}>
              <option value="">Select…</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Frequency">
            <select value={config.frequency || 'Mon–Fri daily'} onChange={e => onChange({ frequency: e.target.value })} style={{ ...input, appearance: 'none' }}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Start time window">
            <input type="text" placeholder="e.g. 06:00–08:00" value={config.timeWindow || ''} onChange={e => onChange({ timeWindow: e.target.value })} style={input} />
          </Field>
          <Field label="SLA window">
            <select value={config.slaWindow || ''} onChange={e => onChange({ slaWindow: e.target.value })} style={{ ...input, appearance: 'none' }}>
              <option value="">Select…</option>
              {SLA_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Access instructions / site notes">
              <textarea value={config.notes || ''} onChange={e => onChange({ notes: e.target.value })}
                placeholder="Key codes, contact on site, parking, security requirements…"
                rows={2} style={{ ...input, resize: 'none' }} className="placeholder-white/20" />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function FmCreateJob({ showToast }) {
  const [step, setStep] = useState(0);
  const [published, setPublished] = useState(false);
  const [contractRef] = useState(`#BF-CTR-${Math.floor(1000 + Math.random() * 9000)}`);

  // form state
  const [basics, setBasics] = useState({
    name: '', clientId: '', contractType: 'new',
    startDate: '2026-06-01', ongoing: true, endDate: '', noticePeriod: '3 months',
    accountManager: 'James Morris',
  });
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [siteConfigs, setSiteConfigs]         = useState({});
  const [compliance, setCompliance]           = useState({
    photosRequired: 'Before & after (standard)',
    gpsRequired: true, checkInRequired: true, signOffRequired: false,
    dbs: 'Enhanced DBS', minOperatives: '1',
    riskAssessment: true, coshh: true, methodStatement: true,
    issueResponseHours: '24',
  });
  const [pricing, setPricing] = useState({
    rates: {}, billingFrequency: 'Monthly', paymentTerms: '30 days', vatRegistered: true,
  });

  function patchBasics(p)     { setBasics(prev => ({ ...prev, ...p })); }
  function patchCompliance(p) { setCompliance(prev => ({ ...prev, ...p })); }
  function patchPricing(p)    { setPricing(prev => ({ ...prev, ...p })); }
  function patchRate(siteId, val) { setPricing(prev => ({ ...prev, rates: { ...prev.rates, [siteId]: val } })); }
  function patchSiteConfig(siteId, p) { setSiteConfigs(prev => ({ ...prev, [siteId]: { ...(prev[siteId] || {}), ...p } })); }

  const clientObj     = clients.find(c => c.id === basics.clientId);
  const availSites    = sites.filter(s => s.clientId === basics.clientId);
  const chosenSites   = availSites.filter(s => selectedSiteIds.includes(s.id));

  // auto-generate contract name when client changes
  function handleClientChange(clientId) {
    const cl = clients.find(c => c.id === clientId);
    patchBasics({ clientId, name: cl ? `${cl.name} — Cleaning Contract` : '' });
    setSelectedSiteIds([]);
    setSiteConfigs({});
  }

  function toggleSite(siteId) {
    setSelectedSiteIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  }

  // live contract value calc
  const monthlyTotal = chosenSites.reduce((sum, site) => {
    const rate  = parseFloat(pricing.rates[site.id] || 0);
    const cfg   = siteConfigs[site.id] || {};
    const freq  = cfg.frequency || 'Mon–Fri daily';
    return sum + rate * visitsPerMonth(freq);
  }, 0);
  const annualTotal = monthlyTotal * 12;

  const step1Valid = basics.clientId && basics.name;
  const step2Valid = selectedSiteIds.length > 0 && chosenSites.every(s => siteConfigs[s.id]?.service);
  const step3Valid = true;
  const step4Valid = chosenSites.every(s => pricing.rates[s.id]);
  const stepValid  = [step1Valid, step2Valid, step3Valid, step4Valid];

  function handlePublish() {
    showToast(`contract ${contractRef} created for ${clientObj?.name}`);
    setPublished(true);
  }

  // ── Published state ──────────────────────────────────────────────────────────
  if (published) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-full gap-6 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)' }}>
          ✓
        </div>
        <div>
          <div className="text-white font-black text-2xl">{contractRef}</div>
          <div className="text-white/45 text-sm mt-1">Contract created · {basics.startDate}</div>
        </div>
        <div className="w-full rounded-2xl p-6 text-left space-y-3" style={glass}>
          {[
            { label: 'Client',         value: clientObj?.name },
            { label: 'Sites',          value: `${chosenSites.length} site${chosenSites.length !== 1 ? 's' : ''}` },
            { label: 'Monthly value',  value: monthlyTotal > 0 ? `£${monthlyTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' },
            { label: 'Annual value',   value: annualTotal > 0  ? `£${annualTotal.toLocaleString('en-GB',  { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' },
            { label: 'Start date',     value: basics.startDate },
            { label: 'Account manager',value: basics.accountManager },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-white/35">{label}</span>
              <span className="text-white font-medium">{value || '—'}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          {[
            { label: '⚡ Match operatives', action: () => showToast('open operative matching for ' + contractRef) },
            { label: '📄 Send to client',   action: () => showToast('send contract ' + contractRef + ' to ' + clientObj?.name) },
            { label: '📋 View on dashboard',action: () => showToast('navigate to contract ' + contractRef) },
            { label: '+ New contract',       action: () => { setStep(0); setPublished(false); setBasics({ name:'', clientId:'', contractType:'new', startDate:'2026-06-01', ongoing:true, endDate:'', noticePeriod:'3 months', accountManager:'James Morris' }); setSelectedSiteIds([]); setSiteConfigs({}); setPricing({ rates:{}, billingFrequency:'Monthly', paymentTerms:'30 days', vatRegistered:true }); } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action}
              className="py-2.5 rounded-xl text-sm font-bold text-white/70 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Wizard layout ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="grid grid-cols-[1fr_300px] gap-8 max-w-5xl">

        {/* ── Left: form ── */}
        <div>
          <StepIndicator current={step} />

          {/* ── Step 0: Contract & client ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Contract basics" />
                <Field label="Client">
                  <select value={basics.clientId} onChange={e => handleClientChange(e.target.value)} style={{ ...input, appearance: 'none' }}>
                    <option value="">Select a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sector})</option>)}
                  </select>
                </Field>
                <Field label="Contract name">
                  <input type="text" value={basics.name} onChange={e => patchBasics({ name: e.target.value })}
                    placeholder="e.g. Next Retail UK Ltd — Morning Clean Contract" style={input} className="placeholder-white/20" />
                </Field>
                <div>
                  <label style={lbl}>Contract type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONTRACT_TYPES.map(ct => (
                      <button type="button" key={ct.id} onClick={() => patchBasics({ contractType: ct.id })}
                        className="rounded-xl p-3 text-left transition-all"
                        style={basics.contractType === ct.id
                          ? { background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.45)' }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="text-white text-xs font-bold">{ct.label}</div>
                        <div className="text-white/35 text-[10px] mt-0.5">{ct.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Account manager">
                  <input type="text" value={basics.accountManager} onChange={e => patchBasics({ accountManager: e.target.value })} style={input} />
                </Field>
              </div>

              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Contract dates" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start date">
                    <input type="date" value={basics.startDate} onChange={e => patchBasics({ startDate: e.target.value })} style={input} />
                  </Field>
                  <Field label="Notice period">
                    <select value={basics.noticePeriod} onChange={e => patchBasics({ noticePeriod: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {NOTICE_PERIODS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => patchBasics({ ongoing: !basics.ongoing })}
                    className="w-11 h-6 rounded-full transition-colors relative shrink-0"
                    style={{ background: basics.ongoing ? '#4f78ff' : 'rgba(255,255,255,0.15)' }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: basics.ongoing ? '1.375rem' : '0.25rem' }} />
                  </button>
                  <span className="text-white/60 text-sm">Ongoing contract (no fixed end date)</span>
                </div>
                {!basics.ongoing && (
                  <Field label="End date">
                    <input type="date" value={basics.endDate} onChange={e => patchBasics({ endDate: e.target.value })} style={input} />
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* ── Step 1: Sites & schedule ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-2xl p-6 space-y-4" style={glass}>
                <SectionHead title={`Select sites — ${clientObj?.name || 'client'}`} />
                {availSites.length === 0 && (
                  <div className="text-white/30 text-sm py-4 text-center">Select a client in Step 1 first</div>
                )}
                <div className="space-y-2">
                  {availSites.map(site => {
                    const selected = selectedSiteIds.includes(site.id);
                    return (
                      <button type="button" key={site.id} onClick={() => toggleSite(site.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                        style={selected
                          ? { background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.4)' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-black transition-all ${
                          selected ? 'bg-[#4f78ff] text-white' : 'text-white/20'
                        }`} style={selected ? {} : { border: '1px solid rgba(255,255,255,0.2)' }}>
                          {selected ? '✓' : ''}
                        </div>
                        <span className="text-lg">{SECTOR_EMOJI[site.type] || '🏢'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm truncate">{site.name}</div>
                          <div className="text-white/35 text-xs truncate">{site.address} · {site.postcode}</div>
                        </div>
                        {selected && <span className="text-[10px] font-black text-[#4f78ff]">Selected</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedSiteIds.length > 0 && (
                <div className="space-y-3">
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Configure each site
                  </div>
                  {chosenSites.map(site => (
                    <SiteConfigCard key={site.id} site={site}
                      config={siteConfigs[site.id] || {}}
                      onChange={p => patchSiteConfig(site.id, p)}
                      onRemove={() => toggleSite(site.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: SLA & compliance ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Evidence requirements" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Photo requirements">
                    <select value={compliance.photosRequired} onChange={e => patchCompliance({ photosRequired: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {PHOTO_REQS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Issue response time">
                    <select value={compliance.issueResponseHours} onChange={e => patchCompliance({ issueResponseHours: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {['2','4','8','12','24','48'].map(h => <option key={h} value={h}>{h} hours</option>)}
                    </select>
                  </Field>
                </div>
                <div className="space-y-3 pt-1">
                  {[
                    { key: 'gpsRequired',      label: 'GPS check-in/check-out required',     desc: 'Operative location verified at every visit' },
                    { key: 'checkInRequired',   label: 'Digital check-in required',           desc: 'App-based arrival confirmation' },
                    { key: 'signOffRequired',   label: 'Site supervisor sign-off required',   desc: 'Client signature on every job' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center gap-3 py-1">
                      <button type="button" onClick={() => patchCompliance({ [key]: !compliance[key] })}
                        className="w-11 h-6 rounded-full transition-colors relative shrink-0"
                        style={{ background: compliance[key] ? '#4f78ff' : 'rgba(255,255,255,0.15)' }}>
                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: compliance[key] ? '1.375rem' : '0.25rem' }} />
                      </button>
                      <div>
                        <div className="text-white text-sm font-medium">{label}</div>
                        <div className="text-white/35 text-[10px]">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Operative requirements" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="DBS requirement">
                    <select value={compliance.dbs} onChange={e => patchCompliance({ dbs: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {DBS_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Min. operatives per visit">
                    <select value={compliance.minOperatives} onChange={e => patchCompliance({ minOperatives: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {['1','2','3','4','5','6+'].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl p-6 space-y-4" style={glass}>
                <SectionHead title="Compliance documents required" />
                <div className="space-y-3">
                  {[
                    { key: 'riskAssessment',   label: 'Site-specific risk assessment',    desc: 'Required before first clean' },
                    { key: 'coshh',            label: 'COSHH assessment',                 desc: 'Chemical handling documentation' },
                    { key: 'methodStatement',  label: 'Method statement',                 desc: 'Cleaning methodology sign-off' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center gap-3 py-1">
                      <button type="button" onClick={() => patchCompliance({ [key]: !compliance[key] })}
                        className="w-11 h-6 rounded-full transition-colors relative shrink-0"
                        style={{ background: compliance[key] ? '#10b981' : 'rgba(255,255,255,0.15)' }}>
                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: compliance[key] ? '1.375rem' : '0.25rem' }} />
                      </button>
                      <div>
                        <div className="text-white text-sm font-medium">{label}</div>
                        <div className="text-white/35 text-[10px]">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Pricing & terms ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Per-site rates" />
                {chosenSites.length === 0 && (
                  <div className="text-white/30 text-sm py-2">No sites selected — go back to Step 2</div>
                )}
                <div className="space-y-4">
                  {chosenSites.map(site => {
                    const cfg   = siteConfigs[site.id] || {};
                    const freq  = cfg.frequency || 'Mon–Fri daily';
                    const rate  = parseFloat(pricing.rates[site.id] || 0);
                    const vpm   = visitsPerMonth(freq);
                    const monthly = rate * vpm;
                    return (
                      <div key={site.id} className="rounded-xl p-4 space-y-3"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <div className="flex items-start gap-2">
                          <span className="text-base">{SECTOR_EMOJI[site.type] || '🏢'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-sm truncate">{site.name}</div>
                            <div className="text-white/35 text-xs">{cfg.service || '—'} · {freq} · {vpm} visits/mo</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <div className="col-span-2">
                            <label style={lbl}>Rate per visit (£)</label>
                            <input type="number" placeholder="0.00" min="0" step="0.01"
                              value={pricing.rates[site.id] || ''}
                              onChange={e => patchRate(site.id, e.target.value)}
                              style={input} />
                          </div>
                          <div className="rounded-xl px-3 py-2.5 text-center"
                            style={{ background: monthly > 0 ? 'rgba(79,120,255,0.12)' : 'rgba(255,255,255,0.04)', border: monthly > 0 ? '1px solid rgba(79,120,255,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="text-sm font-black" style={{ color: monthly > 0 ? '#93c5fd' : 'rgba(255,255,255,0.2)' }}>
                              {monthly > 0 ? `£${monthly.toLocaleString('en-GB', { minimumFractionDigits: 0 })}` : '—'}
                            </div>
                            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>per month</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                <SectionHead title="Billing & payment" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Invoice frequency">
                    <select value={pricing.billingFrequency} onChange={e => patchPricing({ billingFrequency: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {['Weekly','Monthly','4-weekly','Quarterly'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label="Payment terms">
                    <select value={pricing.paymentTerms} onChange={e => patchPricing({ paymentTerms: e.target.value })} style={{ ...input, appearance: 'none' }}>
                      {PAYMENT_TERMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => patchPricing({ vatRegistered: !pricing.vatRegistered })}
                    className="w-11 h-6 rounded-full transition-colors relative shrink-0"
                    style={{ background: pricing.vatRegistered ? '#4f78ff' : 'rgba(255,255,255,0.15)' }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: pricing.vatRegistered ? '1.375rem' : '0.25rem' }} />
                  </button>
                  <span className="text-white/60 text-sm">VAT registered (20% applied to invoices)</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Nav buttons ── */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="px-6 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(s => s + 1)}
                disabled={!stepValid[step]}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white transition-all"
                style={{
                  background: stepValid[step] ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.06)',
                  border:     stepValid[step] ? '1px solid rgba(79,120,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  opacity:    stepValid[step] ? 1 : 0.5,
                }}>
                Continue →
              </button>
            ) : (
              <button type="button" onClick={handlePublish}
                disabled={!step4Valid}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white transition-all"
                style={{
                  background: step4Valid ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)',
                  border:     step4Valid ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  opacity:    step4Valid ? 1 : 0.5,
                }}>
                ✓ Publish contract
              </button>
            )}
            <button type="button" onClick={() => showToast('contract saved as draft')}
              className="px-5 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Save draft
            </button>
          </div>
        </div>

        {/* ── Right: live contract summary ── */}
        <div className="space-y-4 pt-16">
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Contract at a glance
          </div>
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>

            {/* Client */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.2)' }}>
                {clientObj ? (SECTOR_EMOJI[clientObj.sector] || '🏢') : '🏢'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-sm truncate">
                  {clientObj?.name || <span className="text-white/20">No client selected</span>}
                </div>
                <div className="text-white/35 text-xs truncate">
                  {basics.name || <span className="text-white/15">Contract name</span>}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* Key facts */}
            <div className="space-y-2.5">
              {[
                { label: 'Type',      value: CONTRACT_TYPES.find(c => c.id === basics.contractType)?.label },
                { label: 'Start',     value: basics.startDate || '—' },
                { label: 'Duration',  value: basics.ongoing ? 'Ongoing' : (basics.endDate || '—') },
                { label: 'Notice',    value: basics.noticePeriod },
                { label: 'Sites',     value: selectedSiteIds.length > 0 ? `${selectedSiteIds.length} selected` : '—' },
                { label: 'DBS',       value: compliance.dbs },
                { label: 'Evidence',  value: compliance.photosRequired },
                { label: 'Billing',   value: pricing.billingFrequency },
                { label: 'Terms',     value: pricing.paymentTerms },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-white/30">{label}</span>
                  <span className="text-white/60 font-medium text-right ml-3 truncate max-w-32">{value || '—'}</span>
                </div>
              ))}
            </div>

            {/* Value summary */}
            {monthlyTotal > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div className="rounded-xl p-4 space-y-2"
                  style={{ background: 'rgba(79,120,255,0.1)', border: '1px solid rgba(79,120,255,0.2)' }}>
                  <div className="text-white/40 text-[10px] font-black uppercase tracking-wider">Contract value</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">
                      £{monthlyTotal.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                    </span>
                    <span className="text-white/40 text-xs">/month</span>
                  </div>
                  <div className="text-white/40 text-xs">
                    £{annualTotal.toLocaleString('en-GB', { minimumFractionDigits: 0 })} annually
                  </div>
                  {pricing.vatRegistered && (
                    <div className="text-white/25 text-[10px]">+ VAT @ 20%</div>
                  )}
                </div>
              </>
            )}

            {/* Sites list */}
            {chosenSites.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div className="space-y-2">
                  {chosenSites.map(site => {
                    const cfg = siteConfigs[site.id] || {};
                    return (
                      <div key={site.id} className="flex items-start gap-2 text-xs">
                        <span className="text-base leading-none mt-0.5">{SECTOR_EMOJI[site.type] || '🏢'}</span>
                        <div className="min-w-0">
                          <div className="text-white/70 font-medium truncate">{site.name}</div>
                          <div className="text-white/30 truncate">{cfg.service || '—'} · {cfg.frequency || '—'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Cadi match note */}
          <div className="rounded-2xl p-4 text-center space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-white/40 text-[10px] font-black uppercase tracking-wider">After publishing</div>
            <div className="text-white/35 text-xs leading-relaxed">
              Cadi will automatically match qualified Connect-verified operatives to this contract based on location, service type, and DBS requirements.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
