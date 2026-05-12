import { useState } from 'react';
import clients from '../mock/clients.json';
import sites   from '../mock/sites.json';

const SERVICES = ['Morning clean','Deep clean','Office clean','School clean','Hospital clean','Retail clean','Window clean','Carpet clean','Washroom service','End of tenancy'];
const FREQUENCIES = ['One-off','Weekly','Fortnightly','Monthly','Mon–Fri daily','Mon–Sat daily'];
const SLA_WINDOWS = ['06:00–08:00','07:00–09:00','08:00–10:00','17:00–19:00','18:00–20:00','Custom'];
const PHOTO_REQS  = ['None','Before only','After only','Before & after','Before, after & sign-off'];

const PREVIEW_STATUSES = ['open','assigned','in-progress'];

export default function FmCreateJob({ showToast }) {
  const [form, setForm] = useState({
    clientId: '', siteId: '', service: '', date: '2026-05-12', timeWindow: '',
    slaWindow: '', value: '', frequency: 'One-off', photosRequired: 'Before & after',
    notes: '', urgent: false,
  });
  const [submitted, setSubmitted] = useState(false);

  function patch(p) { setForm(prev => ({ ...prev, ...p })); }

  const filteredSites = sites.filter(s => !form.clientId || s.clientId === form.clientId);
  const selectedClient = clients.find(c => c.id === form.clientId);
  const selectedSite   = sites.find(s => s.id === form.siteId);

  const isValid = form.clientId && form.siteId && form.service && form.date && form.value;

  function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    showToast(`create new job at ${selectedSite?.name} for ${selectedClient?.name}`);
    setSubmitted(true);
  }

  const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };
  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
    borderRadius: '0.75rem',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  };
  const labelStyle = { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' };

  if (submitted) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-full gap-5 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          ✓
        </div>
        <div>
          <div className="text-white font-black text-xl">Job created</div>
          <div className="text-white/45 text-sm mt-1">{selectedSite?.name} · {form.service} · {form.date}</div>
        </div>
        <div className="rounded-2xl p-5 text-left space-y-2 w-full max-w-sm" style={glass}>
          {[
            { label: 'Reference',   value: `#JB${Math.floor(1000 + Math.random() * 9000)}` },
            { label: 'Client',      value: selectedClient?.name },
            { label: 'Site',        value: selectedSite?.name },
            { label: 'Service',     value: form.service },
            { label: 'Date',        value: form.date },
            { label: 'Value',       value: `£${form.value}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-white/35">{label}</span>
              <span className="text-white font-medium">{value || '—'}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setForm({ clientId: '', siteId: '', service: '', date: '2026-05-12', timeWindow: '', slaWindow: '', value: '', frequency: 'One-off', photosRequired: 'Before & after', notes: '', urgent: false }); setSubmitted(false); }}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Create another job
          </button>
          <button onClick={() => showToast('assign cleaner to new job')}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: 'rgba(79,120,255,0.25)', border: '1px solid rgba(79,120,255,0.45)' }}>
            Assign a cleaner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="grid grid-cols-[1fr_340px] gap-6 max-w-5xl">

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Client + site */}
          <div className="rounded-2xl p-6 space-y-4" style={glass}>
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-1">Client & location</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Client</label>
                <select value={form.clientId} onChange={e => patch({ clientId: e.target.value, siteId: '' })}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Site</label>
                <select value={form.siteId} onChange={e => patch({ siteId: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' }} disabled={!form.clientId}>
                  <option value="">Select site…</option>
                  {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Job details */}
          <div className="rounded-2xl p-6 space-y-4" style={glass}>
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-1">Job details</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Service type</label>
                <select value={form.service} onChange={e => patch({ service: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Select service…</option>
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select value={form.frequency} onChange={e => patch({ frequency: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date} onChange={e => patch({ date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Time window</label>
                <input type="text" placeholder="e.g. 07:00–09:00" value={form.timeWindow}
                  onChange={e => patch({ timeWindow: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* SLA + compliance */}
          <div className="rounded-2xl p-6 space-y-4" style={glass}>
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-1">SLA & compliance</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>SLA window</label>
                <select value={form.slaWindow} onChange={e => patch({ slaWindow: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Select…</option>
                  {SLA_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Photo requirements</label>
                <select value={form.photosRequired} onChange={e => patch({ photosRequired: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  {PHOTO_REQS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Job value (£)</label>
                <input type="number" placeholder="0.00" value={form.value}
                  onChange={e => patch({ value: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => patch({ urgent: !form.urgent })}
                    className="w-11 h-6 rounded-full transition-colors relative"
                    style={{ background: form.urgent ? '#ef4444' : 'rgba(255,255,255,0.15)' }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: form.urgent ? '1.375rem' : '0.25rem' }} />
                  </div>
                  <span className="text-white/60 text-sm font-medium">Mark as urgent</span>
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl p-6" style={glass}>
            <label style={labelStyle}>Special instructions / notes</label>
            <textarea
              value={form.notes}
              onChange={e => patch({ notes: e.target.value })}
              placeholder="Any special requirements, access instructions, or notes for the assigned cleaner…"
              rows={3}
              className="w-full text-sm placeholder-white/25 bg-transparent resize-none focus:outline-none leading-relaxed"
              style={{ color: 'white' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="submit" disabled={!isValid}
              className="flex-1 py-3 rounded-xl text-sm font-black text-white transition-all"
              style={{
                background: isValid ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.06)',
                border: isValid ? '1px solid rgba(79,120,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                opacity: isValid ? 1 : 0.5,
              }}>
              Create job
            </button>
            <button type="button" onClick={() => showToast('save as draft and return later')}
              className="px-6 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Save draft
            </button>
          </div>
        </form>

        {/* ── Live preview ── */}
        <div className="space-y-4">
          <div className="text-white/35 text-[10px] font-black uppercase tracking-widest">Job card preview</div>
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 flex items-center justify-center text-lg shrink-0">
                🏢
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-sm truncate">
                  {selectedSite?.name || <span className="text-white/25">Site name</span>}
                </div>
                <div className="text-white/40 text-xs truncate">
                  {selectedClient?.name || <span className="text-white/20">Client</span>}
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-1 rounded-full shrink-0"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
                Open
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {[
                { label: 'Service',    value: form.service || '—'          },
                { label: 'Date',       value: form.date || '—'             },
                { label: 'Window',     value: form.timeWindow || '—'       },
                { label: 'SLA',        value: form.slaWindow || '—'        },
                { label: 'Frequency',  value: form.frequency               },
                { label: 'Photos',     value: form.photosRequired          },
                { label: 'Value',      value: form.value ? `£${form.value}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-white/30">{label}</span>
                  <span className="text-white/70 font-medium truncate ml-4 text-right">{value}</span>
                </div>
              ))}
            </div>

            {form.urgent && (
              <div className="rounded-lg px-3 py-2 text-xs font-bold text-center"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                ⚡ Urgent
              </div>
            )}
            {form.notes && (
              <div className="text-xs text-white/40 leading-relaxed pt-1">"{form.notes}"</div>
            )}
          </div>

          {/* Bulk upload CTA */}
          <div className="rounded-2xl p-5 text-center space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
            <div className="text-2xl opacity-60">📤</div>
            <div className="text-white/60 font-bold text-sm">Migrating a contract?</div>
            <div className="text-white/30 text-xs leading-relaxed">Upload a CSV to import multiple jobs at once — for recurring contracts with many sites.</div>
            <button onClick={() => showToast('open CSV bulk upload for contract migration')}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white/90 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Bulk upload via CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
