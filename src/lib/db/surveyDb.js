// surveyDb.js — CRUD for site surveys, structured data, packs, comparables

import { supabase } from '../supabase';

async function getBusinessId() {
  const { data } = await supabase.rpc('my_business_id');
  return data;
}

// ── Site surveys ──────────────────────────────────────────────────────────────

export async function createSurvey({ customerId }) {
  const businessId = await getBusinessId();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('site_surveys')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      sector:      'commercial',
      status:      'capturing',
      created_by:  user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSurvey(surveyId) {
  const { data, error } = await supabase
    .from('site_surveys')
    .select('*, customers(id, name, address_line1, address_line2, town, postcode, segment, segment_source)')
    .eq('id', surveyId)
    .single();
  if (error) throw error;
  return data;
}

export async function listOpenSurveys() {
  const { data, error } = await supabase
    .from('site_surveys')
    .select('id, status, created_at, updated_at, customer_id, customers(name)')
    .in('status', ['capturing', 'structured', 'quoted'])
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSurveysForCustomer(customerId) {
  const { data, error } = await supabase
    .from('site_surveys')
    .select('id, status, created_at, updated_at, visit_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateSurveyNotes(surveyId, rawNotes) {
  const { error } = await supabase
    .from('site_surveys')
    .update({ raw_notes: rawNotes })
    .eq('id', surveyId);
  if (error) throw error;
}

export async function updateSurveyStatus(surveyId, status) {
  const { error } = await supabase
    .from('site_surveys')
    .update({ status })
    .eq('id', surveyId);
  if (error) throw error;
}

// ── Survey media ──────────────────────────────────────────────────────────────

export async function addSurveyMedia({ surveyId, kind, storagePath, transcript = null, caption = null }) {
  const businessId = await getBusinessId();
  const { data, error } = await supabase
    .from('survey_media')
    .insert({ business_id: businessId, survey_id: surveyId, kind, storage_path: storagePath, transcript, caption })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSurveyMedia(surveyId) {
  const { data, error } = await supabase
    .from('survey_media')
    .select('*')
    .eq('survey_id', surveyId)
    .order('taken_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function deleteSurveyMedia(mediaId) {
  const { error } = await supabase
    .from('survey_media')
    .delete()
    .eq('id', mediaId);
  if (error) throw error;
}

export async function uploadSurveyPhoto(surveyId, file) {
  const businessId = await getBusinessId();
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${businessId}/${surveyId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('survey-media')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;
  return path;
}

export function getSurveyMediaUrl(storagePath) {
  const { data } = supabase.storage.from('survey-media').getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Survey structured ─────────────────────────────────────────────────────────

export async function getSurveyStructured(surveyId) {
  const { data, error } = await supabase
    .from('survey_structured')
    .select('*')
    .eq('survey_id', surveyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSurveyStructured(surveyId, fields) {
  const businessId = await getBusinessId();
  const { data, error } = await supabase
    .from('survey_structured')
    .upsert({ business_id: businessId, survey_id: surveyId, ...fields }, { onConflict: 'survey_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmSurveyStructured(surveyId) {
  const { error } = await supabase
    .from('survey_structured')
    .update({ confirmed: true })
    .eq('survey_id', surveyId);
  if (error) throw error;
}

// ── Survey checklists ─────────────────────────────────────────────────────────

export async function listChecklistsForSurvey(serviceKeys = []) {
  const keys = [...serviceKeys, 'commercial_any'];
  const businessId = await getBusinessId();

  const [{ data: seeds }, { data: tenant }] = await Promise.all([
    supabase
      .from('survey_checklists')
      .select('*')
      .is('business_id', null)
      .in('service_key', keys)
      .order('sort', { ascending: true }),
    supabase
      .from('survey_checklists')
      .select('*')
      .eq('business_id', businessId)
      .in('service_key', keys)
      .order('sort', { ascending: true }),
  ]);

  // Tenant rows override seeds with the same service_key+label
  const all = [...(seeds ?? []), ...(tenant ?? [])];
  const seen = new Set();
  return all.filter(item => {
    const key = `${item.service_key}::${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Onboarding packs ──────────────────────────────────────────────────────────

export async function createPack({ customerId, surveyId, quoteId, contractType = 'one_off' }) {
  const businessId = await getBusinessId();
  const { data, error } = await supabase
    .from('onboarding_packs')
    .insert({ business_id: businessId, customer_id: customerId, survey_id: surveyId, quote_id: quoteId, contract_type: contractType })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPack(packId) {
  const { data, error } = await supabase
    .from('onboarding_packs')
    .select('*, pack_components(*)')
    .eq('id', packId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPackForCustomer(customerId) {
  const { data, error } = await supabase
    .from('onboarding_packs')
    .select('*, pack_components(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signOffPack(packId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('onboarding_packs')
    .update({ status: 'issued', signed_off_by: user?.id, signed_off_at: new Date().toISOString(), issued_at: new Date().toISOString() })
    .eq('id', packId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Job comparables ───────────────────────────────────────────────────────────

export async function listComparables({ serviceTags = [], involvesHeight = null } = {}) {
  let q = supabase.from('job_comparables').select('*').order('created_at', { ascending: false });
  if (involvesHeight !== null) q = q.eq('involves_height', involvesHeight);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  if (!serviceTags.length) return rows;
  // Client-side tag overlap filter (postgres doesn't do partial array overlap simply)
  return rows.filter(r => serviceTags.some(t => (r.service_tags ?? []).includes(t)));
}

export async function logComparable({ serviceTags, propertySize, involvesHeight, finalPrice, frequency }) {
  const businessId = await getBusinessId();
  const { error } = await supabase.from('job_comparables').insert({
    business_id:        businessId,
    service_tags:       serviceTags ?? [],
    property_size_band: propertySize ?? null,
    involves_height:    involvesHeight ?? false,
    final_price:        finalPrice,
    frequency:          frequency ?? null,
    source:             'logged_job',
  });
  if (error) throw error;
}

// ── Business survey defaults ──────────────────────────────────────────────────

async function getOwnerId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

export async function getSurveyDefaults() {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('business_settings')
    .select('setup_data')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return (data?.setup_data?.commercial_survey_defaults) ?? null;
}

export async function saveSurveyDefaults(defaults) {
  const ownerId = await getOwnerId();
  const { data: current } = await supabase
    .from('business_settings')
    .select('setup_data')
    .eq('owner_id', ownerId)
    .maybeSingle();
  const existing = current?.setup_data ?? {};
  const { error } = await supabase
    .from('business_settings')
    .upsert({
      owner_id:   ownerId,
      setup_data: { ...existing, commercial_survey_defaults: { ...defaults, set_at: new Date().toISOString() } },
    });
  if (error) throw error;
}

// ── Quote helpers (commercial) ────────────────────────────────────────────────

export async function createCommercialQuote({ customerId, surveyId, price, hrs, services, cleaningPlan, segment = 'commercial' }) {
  const businessId = await getBusinessId();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('quotes')
    .insert({
      owner_id:      user?.id,
      business_id:   businessId,
      customer_id:   customerId,
      survey_id:     surveyId,
      type:          'commercial',
      segment,
      job_label:     services?.map(s => s.name).join(', ') ?? 'Commercial clean',
      price,
      hrs:           hrs ?? null,
      cleaning_plan: cleaningPlan ?? {},
      status:        'draft',
      payload:       { services: services ?? [] },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuoteStatus(quoteId, status) {
  const { data, error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', quoteId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
