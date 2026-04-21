import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function listInvoices(limit = 500) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createInvoice(invoice) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    invoice_num: invoice.invoiceNum || invoice.num || 'INV-0001',
    customer_id: invoice.customerId || null,
    customer: invoice.customer || {},
    lines: invoice.lines || [],
    date: invoice.date || new Date().toISOString().split('T')[0],
    due_date: invoice.dueDate || null,
    type: invoice.type || 'residential',
    status: invoice.status || 'draft',
    notes: invoice.notes || '',
    payment_terms: invoice.paymentTerms ?? 14,
    sent_at: invoice.sentAt || null,
    viewed_at: invoice.viewedAt || null,
    paid_at: invoice.paidAt || null,
    payment_method: invoice.paymentMethod || null,
    reminders: invoice.reminders || [],
  };

  const { data, error } = await supabase
    .from('invoices')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateInvoice(id, updates) {
  const dbUpdates = { updated_at: new Date().toISOString() };

  if ('status' in updates) dbUpdates.status = updates.status;
  if ('customer' in updates) dbUpdates.customer = updates.customer;
  if ('lines' in updates) dbUpdates.lines = updates.lines;
  if ('date' in updates) dbUpdates.date = updates.date;
  if ('dueDate' in updates) dbUpdates.due_date = updates.dueDate;
  if ('due_date' in updates) dbUpdates.due_date = updates.due_date;
  if ('notes' in updates) dbUpdates.notes = updates.notes;
  if ('sentAt' in updates) dbUpdates.sent_at = updates.sentAt;
  if ('sent_at' in updates) dbUpdates.sent_at = updates.sent_at;
  if ('viewedAt' in updates) dbUpdates.viewed_at = updates.viewedAt;
  if ('paidAt' in updates) dbUpdates.paid_at = updates.paidAt;
  if ('paid_at' in updates) dbUpdates.paid_at = updates.paid_at;
  if ('paymentMethod' in updates) dbUpdates.payment_method = updates.paymentMethod;
  if ('payment_method' in updates) dbUpdates.payment_method = updates.payment_method;
  if ('reminders' in updates) dbUpdates.reminders = updates.reminders;
  if ('type' in updates) dbUpdates.type = updates.type;

  const { data, error } = await supabase
    .from('invoices')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInvoice(id) {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getNextInvoiceNum() {
  const ownerId = await getCurrentUserId();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_num')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNum = data[0].invoice_num;
    const match = lastNum.match(/(\d+)$/);
    if (match) {
      return `INV-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
    }
  }
  return 'INV-0001';
}

export async function logInvoiceSend(invoiceId, recipientEmail, status = 'sent', provider = 'resend') {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('invoice_sends')
    .insert({
      owner_id: ownerId,
      invoice_id: invoiceId,
      recipient_email: recipientEmail,
      status,
      provider,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
