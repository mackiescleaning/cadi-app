import { useState } from 'react';

const TABS = [
  { id: 'org',     label: 'Organisation'      },
  { id: 'sla',     label: 'SLA templates'     },
  { id: 'team',    label: 'Team & permissions' },
  { id: 'api',     label: 'Integrations & API' },
];

const TEAM = [
  { name: 'James Harper',  email: 'j.harper@britanniafm.co.uk',  role: 'Admin',      last: '5 min ago'   },
  { name: 'Claire Moss',   email: 'c.moss@britanniafm.co.uk',    role: 'Dispatcher', last: '2 hours ago' },
  { name: 'Tom Reeves',    email: 't.reeves@britanniafm.co.uk',  role: 'Dispatcher', last: 'Yesterday'   },
  { name: 'Helen Grant',   email: 'h.grant@britanniafm.co.uk',   role: 'Reports',    last: '3 days ago'  },
];

const SLA_TEMPLATES = [
  { name: 'School morning clean',     window: '06:00–08:00', photos: 'Before & after', sla: '07:00', default: true  },
  { name: 'Hospital deep clean',      window: '07:00–10:00', photos: 'Before, after & sign-off', sla: '07:30', default: false },
  { name: 'Office after-hours clean', window: '17:00–19:00', photos: 'After only',     sla: '18:30', default: false },
  { name: 'Retail daily clean',       window: '06:00–07:30', photos: 'After only',     sla: '07:00', default: false },
];

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', ...style }}>
      {children}
    </div>
  );
}

function SettingRow({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex-1 pr-6">
        <div className="text-white font-medium text-sm">{label}</div>
        {sub && <div className="text-white/35 text-xs mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      className="w-11 h-6 rounded-full transition-colors relative shrink-0"
      style={{ background: on ? '#4f78ff' : 'rgba(255,255,255,0.15)' }}>
      <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? '1.375rem' : '0.25rem' }} />
    </button>
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.875rem',
  fontSize: '0.875rem',
  outline: 'none',
};

