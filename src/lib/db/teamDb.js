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
  // Routed through the invite-accept edge function. It enforces:
  //   1. The caller is authenticated (JWT).
  //   2. The caller's auth email matches the invited email (case-insensitive).
  //   3. The invite is still pending and not expired.
  //   4. The update is race-guarded with `eq('status', 'pending')`.
  // This replaces direct client access to `account_members` which is no longer
  // allowed for anon (migration 037).
  const { data, error } = await supabase.functions.invoke('invite-accept', {
    body: { token },
  });
  if (error) throw new Error(error.message ?? 'Could not accept invite');
  if (data?.error) throw new Error(data.error);
  return { id: data?.member_id, owner_id: data?.owner_id };
}

// ── List clients for the current accountant ───────────────────────────────────

export async function listMyClients() {
  // Pulls the active clients of the calling accountant. Belt-and-braces filter
  // on owner_id != member_user_id — a self-invited row (owner_id matching the
  // accountant's own user) would surface their own business and trigger the
  // accountant banner. Shouldn't happen post-cleanup but cheap to enforce.
  const { data: { user } } = await supabase.auth.getUser();
  const me = user?.id;

  const { data: rows, error } = await supabase
    .from('account_members')
    .select('id, owner_id, role, access_level, status, accepted_at')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const filtered = (rows ?? []).filter(r => r.owner_id !== me);
  if (filtered.length === 0) return [];

  // Fetch business_name + first_name from the owner's profile so the banner can
  // render something meaningful instead of a UUID slice.
  const ownerIds = filtered.map(r => r.owner_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, business_name, first_name')
    .in('id', ownerIds);

  const byOwner = new Map((profiles ?? []).map(p => [p.id, p]));
  return filtered.map(r => {
    const p = byOwner.get(r.owner_id);
    return {
      ...r,
      business_name: p?.business_name ?? null,
      owner_name:    p?.first_name    ?? null,
    };
  });
}
