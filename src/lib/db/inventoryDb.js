import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

// ─── Products ────────────────────────────────────────────────────────────────

export async function listProducts(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 200 } = opts;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data ?? [];
}

export async function createProduct(product) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    name: product.name || '',
    category: product.category || 'general',
    type: product.type || 'residential',
    unit_cost: Number(product.unitCost) || 0,
    qty: Number(product.qty) || 0,
    min_qty: Number(product.minQty) || 2,
    unit: product.unit || 'bottle',
    supplier: product.supplier || '',
    supplier_url: product.supplierUrl || '',
    notes: product.notes || '',
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Inventory Orders (restock log) ──────────────────────────────────────────

export async function listOrders(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 200 } = opts;

  const { data, error } = await supabase
    .from('inventory_orders')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data ?? [];
}

export async function createOrder(order) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    product_id: order.productId || null,
    product_name: order.productName || '',
    qty: Number(order.qty) || 1,
    unit_cost: Number(order.unitCost) || 0,
    total_cost: Number(order.totalCost) || 0,
    supplier: order.supplier || '',
    date: order.date || new Date().toISOString().split('T')[0],
    notes: order.notes || '',
  };

  const { data, error } = await supabase
    .from('inventory_orders')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
