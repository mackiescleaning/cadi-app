import { supabase } from '../supabase';

// Client wrapper for the encrypted customer_vault RPCs. The actual codes
// never travel through the table directly — every read and write goes
// through a SECURITY DEFINER function that decrypts/encrypts server-side
// and writes an audit_log entry. See migration 049.
//
// `customerId` must be a real Supabase customer row owned by the calling
// user; the RPC raises 42501 otherwise.

export async function readVault(customerId) {
  const { data, error } = await supabase
    .rpc('vault_read', { p_customer_id: customerId });
  if (error) throw error;
  // The function returns SETOF with at most one row. An empty result means
  // no codes saved yet — return an empty shape so the UI can render an
  // editable form without a separate existence check.
  const row = Array.isArray(data) ? data[0] : null;
  return {
    keyCode:     row?.key_code     ?? '',
    alarmCode:   row?.alarm_code   ?? '',
    gateCode:    row?.gate_code    ?? '',
    accessNotes: row?.access_notes ?? '',
  };
}

export async function writeVault(customerId, { keyCode, alarmCode, gateCode, accessNotes }) {
  // The RPC treats `null` as "leave existing value untouched". Empty
  // string means "clear this field". The form's editForm state never
  // produces undefined, so we normalise empties to empty-string here.
  const { error } = await supabase.rpc('vault_write', {
    p_customer_id:  customerId,
    p_key_code:     keyCode     ?? '',
    p_alarm_code:   alarmCode   ?? '',
    p_gate_code:    gateCode    ?? '',
    p_access_notes: accessNotes ?? '',
  });
  if (error) throw error;
}
