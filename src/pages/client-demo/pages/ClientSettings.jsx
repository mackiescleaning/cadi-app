import { useState } from 'react';

const INITIAL_TEAM = [
  { id: 1, name: 'Sarah Mitchell',  email: 'sarah.mitchell@riverside-trust.org', role: 'Admin',     you: true  },
  { id: 2, name: 'David Clarke',    email: 'david.clarke@riverside-trust.org',   role: 'View only', you: false },
  { id: 3, name: 'Lisa Patel',      email: 'lisa.patel@riverside-trust.org',     role: 'View only', you: false },
];

const ROLE_STYLES = {
  'Admin':     { bg: 'rgba(79,120,255,0.08)',  border: 'rgba(79,120,255,0.2)',  text: '#1d4ed8' },
  'View only': { bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.2)', text: '#6b7280' },
  'Approver':  { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: '#059669' },
};

export default function ClientSettings({ showToast }) {
  const [team, setTeam] = useState(INITIAL_TEAM);
  const [notifs, setNotifs] = useState({
    emailOnComplete:   true,
    emailOnBreach:     true,
    emailOnCompliance: false,
    smsUrgent:         true,
    weeklyDigest:      true,
  });
  const [branding, setBranding] = useState({
    portalName:   'Britannia Group',
    showPowered:  true,
    showLogo:     false,
  });
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'View only' });

  function handleRemove(id) {
    setTeam(prev => prev.filter(m => m.id !== id));
    showToast('remove team member');
  }

  function handleInvite(e) {
    e.preventDefault();
    if (!invite.name || !invite.email) return;
    setTeam(prev => [...prev, { id: Date.now(), ...invite, you: false }]);
    setInvite({ name: '', email: '', role: 'View only' });
    setShowInvite(false);
    showToast(`invite ${invite.name} to portal`);
  }

  const Toggle = ({ checked, onChange }) => (
    <button onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#010a4f' : '#e5e7eb' }}>
      <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? '20px' : '4px' }} />
    </button>
  );

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Team */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Your team</div>
          <button onClick={() => setShowInvite(!showInvite)}
            className="text-xs font-bold text-[#4f78ff] hover:text-[#1f48ff] transition-colors">
            + Invite user
          </button>
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="px-5 py-4 bg-[#f8faff] border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Full name" required value={invite.name}
                onChange={e => setInvite(p => ({ ...p, name: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4f78ff]" />
              <input type="email" placeholder="Email address" required value={invite.email}
                onChange={e => setInvite(p => ({ ...p, email: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4f78ff]" />
            </div>
            <div className="flex items-center gap-3">
              <select value={invite.role} onChange={e => setInvite(p => ({ ...p, role: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white flex-1">
                <option>View only</option>
                <option>Approver</option>
                <option>Admin</option>
              </select>
              <button type="submit"
                className="px-4 py-2 rounded-xl bg-[#010a4f] text-white text-sm font-bold hover:bg-[#1f48ff] transition-colors">
                Send invite
              </button>
              <button type="button" onClick={() => setShowInvite(false)}
                className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-50">
          {team.map(({ id, name, email, role, you }) => {
            const rs = ROLE_STYLES[role] || ROLE_STYLES['View only'];
            return (
              <div key={id} className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f0f4ff] flex items-center justify-center text-xs font-black text-[#4f78ff] shrink-0">
                  {name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#010a4f]">{name}</span>
                    {you && <span className="text-[9px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">YOU</span>}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{email}</div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.text }}>
                  {role}
                </span>
                {!you && (
                  <button onClick={() => handleRemove(id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-sm shrink-0">×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Notification preferences</div>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { key: 'emailOnComplete',   label: 'Email on job completion',           sub: 'Daily summary when each clean is completed' },
            { key: 'emailOnBreach',     label: 'Email on SLA exception',            sub: 'Immediate alert when SLA at risk or breached' },
            { key: 'emailOnCompliance', label: 'Email on compliance updates',       sub: 'When insurance or vetting docs are renewed' },
            { key: 'smsUrgent',         label: 'SMS for urgent escalations',        sub: 'Text message for SLA breach or no-show' },
            { key: 'weeklyDigest',      label: 'Weekly digest',                     sub: 'Summary of the week every Friday afternoon' },
          ].map(({ key, label, sub }) => (
            <div key={key} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-[#010a4f]">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
              <Toggle
                checked={notifs[key]}
                onChange={v => {
                  setNotifs(p => ({ ...p, [key]: v }));
                  showToast(`${v ? 'enable' : 'disable'} ${label.toLowerCase()}`);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Portal branding</div>
          <div className="text-xs text-gray-400 mt-1">Managed by Britannia Group — contact your account manager to update</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-[#010a4f]">Portal name shown to your team</div>
              <div className="text-xs text-gray-400 mt-0.5">Currently: {branding.portalName} Client Portal</div>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Contact FM to change</span>
          </div>
          <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #f9fafb' }}>
            <div>
              <div className="text-sm font-medium text-[#010a4f]">Show "powered by Cadi"</div>
              <div className="text-xs text-gray-400 mt-0.5">Displayed in sidebar footer</div>
            </div>
            <Toggle
              checked={branding.showPowered}
              onChange={v => {
                setBranding(p => ({ ...p, showPowered: v }));
                showToast(`${v ? 'show' : 'hide'} "powered by Cadi" branding`);
              }}
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-[#f8faff] rounded-2xl border border-[#99c5ff]/20 p-5">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Your account manager</div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#010a4f] flex items-center justify-center text-white text-sm font-black shrink-0">BF</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-[#010a4f]">Britannia Group — Account Team</div>
            <div className="text-xs text-gray-400">0800 123 4567 · accounts@britanniagroup.co.uk</div>
          </div>
          <button onClick={() => showToast('open message thread with Britannia Group')}
            className="px-4 py-2 rounded-xl bg-[#010a4f] text-white text-xs font-bold hover:bg-[#1f48ff] transition-colors">
            Message
          </button>
        </div>
      </div>
    </div>
  );
}
