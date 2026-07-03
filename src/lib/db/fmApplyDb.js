import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

/**
 * FM onboarding helpers — separate from fmOpsDb so the public application
 * form can pull just the submit() without dragging in authenticated FM-side
 * data helpers.
 */

// ── Raw-fetch edge-function caller (CORS workaround) ───────────────────────
async function callFn(name, body, { auth = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey':       SUPABASE_ANON_KEY,
  };
  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    headers.Authorization = `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`;
  } else {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

// ── Public submit ──────────────────────────────────────────────────────────
// Routes through the fm-application-submit edge function which handles
// per-IP rate limiting, honeypot detection and size caps. The old anon
// RLS INSERT policy was dropped in migration 075.
//
// payload.hp_website2 is the honeypot — real users leave it blank; bots
// filling every field trigger the silent-success trap.
export async function submitFmApplication(payload) {
  const required = ['company_name', 'contact_name', 'contact_email'];
  for (const k of required) {
    if (!payload[k] || !String(payload[k]).trim()) {
      throw new Error(`${k.replace('_', ' ')} is required`);
    }
  }
  const { ok, status, data } = await callFn('fm-application-submit', {
    company_name:     payload.company_name,
    company_website:  payload.company_website,
    company_size:     payload.company_size,
    business_model:   payload.business_model,
    regions_covered:  payload.regions_covered,
    sites_managed:    payload.sites_managed,
    current_subs:     payload.current_subs,
    current_software: payload.current_software,
    contact_name:     payload.contact_name,
    contact_role:     payload.contact_role,
    contact_email:    payload.contact_email,
    contact_phone:    payload.contact_phone,
    why_cadi:         payload.why_cadi,
    hp_website2:      payload.hp_website2 ?? '',
  }, { auth: false });
  if (!ok) {
    if (status === 429) throw new Error("You've submitted too many applications recently — please wait a while and try again.");
    throw new Error(data?.error || 'Application failed to submit.');
  }
  return data;
}

// ── Admin: list applications ───────────────────────────────────────────────
export async function listApplications({ status = null } = {}) {
  let q = supabase
    .from('fm_applications')
    .select(`
      id, company_name, company_website, company_size, business_model,
      regions_covered, sites_managed, current_subs, current_software,
      contact_name, contact_role, contact_email, contact_phone, why_cadi,
      status, reviewed_at, rejection_reason,
      fm_organisation_id, invitation_id,
      reviewed_by_user_id, created_at,
      reviewer:profiles!fm_applications_reviewed_by_user_id_fkey ( id, first_name, last_name )
    `)
    .order('created_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ── Admin: approve / reject ────────────────────────────────────────────────
export async function approveApplication({ applicationId, sendEmail = true }) {
  return callFn('fm-approve-application', { application_id: applicationId, send_email: sendEmail });
}

export async function rejectApplication({ applicationId, reason }) {
  if (!reason?.trim()) throw new Error('A rejection reason is required');
  const { error } = await supabase
    .from('fm_applications')
    .update({
      status:           'rejected',
      reviewed_at:      new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('id', applicationId);
  if (error) throw error;
}

// ── Is the current user a Cadi admin? ──────────────────────────────────────
export async function getIsCadiAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('is_cadi_admin')
    .eq('id', user.id)
    .maybeSingle();
  return !!data?.is_cadi_admin;
}

// ── Invitation helpers (for the FM Ops Team page + invite accept) ─────────
export async function lookupFmInvite(token) {
  return callFn('fm-invite-lookup', { token }, { auth: false });
}

export async function acceptFmInvite(token) {
  return callFn('fm-invite-accept', { token }, { auth: true });
}

export async function listFmInvites() {
  const { data, error } = await supabase
    .from('fm_invitations')
    .select(`
      id, email, contact_name, role, status, claimed_at, expires_at, created_at,
      invited_by:profiles!fm_invitations_invited_by_user_id_fkey ( id, first_name, last_name ),
      claimed_by:profiles!fm_invitations_claimed_by_user_id_fkey ( id, first_name, last_name, business_name )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function inviteTeammate({ email, name, role = 'member' }) {
  return callFn('fm-invite-teammate', { email, contact_name: name, role });
}

export const APPLICATION_STATUS = {
  pending:   { label: 'Pending',   color: '#a16207' },
  reviewing: { label: 'Reviewing', color: '#3b82f6' },
  approved:  { label: 'Approved',  color: '#16a34a' },
  rejected:  { label: 'Rejected',  color: '#b91c1c' },
};

export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10',    label: '1–10 staff' },
  { value: '11-50',   label: '11–50 staff' },
  { value: '51-200',  label: '51–200 staff' },
  { value: '201-500', label: '201–500 staff' },
  { value: '500+',    label: '500+ staff' },
];

export const UK_REGIONS = [
  'North East', 'North West', 'Yorkshire & Humber',
  'East Midlands', 'West Midlands', 'East of England',
  'London', 'South East', 'South West',
  'Wales', 'Scotland', 'Northern Ireland',
];
