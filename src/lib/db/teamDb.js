import { supabase } from '../supabase';

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteMember({ email, role = 'accountant', accessLevel = 'read_only', expiresAt = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('account_members')
    .insert({
      owner_id:     user.id,
      member_email: email.toLowerCase().trim(),
      role,
      access_level: accessLevel,
      status:       'pending',
      invited_by:   user.id,
      expires_at:   expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Fire invite email via edge function
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${session.access_token}`,
        apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ member_id: data.id }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn('Invite email failed:', err);
  }

  return data;
}

// ── List members for the current owner ───────────────────────────────────────

export async function listMembers() {
  const { data, error } = await supabase
    .from('account_members')
    .select('*')
    .order('invited_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Resend invite email ───────────────────────────────────────────────────────

export async function resendInvite(memberId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
        apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ member_id: memberId }),
    },
  );
  if (!res.ok) throw new Error('Failed to resend invite');
}

// ── Toggle access level ───────────────────────────────────────────────────────

export async function setAccessLevel(memberId, accessLevel) {
  const { error } = await supabase
    .from('account_members')
    .update({ access_level: accessLevel })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

// ── Revoke access ─────────────────────────────────────────────────────────────

export async function revokeMember(memberId) {
  const { error } = await supabase
    .from('account_members')
    .update({ status: 'revoked' })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

// ── Reinstate (un-revoke) ─────────────────────────────────────────────────────

export async function reinstateMember(memberId) {
  const { error } = await supabase
    .from('account_members')
    .update({ status: 'active' })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function getAuditLog(ownerId) {
  const { data, error } = await supabase
    .from('account_member_audit')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logAuditAction({ memberId, ownerId, action, detail = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('account_member_audit').insert({
    member_id: memberId,
    owner_id:  ownerId,
    actor_id:  user.id,
    action,
    detail,
  });
}

// ── Accept invite (called from InviteAccept page) ─────────────────────────────

export async function acceptInvite(token) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to accept an invite');

  // Find the invite by token
  const { data: member, error: fetchErr } = await supabase
    .from('account_members')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single();

  if (fetchErr || !member) throw new Error('Invite not found or already used');
  if (member.expires_at && new Date(member.expires_at) < new Date()) {
    throw new Error('This invite has expired');
  }

  const { error } = await supabase
    .from('account_members')
    .update({
      member_user_id: user.id,
      status:         'active',
      accepted_at:    new Date().toISOString(),
    })
    .eq('id', member.id);

  if (error) throw new Error(error.message);

  await logAuditAction({
    memberId: member.id,
    ownerId:  member.owner_id,
    action:   'accepted_invite',
    detail:   { member_email: member.member_email },
  });

  return member;
}

// ── List clients for the current accountant ───────────────────────────────────

export async function listMyClients() {
  const { data, error } = await supabase
    .from('account_members')
    .select('id, owner_id, role, access_level, status, accepted_at')
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return data ?? [];
}