export default function FmSettings({ showToast }) {
  const [activeTab, setActiveTab] = useState('org');
  const [notifs,    setNotifs]    = useState({ sla: true, qa: true, network: false, reports: true });

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sub-nav */}
      <div className="w-52 flex-shrink-0 p-4 space-y-0.5" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={active
                ? { background: 'rgba(79,120,255,0.18)', border: '1px solid rgba(79,120,255,0.38)', color: 'white' }
                : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }
              }
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; } }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">

        {/* ── Organisation ── */}
        {activeTab === 'org' && (
          <div className="max-w-2xl space-y-5">
            <div className="text-white font-black text-base mb-1">Organisation settings</div>

            <GlassCard className="px-6">
              <SettingRow label="Organisation name" sub="Shown on cleaner-facing job cards">
                <input defaultValue="Britannia FM" style={{ ...inputStyle, width: 220 }} />
              </SettingRow>
              <SettingRow label="Primary contact email" sub="Notifications and billing">
                <input defaultValue="ops@britanniafm.co.uk" style={{ ...inputStyle, width: 220 }} />
              </SettingRow>
              <SettingRow label="Default currency" sub="Used on invoices and reports">
                <select defaultValue="GBP" style={{ ...inputStyle, width: 120, appearance: 'none' }}>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </SettingRow>
              <SettingRow label="Timezone" sub="">
                <select defaultValue="Europe/London" style={{ ...inputStyle, width: 180, appearance: 'none' }}>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </SettingRow>
            </GlassCard>

            <GlassCard className="px-6">
              <div className="py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">Notifications</div>
                {[
                  { key: 'sla',     label: 'SLA breach alerts',      sub: 'Instant push + email when a cleaner is late' },
                  { key: 'qa',      label: 'QA queue',               sub: 'Alert when a job is ready for sign-off'       },
                  { key: 'network', label: 'Network activity',       sub: 'New cleaner applications and updates'         },
                  { key: 'reports', label: 'Monthly report ready',   sub: 'Email when auto-report is generated'          },
                ].map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div className="text-white font-medium text-sm">{label}</div>
                      <div className="text-white/35 text-xs mt-0.5">{sub}</div>
                    </div>
                    <Toggle on={notifs[key]} onChange={v => setNotifs(prev => ({ ...prev, [key]: v }))} />
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="px-6 py-5">
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">Branding</div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 flex items-center justify-center text-white font-black text-xl">B</div>
                <div>
                  <div className="text-white font-medium text-sm">Britannia FM logo</div>
                  <div className="text-white/35 text-xs mt-0.5">Shown on cleaner job cards and client portals</div>
                  <button onClick={() => showToast('upload organisation logo')}
                    className="text-xs font-bold text-[#4f78ff] hover:text-[#60a5fa] transition-colors mt-1.5">
                    Upload new logo →
                  </button>
                </div>
              </div>
            </GlassCard>

            <button onClick={() => showToast('save organisation settings')}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ background: 'rgba(79,120,255,0.25)', border: '1px solid rgba(79,120,255,0.45)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.38)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.25)'}
            >
              Save changes
            </button>
          </div>
        )}

        {/* ── SLA templates ── */}
        {activeTab === 'sla' && (
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-black text-base">SLA templates</div>
                <div className="text-white/40 text-sm mt-0.5">Reusable SLA configs for common job types</div>
              </div>
              <button onClick={() => showToast('create new SLA template')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)' }}>
                + New template
              </button>
            </div>
            <div className="space-y-3">
              {SLA_TEMPLATES.map((t, i) => (
                <GlassCard key={i} className="px-6 py-4">
                  <div className="flex items-center gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-bold text-sm">{t.name}</div>
                        {t.default && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: '#60a5fa' }}>
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-white/40 text-xs">Window: <span className="text-white/65">{t.window}</span></span>
                        <span className="text-white/40 text-xs">SLA: <span className="text-white/65">{t.sla}</span></span>
                        <span className="text-white/40 text-xs">Photos: <span className="text-white/65">{t.photos}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => showToast(`edit SLA template: ${t.name}`)}
                        className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Edit
                      </button>
                      {!t.default && (
                        <button onClick={() => showToast(`set ${t.name} as default template`)}
                          className="text-xs font-bold text-[#4f78ff] hover:text-[#60a5fa] transition-colors">
                          Set default
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* ── Team ── */}
        {activeTab === 'team' && (
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-black text-base">Team & permissions</div>
                <div className="text-white/40 text-sm mt-0.5">Who has access to the Britannia FM Ops Portal</div>
              </div>
              <button onClick={() => showToast('invite new team member')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)' }}>
                + Invite member
              </button>
            </div>
            <GlassCard>
              <div className="grid px-6 py-3" style={{ gridTemplateColumns: '1fr 120px 140px 80px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Name', 'Role', 'Last active', ''].map(h => (
                  <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/25">{h}</div>
                ))}
              </div>
              {TEAM.map(({ name, email, role, last }) => (
                <div key={email} className="grid px-6 py-4 transition-colors"
                  style={{ gridTemplateColumns: '1fr 120px 140px 80px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div>
                    <div className="text-white font-medium text-sm">{name}</div>
                    <div className="text-white/35 text-xs">{email}</div>
                  </div>
                  <div className="self-center">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={role === 'Admin'
                        ? { background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: '#60a5fa' }
                        : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }
                      }>
                      {role}
                    </span>
                  </div>
                  <div className="text-white/35 text-xs self-center">{last}</div>
                  <div className="self-center">
                    <button onClick={() => showToast(`edit permissions for ${name}`)}
                      className="text-xs text-white/30 hover:text-white/60 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'api' && (
          <div className="max-w-2xl space-y-5">
            <div>
              <div className="text-white font-black text-base">Integrations & API</div>
              <div className="text-white/40 text-sm mt-0.5">Connect Britannia FM's systems to Cadi</div>
            </div>
            <GlassCard className="px-6 py-5 space-y-5">
              <div>
                <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">API key</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl px-4 py-2.5 font-mono text-sm text-white/50"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    cadi_live_bfm_••••••••••••••••••••
                  </div>
                  <button onClick={() => showToast('copy API key to clipboard')}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white/90 transition-colors shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    Reveal
                  </button>
                </div>
                <div className="text-white/25 text-xs mt-2">Last used 2 hours ago · Read/write access to jobs, cleaners, reports</div>
              </div>
            </GlassCard>

            <div className="space-y-3">
              {[
                { name: 'Xero',          desc: 'Sync invoices and payment records automatically',  status: 'connected' },
                { name: 'Slack',         desc: 'SLA alerts and QA notifications in your Slack channels', status: 'connected' },
                { name: 'Microsoft Teams', desc: 'Operational alerts via Teams webhook',           status: 'not connected' },
                { name: 'ServiceNow',    desc: 'Push job data to your ITSM workflow',              status: 'not connected' },
              ].map(({ name, desc, status }) => (
                <GlassCard key={name} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-base shrink-0">
                    {name === 'Xero' ? '📊' : name === 'Slack' ? '💬' : name === 'Microsoft Teams' ? '📋' : '⚙️'}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm">{name}</div>
                    <div className="text-white/40 text-xs">{desc}</div>
                  </div>
                  {status === 'connected' ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                      Connected
                    </span>
                  ) : (
                    <button onClick={() => showToast(`connect ${name} integration`)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white/60 hover:text-white/90 transition-colors shrink-0"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                      Connect
                    </button>
                  )}
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
