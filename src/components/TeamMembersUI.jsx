import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, UserCheck, UserX, Phone, Mail, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessId } from '../hooks/useBusinessId';
import { usePlan } from '../hooks/usePlan';

const ROLE_LABELS = { cleaner: 'Cleaner', supervisor: 'Supervisor', manager: 'Manager' };

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  role: 'cleaner',
  receives_daily_schedule: true,
};

function MemberForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#010a4f] mb-1">First name *</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30"
            value={form.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            placeholder="Sarah"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#010a4f] mb-1">Last name</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30"
            value={form.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            placeholder="Jones"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#010a4f] mb-1">Phone</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+44 7700 000000"
            type="tel"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#010a4f] mb-1">Email</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="sarah@example.com"
            type="email"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#010a4f] mb-1">Role</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
          >
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={form.receives_daily_schedule}
            onChange={(e) => set('receives_daily_schedule', e.target.checked)}
            className="w-4 h-4 accent-[#1f48ff]"
          />
          <span className="text-xs text-gray-600">Send daily schedule</span>
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.first_name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1f48ff] rounded-lg hover:bg-[#3a5eff] disabled:opacity-40 transition-colors"
        >
          <Check size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TeamMembersUI() {
  const businessId = useBusinessId();
  const { teamMemberLimit } = usePlan();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!businessId) return;
    let mounted = true;
    supabase
      .from('team_members')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (mounted) {
          setMembers(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [businessId]);

  const atLimit =
    teamMemberLimit !== Infinity && members.filter((m) => m.is_active).length >= teamMemberLimit;

  async function handleAdd(form) {
    setSaving(true);
    const { data, error } = await supabase
      .from('team_members')
      .insert({ ...form, business_id: businessId })
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      setMembers((m) => [...m, data]);
      setShowAdd(false);
    }
  }

  async function handleEdit(id, form) {
    setSaving(true);
    const { data, error } = await supabase
      .from('team_members')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      setMembers((m) => m.map((x) => (x.id === id ? data : x)));
      setEditingId(null);
    }
  }

  async function handleToggleActive(member) {
    const updated = { is_active: !member.is_active, updated_at: new Date().toISOString() };
    setMembers((m) => m.map((x) => (x.id === member.id ? { ...x, ...updated } : x)));
    await supabase
      .from('team_members')
      .update(updated)
      .eq('id', member.id)
      .eq('business_id', businessId);
  }

  async function handleDelete(id) {
    setDeleting(id);
    await supabase.from('team_members').delete().eq('id', id).eq('business_id', businessId);
    setMembers((m) => m.filter((x) => x.id !== id));
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#1f48ff] animate-spin" />
        Loading team…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">
            Team members
            {teamMemberLimit !== Infinity && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {members.filter((m) => m.is_active).length} / {teamMemberLimit} active
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Who receives daily schedules and can check in to jobs
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            disabled={atLimit && !showAdd}
            title={atLimit ? `Limit of ${teamMemberLimit} reached on your plan` : undefined}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-lg hover:bg-[#1f48ff]/5 disabled:opacity-40 transition-colors"
          >
            <Plus size={13} />
            Add member
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-4 rounded-xl border border-[#1f48ff]/20 bg-[#f8faff]">
          <p className="text-xs font-bold text-[#010a4f] mb-3">New team member</p>
          <MemberForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
        </div>
      )}

      {/* Members list */}
      {members.length === 0 && !showAdd ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No team members yet — add your first cleaner above
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-4 transition-colors ${
                m.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              {editingId === m.id ? (
                <MemberForm
                  initial={m}
                  onSave={(form) => handleEdit(m.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#010a4f]">
                      {m.first_name} {m.last_name ?? ''}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {m.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone size={11} />
                          {m.phone}
                        </span>
                      )}
                      {m.email && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail size={11} />
                          {m.email}
                        </span>
                      )}
                      {m.receives_daily_schedule && (
                        <span className="text-xs text-[#1f48ff] font-medium">Daily schedule</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(m)}
                      title={m.is_active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {m.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                    <button
                      onClick={() => setEditingId(m.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#1f48ff] hover:bg-[#1f48ff]/5 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deleting === m.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {atLimit && !showAdd && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You've reached the {teamMemberLimit}-member limit on your current plan. Upgrade to Max for
          unlimited team members.
        </p>
      )}
    </div>
  );
}
