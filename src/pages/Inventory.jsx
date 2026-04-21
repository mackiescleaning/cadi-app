// src/pages/Inventory.jsx
// Cadi — Inventory Tab (glassmorphism redesign)
// All logic / data unchanged — UI upgraded to dark navy glassmorphism

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { listProducts, createProduct, updateProduct, deleteProduct, listOrders, createOrder } from "../lib/db/inventoryDb";
import { getBusinessSettings } from "../lib/db/settingsDb";

// ─── Default accounts ─────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = {
  vatRegistered: false, frsRate: 12, isLimitedCostTrader: false,
  taxRate: 0.20, ytdIncome: 0, ytdExpenses: 0,
};

// ─── Demo product catalogue ───────────────────────────────────────────────────
const INITIAL_PRODUCTS = [
  { id: 1,  name: "Flash Multi-Surface 5L",       category: "chemicals",   type: "residential", unitCost: 2.40,  qty: 14, minQty: 4,  unit: "bottle",  supplier: "Costco",       icon: "🧴" },
  { id: 2,  name: "Toilet Duck Pro 750ml",         category: "chemicals",   type: "residential", unitCost: 1.80,  qty: 3,  minQty: 6,  unit: "bottle",  supplier: "Costco",       icon: "🚽" },
  { id: 3,  name: "Bleach 5L (professional)",      category: "chemicals",   type: "all",         unitCost: 4.20,  qty: 0,  minQty: 2,  unit: "drum",    supplier: "Screwfix",     icon: "⚗️" },
  { id: 4,  name: "Glass cleaner 5L",              category: "chemicals",   type: "exterior",    unitCost: 3.60,  qty: 5,  minQty: 2,  unit: "bottle",  supplier: "Cleaning Hub", icon: "🪟" },
  { id: 5,  name: "Industrial degreaser 5L",       category: "chemicals",   type: "commercial",  unitCost: 6.80,  qty: 7,  minQty: 3,  unit: "bottle",  supplier: "Cleaning Hub", icon: "🏭" },
  { id: 6,  name: "Sanitiser spray 750ml",         category: "chemicals",   type: "commercial",  unitCost: 2.20,  qty: 9,  minQty: 5,  unit: "bottle",  supplier: "Amazon",       icon: "💨" },
  { id: 7,  name: "Descaler 1L",                   category: "chemicals",   type: "residential", unitCost: 3.10,  qty: 4,  minQty: 3,  unit: "bottle",  supplier: "Amazon",       icon: "🪥" },
  { id: 8,  name: "Pure water solution 5L",        category: "chemicals",   type: "exterior",    unitCost: 5.50,  qty: 2,  minQty: 3,  unit: "drum",    supplier: "WFP Direct",   icon: "💧" },
  { id: 9,  name: "Microfibre cloths (10-pack)",   category: "equipment",   type: "all",         unitCost: 6.50,  qty: 8,  minQty: 3,  unit: "pack",    supplier: "Amazon",       icon: "🧽" },
  { id: 10, name: "Mop heads (commercial)",        category: "equipment",   type: "commercial",  unitCost: 3.20,  qty: 6,  minQty: 4,  unit: "head",    supplier: "Cleaning Hub", icon: "🪣" },
  { id: 11, name: "Squeegee rubber blade",         category: "equipment",   type: "exterior",    unitCost: 2.80,  qty: 12, minQty: 6,  unit: "blade",   supplier: "WFP Direct",   icon: "🪟" },
  { id: 12, name: "Scrubber sleeve (WFP)",         category: "equipment",   type: "exterior",    unitCost: 4.90,  qty: 5,  minQty: 3,  unit: "sleeve",  supplier: "WFP Direct",   icon: "💧" },
  { id: 13, name: "Trigger sprayer 1L",            category: "equipment",   type: "all",         unitCost: 1.40,  qty: 20, minQty: 8,  unit: "sprayer", supplier: "Amazon",       icon: "🔫" },
  { id: 14, name: "Scrubbing brush set",           category: "equipment",   type: "residential", unitCost: 4.20,  qty: 3,  minQty: 3,  unit: "set",     supplier: "Amazon",       icon: "🖌️" },
  { id: 15, name: "Nitrile gloves M (100-box)",    category: "ppe",         type: "all",         unitCost: 8.90,  qty: 2,  minQty: 3,  unit: "box",     supplier: "Amazon",       icon: "🧤" },
  { id: 16, name: "Safety goggles",                category: "ppe",         type: "exterior",    unitCost: 3.50,  qty: 6,  minQty: 2,  unit: "pair",    supplier: "Screwfix",     icon: "🥽" },
  { id: 17, name: "Disposable overshoes (50-pk)",  category: "ppe",         type: "residential", unitCost: 5.40,  qty: 3,  minQty: 2,  unit: "pack",    supplier: "Amazon",       icon: "🥾" },
  { id: 18, name: "Bin bags (200-roll)",           category: "disposables", type: "all",         unitCost: 9.80,  qty: 4,  minQty: 2,  unit: "roll",    supplier: "Costco",       icon: "🗑️" },
  { id: 19, name: "Paper roll towels",             category: "disposables", type: "commercial",  unitCost: 7.20,  qty: 8,  minQty: 4,  unit: "roll",    supplier: "Costco",       icon: "🧻" },
  { id: 20, name: "Colour-coded sponges (6pk)",    category: "disposables", type: "residential", unitCost: 2.90,  qty: 5,  minQty: 3,  unit: "pack",    supplier: "Amazon",       icon: "🧽" },
  { id: 21, name: "Carpet spotting solution",      category: "specialist",  type: "residential", unitCost: 8.40,  qty: 2,  minQty: 2,  unit: "bottle",  supplier: "Cleaning Hub", icon: "🪣" },
  { id: 22, name: "Render wash concentrate",       category: "specialist",  type: "exterior",    unitCost: 14.50, qty: 1,  minQty: 2,  unit: "bottle",  supplier: "WFP Direct",   icon: "🏠" },
  { id: 23, name: "Oven cleaner gel 500ml",        category: "specialist",  type: "residential", unitCost: 4.60,  qty: 6,  minQty: 3,  unit: "bottle",  supplier: "Cleaning Hub", icon: "🍳" },
];

const INITIAL_KITS = [];
// Default staff — overridden by DB staff in KitsSection
const DEFAULT_KIT_STAFF_OPTIONS = ["You", "Unassigned"];

const INITIAL_ORDERS = [
  { id: "o1", date: "2026-04-01", supplier: "Amazon",       items: [{name:"Microfibre cloths",qty:2,cost:6.50},{name:"Nitrile gloves M",qty:3,cost:8.90}], total: 39.70, receipt: true,  logged: true  },
  { id: "o2", date: "2026-03-22", supplier: "Cleaning Hub", items: [{name:"Flash 5L",qty:4,cost:2.40},{name:"Industrial degreaser",qty:2,cost:6.80}],       total: 23.20, receipt: true,  logged: true  },
  { id: "o3", date: "2026-03-15", supplier: "Costco",       items: [{name:"Bin bags 200-roll",qty:2,cost:9.80},{name:"Toilet Duck",qty:6,cost:1.80}],       total: 30.40, receipt: true,  logged: true  },
  { id: "o4", date: "2026-03-08", supplier: "WFP Direct",   items: [{name:"Pure water solution",qty:3,cost:5.50},{name:"Squeegee blades",qty:6,cost:2.80}], total: 33.30, receipt: false, logged: false },
  { id: "o5", date: "2026-02-28", supplier: "Screwfix",     items: [{name:"Bleach 5L",qty:4,cost:4.20},{name:"Safety goggles",qty:2,cost:3.50}],            total: 23.80, receipt: true,  logged: true  },
  { id: "o6", date: "2026-02-14", supplier: "Amazon",       items: [{name:"Trigger sprayers",qty:10,cost:1.40},{name:"Overshoes 50pk",qty:2,cost:5.40}],    total: 24.80, receipt: true,  logged: true  },
];

const MONTHLY_SPEND = [
  { month: "Nov", spend: 142 }, { month: "Dec", spend: 98  },
  { month: "Jan", spend: 167 }, { month: "Feb", spend: 156 },
  { month: "Mar", spend: 184 }, { month: "Apr", spend: 62, isCurrent: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stockStatus(p) {
  if (p.qty === 0)               return "critical";
  if (p.qty <= p.minQty)         return "low";
  return "good";
}
function kitCostPerJob(kit, products) {
  return kit.items.reduce((sum, item) => {
    const p = products.find(x => x.id === item.productId);
    return sum + (p ? p.unitCost * item.qtyPerJob : 0);
  }, 0);
}
function kitStockOk(kit, products) {
  return kit.items.every(item => { const p = products.find(x => x.id === item.productId); return p && p.qty >= item.qtyPerJob; });
}
function kitLowItems(kit, products) {
  return kit.items.filter(item => { const p = products.find(x => x.id === item.productId); return p && (p.qty === 0 || p.qty <= item.qtyPerJob); }).length;
}
const fmt  = n => `£${Math.round(n).toLocaleString()}`;
const fmt2 = n => `£${Number(n).toFixed(2)}`;

// ─── Glassmorphism primitives ─────────────────────────────────────────────────
function GCard({ children, className = "" }) {
  return (
    <div className={`relative rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.04)] overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
      {children}
    </div>
  );
}
function SL({ children, className = "" }) {
  return <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.45)] ${className}`}>{children}</p>;
}
function GInput({ className = "", ...props }) {
  return (
    <input {...props} className={`w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[rgba(153,197,255,0.4)] transition-colors ${className}`} />
  );
}
function GSelect({ className = "", children, ...props }) {
  return (
    <select {...props} className={`w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(153,197,255,0.4)] transition-colors ${className}`}>
      {children}
    </select>
  );
}

// Status badge
function StatusBadge({ status }) {
  const map = {
    good:     "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    low:      "bg-amber-500/10 border-amber-500/20 text-amber-400",
    critical: "bg-red-500/10 border-red-500/20 text-red-400",
    ordered:  "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
  };
  const label = { good: "Good", low: "Low stock", critical: "Order now", ordered: "Ordered" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border ${map[status] ?? map.good}`}>
      {label[status] ?? "Good"}
    </span>
  );
}

// Type badge
function TypeBadge({ type }) {
  const map = {
    residential: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    commercial:  "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
    exterior:    "bg-amber-500/10 border-amber-500/20 text-amber-400",
    all:         "bg-[rgba(153,197,255,0.08)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)]",
  };
  const label = { residential: "Residential", commercial: "Commercial", exterior: "Exterior", all: "All types" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border ${map[type] ?? map.all}`}>
      {label[type] ?? type}
    </span>
  );
}

// Info callout
function GAlert({ type = "blue", children }) {
  const styles = {
    warn:  "bg-amber-500/8 border-amber-500/25 text-amber-300",
    green: "bg-emerald-500/8 border-emerald-500/25 text-emerald-300",
    blue:  "bg-[#1f48ff]/8 border-[#1f48ff]/25 text-[#99c5ff]",
    gold:  "bg-amber-400/8 border-amber-400/25 text-amber-300",
    red:   "bg-red-500/8 border-red-500/25 text-red-300",
  };
  const icons = { warn: "⚠️", green: "✅", blue: "ℹ️", gold: "💡", red: "🚨" };
  return (
    <div className={`flex gap-3 p-3.5 border rounded-xl text-xs leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// Category meta
const CAT_META = {
  chemicals:   { emoji: "🧴", color: "bg-blue-500/10 border-blue-500/20 text-blue-400"     },
  equipment:   { emoji: "🔧", color: "bg-purple-500/10 border-purple-500/20 text-purple-400"},
  ppe:         { emoji: "🛡️", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"},
  specialist:  { emoji: "⚗️", color: "bg-orange-500/10 border-orange-500/20 text-orange-400"},
  disposables: { emoji: "📦", color: "bg-gray-500/10 border-gray-500/20 text-gray-400"      },
};

// ─── Reorder Modal ────────────────────────────────────────────────────────────
function ReorderModal({ product, accounts, onConfirm, onClose }) {
  const [qty,   setQty]   = useState(Math.max(product.minQty * 2, 4));
  const [price, setPrice] = useState((product.unitCost * Math.max(product.minQty * 2, 4)).toFixed(2));
  const total    = parseFloat(price) || 0;
  const taxSaved = total * accounts.taxRate;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white">{product.icon} {product.name}</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Reorder + log to accounts</p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SL className="mb-1.5">Quantity to order</SL>
              <GInput type="number" value={qty} min={1} onChange={e => { const q = parseInt(e.target.value)||1; setQty(q); setPrice((product.unitCost*q).toFixed(2)); }} />
            </div>
            <div>
              <SL className="mb-1.5">Total cost (£)</SL>
              <GInput type="number" value={price} step="0.01" onChange={e => setPrice(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(153,197,255,0.1)] divide-y divide-[rgba(153,197,255,0.06)]">
            {[
              { l: "Logged as",           v: "Cleaning materials",                          c: "text-white"       },
              { l: "HMRC SA103 box",       v: "Box 19 — Cost of goods",                     c: "text-[#99c5ff]"   },
              { l: "Tax saving est.",      v: `+${fmt2(taxSaved)} (${(accounts.taxRate*100).toFixed(0)}%)`, c: "text-emerald-400" },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-[rgba(153,197,255,0.45)]">{l}</span>
                <span className={`text-xs font-bold ${c}`}>{v}</span>
              </div>
            ))}
          </div>

          <GAlert type="gold">
            This purchase will be logged automatically as an allowable expense — reducing your tax bill by approximately <strong className="text-white">{fmt2(taxSaved)}</strong>.
          </GAlert>

          <div className="flex gap-2">
            <button onClick={() => onConfirm(qty, total)}
              className="flex-1 py-3 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
              ✓ Confirm & log to accounts
            </button>
            <button onClick={onClose}
              className="px-4 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Product Modal ────────────────────────────────────────────────────────
function AddProductModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", category: "chemicals", type: "all", unitCost: "", qty: "", minQty: "", unit: "bottle", supplier: "", icon: "🧴" });
  const set   = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const valid = form.name && parseFloat(form.unitCost) > 0 && parseInt(form.qty) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">Add product</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {[
            { label: "Product name",       key: "name",     type: "text",   ph: "e.g. Flash Multi-Surface 5L" },
            { label: "Unit cost (£)",       key: "unitCost", type: "number", ph: "e.g. 2.40" },
            { label: "Current stock",       key: "qty",      type: "number", ph: "e.g. 10" },
            { label: "Reorder when below",  key: "minQty",   type: "number", ph: "e.g. 4" },
            { label: "Unit label",          key: "unit",     type: "text",   ph: "e.g. bottle, pack, box" },
            { label: "Supplier",            key: "supplier", type: "text",   ph: "e.g. Costco" },
          ].map(({ label, key, type, ph }) => (
            <div key={key}>
              <SL className="mb-1.5">{label}</SL>
              <GInput type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph} />
            </div>
          ))}

          <div>
            <SL className="mb-1.5">Category</SL>
            <GSelect value={form.category} onChange={e => set("category", e.target.value)}>
              {["chemicals","equipment","ppe","specialist","disposables"].map(c => (
                <option key={c} value={c} className="bg-[#010a4f]">{c.charAt(0).toUpperCase()+c.slice(1)}</option>
              ))}
            </GSelect>
          </div>

          <div>
            <SL className="mb-1.5">Cleaner type</SL>
            <div className="grid grid-cols-4 gap-1.5">
              {["all","residential","commercial","exterior"].map(t => (
                <button key={t} onClick={() => set("type", t)}
                  className={`py-2 text-xs font-black rounded-xl border transition-all ${
                    form.type === t ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"
                  }`}>
                  {t === "all" ? "All" : t.slice(0,3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button disabled={!valid}
            onClick={() => { onSave({ ...form, id: Date.now(), unitCost: parseFloat(form.unitCost), qty: parseInt(form.qty)||0, minQty: parseInt(form.minQty)||2 }); onClose(); }}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all ${valid ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
            Save product
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION: Stock ───────────────────────────────────────────────────────────
function StockSection({ products, setProducts, accounts, onOrderLogged, onUpdateProduct, onAddProduct, onDeleteProduct }) {
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [typeFilter,setTypeFilter]= useState("all");
  const [reordering,setReordering]= useState(null);
  const [adding,    setAdding]    = useState(false);

  const cats  = ["all","chemicals","equipment","ppe","specialist","disposables"];
  const types = ["all","residential","commercial","exterior"];

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === "all" || p.category === catFilter;
    const matchType   = typeFilter === "all" || p.type === typeFilter || p.type === "all";
    return matchSearch && matchCat && matchType;
  }), [products, search, catFilter, typeFilter]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(p => { if (!g[p.category]) g[p.category] = []; g[p.category].push(p); });
    return g;
  }, [filtered]);

  const critical   = products.filter(p => stockStatus(p) === "critical");
  const low        = products.filter(p => stockStatus(p) === "low");
  const stockValue = products.reduce((s,p) => s + p.qty * p.unitCost, 0);

  const handleReorderConfirm = (product, qty, total) => {
    onUpdateProduct(product.id, { qty: product.qty + qty });
    onOrderLogged({ product, qty, total, date: new Date().toISOString() });
    setReordering(null);
  };

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Products",    val: products.length,               color: "text-white"        },
          { label: "Stock value", val: fmt(stockValue),               color: "text-white"        },
          { label: "Low stock",   val: low.length + critical.length,  color: low.length + critical.length > 0 ? "text-amber-400" : "text-white" },
          { label: "Critical",    val: critical.length,               color: critical.length > 0 ? "text-red-400" : "text-white" },
        ].map(({ label, val, color }) => (
          <GCard key={label} className="px-4 py-3">
            <SL className="mb-0.5">{label}</SL>
            <p className={`text-xl font-black tabular-nums ${color}`}>{val}</p>
          </GCard>
        ))}
      </div>

      {/* Critical alerts */}
      {critical.length > 0 && (
        <div className="space-y-2">
          {critical.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/25">
              <span className="text-base shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-red-300">{p.name} — out of stock</p>
                <p className="text-xs text-red-400/70">{p.supplier} · £{p.unitCost}/{p.unit}</p>
              </div>
              <button onClick={() => setReordering(p)}
                className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-black rounded-xl hover:bg-red-500/30 transition-colors shrink-0">
                Reorder →
              </button>
            </div>
          ))}
        </div>
      )}

      {low.length > 0 && (
        <GAlert type="warn">
          <strong className="text-white">{low.length} product{low.length > 1 ? "s" : ""} running low</strong> — {low.map(p => p.name).join(", ")}. Reorder before your next job run.
        </GAlert>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <GInput type="text" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1.5 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${catFilter === c ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"}`}>
              {c === "all" ? "All" : c.charAt(0).toUpperCase()+c.slice(1)}
              {c !== "all" && CAT_META[c] && ` ${CAT_META[c].emoji}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-1 flex-wrap">
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${typeFilter === t ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"}`}>
                {t === "all" ? "All types" : t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors whitespace-nowrap">
            + Add product
          </button>
        </div>
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <GCard className="p-8 text-center">
          <span className="text-3xl mb-3 block">📦</span>
          <p className="text-sm font-bold text-white mb-1">No products yet</p>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-4">Add your cleaning supplies, chemicals, and equipment to track stock levels and costs.</p>
          <button onClick={() => setAdding(true)}
            className="px-5 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-bold hover:bg-[#3a5eff] transition-colors shadow-lg shadow-[#1f48ff]/30">
            + Add your first product
          </button>
        </GCard>
      )}

      {/* Product list grouped by category */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([cat, catProducts]) => {
          const meta = CAT_META[cat] ?? { emoji: "📦", color: "" };
          return (
            <GCard key={cat} className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between bg-[rgba(153,197,255,0.02)]">
                <div className="flex items-center gap-2">
                  <span>{meta.emoji}</span>
                  <SL>{cat.charAt(0).toUpperCase()+cat.slice(1)}</SL>
                </div>
                <span className="text-[10px] text-[rgba(153,197,255,0.3)]">{catProducts.length} products</span>
              </div>
              <div className="divide-y divide-[rgba(153,197,255,0.05)]">
                {catProducts.map(p => {
                  const status = stockStatus(p);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.03)] group transition-colors">
                      <span className="text-base shrink-0 w-6 text-center">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-[rgba(153,197,255,0.4)]">{p.supplier}</span>
                          <TypeBadge type={p.type} />
                        </div>
                      </div>
                      {/* Qty stepper */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => onUpdateProduct(p.id, { qty: Math.max(0, p.qty - 1) })}
                          className="w-6 h-6 rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-[rgba(153,197,255,0.6)] hover:bg-[rgba(153,197,255,0.15)] hover:text-white flex items-center justify-center transition-all">−</button>
                        <span className="text-sm font-black tabular-nums text-white w-8 text-center">{p.qty}</span>
                        <button onClick={() => onUpdateProduct(p.id, { qty: p.qty + 1 })}
                          className="w-6 h-6 rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-[rgba(153,197,255,0.6)] hover:bg-[rgba(153,197,255,0.15)] hover:text-white flex items-center justify-center transition-all">+</button>
                      </div>
                      <div className="text-right shrink-0 w-16">
                        <p className="text-[10px] font-mono text-[rgba(153,197,255,0.45)]">£{p.unitCost}/{p.unit}</p>
                        <p className="text-[9px] text-[rgba(153,197,255,0.3)]">min {p.minQty}</p>
                      </div>
                      <div className="shrink-0"><StatusBadge status={status} /></div>
                      {(status === "critical" || status === "low") ? (
                        <button onClick={() => setReordering(p)}
                          className="shrink-0 px-2.5 py-1 bg-[#1f48ff]/20 border border-[#1f48ff]/35 text-[#99c5ff] text-[10px] font-black rounded-xl hover:bg-[#1f48ff]/35 transition-colors opacity-0 group-hover:opacity-100">
                          Order
                        </button>
                      ) : <div className="w-12 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </GCard>
          );
        })}
      </div>

      {reordering && <ReorderModal product={reordering} accounts={accounts} onConfirm={(qty,total) => handleReorderConfirm(reordering,qty,total)} onClose={() => setReordering(null)} />}
      {adding && <AddProductModal onSave={p => onAddProduct(p)} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ─── SECTION: Kits ────────────────────────────────────────────────────────────
function KitsSection({ products, setProducts, accounts, kits, setKits }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [loadedKit,  setLoadedKit]  = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ label: "", type: "residential", desc: "", assignedTo: "You", items: [] });

  // Load staff from DB
  const [kitStaffOptions, setKitStaffOptions] = useState(DEFAULT_KIT_STAFF_OPTIONS);
  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('staff_members').select('name').eq('active', true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setKitStaffOptions(["You", ...data.map(s => s.name), "Unassigned"]);
          }
        });
    });
  }, []);

  const types    = ["all","residential","commercial","exterior"];
  const filtered = typeFilter === "all" ? kits : kits.filter(k => k.type === typeFilter);
  const available = products.filter(p => draft.type === "all" || p.type === draft.type || p.type === "all");

  const addDraftItem    = (id) => { if (!draft.items.some(i => i.productId===id)) setDraft(p => ({ ...p, items: [...p.items, { productId: id, qtyPerJob: 1 }] })); };
  const updateDraftItem = (id, qty) => setDraft(p => ({ ...p, items: p.items.map(i => i.productId===id ? { ...i, qtyPerJob: Math.max(0.05, qty) } : i) }));
  const removeDraftItem = (id) => setDraft(p => ({ ...p, items: p.items.filter(i => i.productId!==id) }));
  const resetDraft      = () => { setDraft({ label: "", type: "residential", desc: "", assignedTo: "You", items: [] }); setShowCreate(false); };

  const saveDraftKit = () => {
    if (!draft.label || draft.items.length === 0) return;
    setKits(prev => [{ id: `k${Date.now()}`, label: draft.label, type: draft.type, icon: draft.type==="residential"?"🧺":draft.type==="commercial"?"🧰":"🚐", desc: draft.desc||`Custom ${draft.type} kit`, assignedTo: draft.assignedTo, items: draft.items }, ...prev]);
    resetDraft();
  };

  const handleLoadKit = (kit) => {
    setProducts(prev => prev.map(p => { const item = kit.items.find(i => i.productId===p.id); if (!item) return p; return { ...p, qty: Math.max(0, p.qty - item.qtyPerJob) }; }));
    setLoadedKit(kit.id);
    setTimeout(() => setLoadedKit(null), 3000);
  };

  return (
    <div className="space-y-4">
      <GAlert type="blue">
        <strong className="text-white">How kits work</strong> — create your own kits, choose exactly what goes in each one, assign to a staff member, and keep the <strong className="text-white">cost per job</strong> feeding your pricing calculator.
      </GAlert>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${typeFilter===t ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"}`}>
              {t === "all" ? "All kits" : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors">
          + Create your own kit
        </button>
      </div>

      {showCreate && (
        <GCard className="p-4 space-y-4">
          <SL>Create your own kit</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><SL className="mb-1.5">Kit name</SL><GInput type="text" value={draft.label} onChange={e => setDraft(p=>({...p,label:e.target.value}))} placeholder="e.g. Emma residential kit" /></div>
            <div><SL className="mb-1.5">Assign to</SL><GSelect value={draft.assignedTo} onChange={e => setDraft(p=>({...p,assignedTo:e.target.value}))}>{kitStaffOptions.map(n => <option key={n} value={n} className="bg-[#010a4f]">{n}</option>)}</GSelect></div>
            <div><SL className="mb-1.5">Job type</SL><GSelect value={draft.type} onChange={e => setDraft(p=>({...p,type:e.target.value,items:[]}))}>{types.filter(t=>t!=="all").map(t => <option key={t} value={t} className="bg-[#010a4f]">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</GSelect></div>
            <div><SL className="mb-1.5">Description</SL><GInput type="text" value={draft.desc} onChange={e => setDraft(p=>({...p,desc:e.target.value}))} placeholder="Optional note" /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <SL className="mb-2">Add products</SL>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-[rgba(153,197,255,0.12)] divide-y divide-[rgba(153,197,255,0.05)]">
                {available.map(product => (
                  <button key={product.id} onClick={() => addDraftItem(product.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors ${draft.items.some(i => i.productId===product.id) ? "bg-[#1f48ff]/15 text-white" : "text-[rgba(153,197,255,0.6)] hover:bg-[rgba(153,197,255,0.04)] hover:text-white"}`}>
                    <span>{product.icon} {product.name}</span>
                    <span className="font-mono text-[rgba(153,197,255,0.35)]">{fmt2(product.unitCost)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <SL className="mb-2">Products in this kit</SL>
              <div className="rounded-xl border border-[rgba(153,197,255,0.12)] min-h-24 max-h-56 overflow-y-auto divide-y divide-[rgba(153,197,255,0.05)]">
                {draft.items.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-[rgba(153,197,255,0.3)] text-center">Choose products from the left to build this kit.</div>
                ) : draft.items.map(item => {
                  const product = products.find(p => p.id === item.productId);
                  if (!product) return null;
                  return (
                    <div key={item.productId} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{product.icon} {product.name}</p>
                        <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{fmt2(product.unitCost)} each</p>
                      </div>
                      <input type="number" min="0.05" step="0.05" value={item.qtyPerJob}
                        onChange={e => updateDraftItem(item.productId, parseFloat(e.target.value)||0.05)}
                        className="w-16 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-lg px-2 py-1 text-xs font-mono text-right text-white focus:outline-none" />
                      <button onClick={() => removeDraftItem(item.productId)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 transition-colors">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {draft.items.length > 0 && (
            <div className="flex justify-between px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)] text-sm">
              <span className="text-[rgba(153,197,255,0.5)]">Estimated cost per job</span>
              <span className="font-black text-red-400">{fmt2(kitCostPerJob(draft, products))}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={saveDraftKit} disabled={!draft.label || draft.items.length === 0}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${draft.label && draft.items.length > 0 ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
              Save kit
            </button>
            <button onClick={resetDraft} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
              Cancel
            </button>
          </div>
        </GCard>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <GCard className="p-8 text-center">
            <p className="text-3xl mb-3">🧺</p>
            <p className="text-sm font-black text-white mb-1">No kits created yet</p>
            <p className="text-xs text-[rgba(153,197,255,0.4)]">Create your first custom kit, choose what goes in it, and assign it to a staff member.</p>
          </GCard>
        )}
        {filtered.map(kit => {
          const costPerJob  = kitCostPerJob(kit, products);
          const stockOk     = kitStockOk(kit, products);
          const lowCount    = kitLowItems(kit, products);
          const justLoaded  = loadedKit === kit.id;
          const typeGrad    = kit.type==="residential" ? "from-emerald-500/8" : kit.type==="commercial" ? "from-[#1f48ff]/8" : "from-amber-500/8";

          return (
            <GCard key={kit.id} className="overflow-hidden">
              <div className={`flex items-start gap-3 px-5 py-4 border-b border-[rgba(153,197,255,0.08)] bg-gradient-to-r ${typeGrad} to-transparent`}>
                <div className="w-10 h-10 rounded-xl bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.12)] flex items-center justify-center text-xl shrink-0">{kit.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-black text-white">{kit.label}</p>
                    <TypeBadge type={kit.type} />
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)]">
                      {kit.assignedTo || "Unassigned"}
                    </span>
                    {!stockOk && lowCount > 0 && <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-amber-500/10 border-amber-500/20 text-amber-400">⚠ {lowCount} item{lowCount>1?"s":""} low</span>}
                    {justLoaded && <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">✓ Loaded</span>}
                  </div>
                  <p className="text-xs text-[rgba(153,197,255,0.4)]">{kit.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-0.5">Cost per job</p>
                  <p className="text-lg font-black tabular-nums text-red-400">{fmt2(costPerJob)}</p>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                {/* Item chips */}
                <div className="flex flex-wrap gap-1.5">
                  {kit.items.map(item => {
                    const p = products.find(x => x.id === item.productId);
                    if (!p) return null;
                    const ok = p.qty >= item.qtyPerJob;
                    return (
                      <div key={item.productId} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border ${ok ? "bg-[rgba(153,197,255,0.05)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)]" : "bg-red-500/8 border-red-500/20 text-red-400"}`}>
                        <span>{p.icon}</span>
                        <span className="font-bold">{p.name.split(" ").slice(0,3).join(" ")}</span>
                        <span className="font-mono opacity-60">×{item.qtyPerJob < 1 ? item.qtyPerJob.toFixed(2) : item.qtyPerJob}</span>
                        {!ok && <span className="font-black">!</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Accounting insight */}
                <div className="flex items-center justify-between text-[10px] text-[rgba(153,197,255,0.4)] pt-2 border-t border-[rgba(153,197,255,0.06)] flex-wrap gap-2">
                  <span>{kit.items.length} products · cost per job: <strong className="text-red-400">{fmt2(costPerJob)}</strong></span>
                  <span>Tax saving: <strong className="text-emerald-400">{fmt2(costPerJob * accounts.taxRate)}</strong></span>
                </div>

                {/* Reassign + delete */}
                <div className="flex gap-2">
                  <GSelect value={kit.assignedTo || "Unassigned"} onChange={e => setKits(prev => prev.map(k => k.id===kit.id ? { ...k, assignedTo: e.target.value } : k))} className="flex-1 py-2 text-xs">
                    {kitStaffOptions.map(n => <option key={n} value={n} className="bg-[#010a4f]">{n}</option>)}
                  </GSelect>
                  <button onClick={() => setKits(prev => prev.filter(k => k.id !== kit.id))}
                    className="px-3 py-2 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)] text-xs font-black hover:border-red-500/30 hover:text-red-400 transition-all">
                    Delete
                  </button>
                </div>

                <button onClick={() => stockOk ? handleLoadKit(kit) : handleLoadKit(kit)}
                  className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                    justLoaded ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400" :
                    stockOk    ? "bg-[#1f48ff]/20 border border-[#1f48ff]/35 text-white hover:bg-[#1f48ff]/35" :
                                 "bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/15"
                  }`}>
                  {justLoaded ? "✓ Stock deducted" : stockOk ? `Load kit — deduct ${fmt2(costPerJob)} from stock` : `⚠ Load anyway — ${lowCount} item${lowCount>1?"s":""} short`}
                </button>
              </div>
            </GCard>
          );
        })}
      </div>

      <GAlert type="gold">
        <strong className="text-white">Pricing calculator connection</strong> — every custom kit keeps a live <strong className="text-white">cost per job</strong> figure so your pricing calculator stays accurate as supply costs change.
      </GAlert>
    </div>
  );
}

// ─── SECTION: Spend ───────────────────────────────────────────────────────────
function SpendSection({ accounts, orders }) {
  const ytdSpend        = orders.filter(o => o.logged).reduce((s,o) => s+o.total, 0);
  const taxSaved        = ytdSpend * accounts.taxRate;
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // "2026-04" format
  const thisMonth       = orders.filter(o => o.logged && o.date?.startsWith(currentMonthPrefix)).reduce((s,o) => s+o.total, 0);

  // Build monthly spend from real orders (last 6 months)
  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const prefix = d.toISOString().slice(0, 7);
    const monthLabel = d.toLocaleDateString('en-GB', { month: 'short' });
    const spend = orders.filter(o => o.logged && o.date?.startsWith(prefix)).reduce((s,o) => s+o.total, 0);
    return { month: monthLabel, spend, isCurrent: i === 5 };
  });
  const maxSpend = Math.max(...monthlySpend.map(m => m.spend), 1);
  const quarterlySpend  = ytdSpend / 3;
  const quarterlyIncome = accounts.ytdIncome / 3;
  const goodsPct        = quarterlyIncome > 0 ? (quarterlySpend / (quarterlyIncome * 1.2)) * 100 : 0;
  const lctPass         = goodsPct >= 2;

  const byCategory = [
    { label: "Chemicals",  spend: ytdSpend * 0.42, color: "bg-[#1f48ff]"    },
    { label: "Equipment",  spend: ytdSpend * 0.26, color: "bg-purple-500"   },
    { label: "PPE",        spend: ytdSpend * 0.19, color: "bg-amber-500"    },
    { label: "Specialist", spend: ytdSpend * 0.13, color: "bg-orange-500"   },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "YTD supply spend", val: fmt(ytdSpend),  color: "text-red-400"     },
          { label: "This month",       val: fmt(thisMonth), color: "text-white"        },
          { label: "Tax saved (est.)", val: fmt(taxSaved),  color: "text-emerald-400"  },
          { label: "SA103 box 19",     val: "Mapped",       color: "text-[#99c5ff]"   },
        ].map(({ label, val, color }) => (
          <GCard key={label} className="px-4 py-3">
            <SL className="mb-0.5">{label}</SL>
            <p className={`text-xl font-black tabular-nums ${color}`}>{val}</p>
          </GCard>
        ))}
      </div>

      {/* HMRC mapping */}
      <GCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Accounts integration</SL>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live · auto-updated
          </span>
        </div>
        <div className="divide-y divide-[rgba(153,197,255,0.06)]">
          {[
            { l: "SA103 box 19 — Cleaning materials",     v: fmt(ytdSpend),            sub: "Cost of goods sold",                         c: "text-red-400"    },
            { l: "Income tax saving (approx.)",            v: fmt(taxSaved),            sub: `${(accounts.taxRate*100).toFixed(0)}% of supply spend`, c: "text-emerald-400"},
            { l: "VAT goods — FRS Ltd Cost test",          v: fmt(quarterlySpend),      sub: "Per quarter",                                c: "text-amber-400"  },
            { l: "Goods as % of VAT-inclusive income",     v: `${goodsPct.toFixed(1)}%`,sub: lctPass ? "Above 2% — FRS rate safe" : "Below 2% — Limited Cost Trader warning", c: lctPass ? "text-emerald-400" : "text-red-400" },
          ].map(({ l, v, sub, c }) => (
            <div key={l} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-bold text-white">{l}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">{sub}</p>
              </div>
              <p className={`text-base font-black tabular-nums shrink-0 ml-4 ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        {!lctPass && (
          <div className="px-4 pb-4">
            <GAlert type="warn">
              Goods spend is only <strong className="text-white">{goodsPct.toFixed(1)}%</strong> of income this quarter — below the 2% threshold. You'll be classed as a <strong className="text-white">Limited Cost Trader</strong> and must use the 16.5% FRS rate. Buy more supplies before quarter end to avoid this.
            </GAlert>
          </div>
        )}
      </GCard>

      {/* Monthly spend chart */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <SL>Monthly supply spend</SL>
          <span className="text-[10px] text-[rgba(153,197,255,0.35)]">Rolling 6 months</span>
        </div>
        <div className="flex items-end gap-2 h-28">
          {monthlySpend.map((m) => {
            const pct = (m.spend / maxSpend) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex flex-col items-center">
                  <div className="hidden group-hover:flex absolute bottom-full mb-1 bg-[#0d1e78] border border-[rgba(153,197,255,0.2)] text-white text-[10px] px-2 py-1 rounded-lg z-10 whitespace-nowrap shadow-xl">
                    {m.month}: {fmt(m.spend)}
                  </div>
                  <div className={`w-full rounded-t-sm transition-all ${m.isCurrent ? "bg-[#1f48ff] opacity-70" : "bg-[rgba(153,197,255,0.15)] group-hover:bg-[rgba(153,197,255,0.25)]"}`}
                    style={{ height: `${Math.max(pct * 1.0, 4)}px` }} />
                </div>
                <span className={`text-[9px] font-bold ${m.isCurrent ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.3)]"}`}>{m.month}</span>
              </div>
            );
          })}
        </div>
      </GCard>

      {/* Spend by category */}
      <GCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Spend by category — YTD</SL></div>
        <div className="divide-y divide-[rgba(153,197,255,0.05)]">
          {byCategory.map(({ label, spend, color }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-bold text-[rgba(153,197,255,0.5)] w-20 shrink-0">{label}</span>
              <div className="flex-1 h-3 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(spend/ytdSpend)*100}%` }} />
              </div>
              <span className="text-xs font-black font-mono text-white w-12 text-right shrink-0">{fmt(spend)}</span>
              <span className="text-[10px] text-[rgba(153,197,255,0.35)] w-8 text-right shrink-0">{Math.round((spend/ytdSpend)*100)}%</span>
            </div>
          ))}
        </div>
      </GCard>
    </div>
  );
}

// ─── SECTION: Orders ─────────────────────────────────────────────────────────
function OrdersSection({ orders, setOrders, accounts }) {
  const [showAdd,   setShowAdd]   = useState(false);
  const [newOrder,  setNewOrder]  = useState({ supplier: "", date: new Date().toISOString().split("T")[0], total: "", notes: "" });

  const totalLogged   = orders.filter(o => o.logged).reduce((s,o) => s+o.total, 0);
  const totalUnlogged = orders.filter(o => !o.logged).reduce((s,o) => s+o.total, 0);
  const totalReceipts = orders.filter(o => o.receipt).length;

  const logOrder = (id) => setOrders(prev => prev.map(o => o.id===id ? { ...o, logged: true } : o));

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Logged to accounts", val: fmt(totalLogged),              color: "text-emerald-400" },
          { label: "Not yet logged",     val: fmt(totalUnlogged),             color: totalUnlogged > 0 ? "text-amber-400" : "text-white" },
          { label: "Digital receipts",   val: `${totalReceipts} / ${orders.length}`, color: "text-[#99c5ff]" },
        ].map(({ label, val, color }) => (
          <GCard key={label} className="px-4 py-3">
            <SL className="mb-0.5">{label}</SL>
            <p className={`text-xl font-black tabular-nums ${color}`}>{val}</p>
          </GCard>
        ))}
      </div>

      {totalUnlogged > 0 && (
        <GAlert type="warn">
          <strong className="text-white">{fmt(totalUnlogged)} in purchases not yet logged</strong> — these won't appear in your SA103 expenses or reduce your tax bill until logged.
        </GAlert>
      )}

      <GAlert type="gold">
        <strong className="text-white">HMRC records</strong> — under MTD you must keep digital records of every business expense for 6 years. This orders log is your compliant record. No paper receipts needed once saved here.
      </GAlert>

      <div className="flex items-center justify-between">
        <SL>Purchase history</SL>
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors">
          + Log purchase
        </button>
      </div>

      {showAdd && (
        <GCard className="p-4 space-y-3">
          <SL>New purchase</SL>
          <div className="grid grid-cols-2 gap-3">
            <div><SL className="mb-1.5">Supplier</SL><GInput type="text" placeholder="e.g. Amazon" value={newOrder.supplier} onChange={e => setNewOrder(p=>({...p,supplier:e.target.value}))} /></div>
            <div><SL className="mb-1.5">Date</SL><GInput type="date" value={newOrder.date} onChange={e => setNewOrder(p=>({...p,date:e.target.value}))} /></div>
            <div><SL className="mb-1.5">Total spend (£)</SL><GInput type="number" placeholder="0.00" step="0.01" value={newOrder.total} onChange={e => setNewOrder(p=>({...p,total:e.target.value}))} /></div>
            <div><SL className="mb-1.5">Notes</SL><GInput type="text" placeholder="Optional" value={newOrder.notes} onChange={e => setNewOrder(p=>({...p,notes:e.target.value}))} /></div>
          </div>
          {parseFloat(newOrder.total) > 0 && (
            <div className="flex justify-between px-4 py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] text-sm">
              <span className="text-xs text-[rgba(153,197,255,0.45)]">Estimated tax saving</span>
              <span className="text-xs font-black text-emerald-400">+{fmt2(parseFloat(newOrder.total)*accounts.taxRate)}</span>
            </div>
          )}
          <button
            disabled={!newOrder.supplier || !parseFloat(newOrder.total)}
            onClick={() => {
              const o = { id: `o${Date.now()}`, date: newOrder.date, supplier: newOrder.supplier, items: [{ name: newOrder.notes||"Cleaning supplies", qty: 1, cost: parseFloat(newOrder.total) }], total: parseFloat(newOrder.total), receipt: false, logged: true };
              setOrders(prev => [o, ...prev]);
              setNewOrder({ supplier: "", date: new Date().toISOString().split("T")[0], total: "", notes: "" });
              setShowAdd(false);
            }}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all ${newOrder.supplier && parseFloat(newOrder.total) ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
            Save & log to accounts
          </button>
        </GCard>
      )}

      {/* Orders list */}
      <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
        {orders.map(o => (
          <div key={o.id} className="px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-black text-white">{o.supplier}</p>
                  {o.logged
                    ? <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">✓ Logged</span>
                    : <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-amber-500/10 border-amber-500/20 text-amber-400">Not logged</span>
                  }
                  {o.receipt
                    ? <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]">Receipt saved</span>
                    : <span className="px-2 py-0.5 rounded-lg text-[10px] font-black border bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.35)]">No receipt</span>
                  }
                </div>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                  {new Date(o.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})} · {o.items.length} item{o.items.length>1?"s":""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {o.items.map((item, i) => (
                    <span key={i} className="text-[10px] text-[rgba(153,197,255,0.5)] bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)] px-2 py-0.5 rounded-lg">
                      {item.name}{item.qty>1?` ×${item.qty}`:""} — {fmt2(item.cost*(item.qty||1))}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black tabular-nums text-white">{fmt2(o.total)}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">saves {fmt2(o.total*accounts.taxRate)} tax</p>
              </div>
            </div>
            {!o.logged && (
              <button onClick={() => logOrder(o.id)}
                className="mt-2.5 w-full py-2.5 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/35 text-white text-xs font-black hover:bg-[#1f48ff]/35 transition-colors">
                Log to accounts — SA103 cleaning materials
              </button>
            )}
          </div>
        ))}
      </GCard>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function InventoryTab({ accountsData, onExpenseLog }) {
  const { user }  = useAuth();
  const isLive    = Boolean(user);

  // Fetch real settings from DB
  const [accounts, setAccounts] = useState({ ...DEFAULT_ACCOUNTS });
  useEffect(() => {
    if (!user) return;
    getBusinessSettings().then(s => {
      if (s) setAccounts(prev => ({
        ...prev,
        vatRegistered: Boolean(s.vat_registered),
        frsRate: Number(s.frs_rate) || 12,
        taxRate: Number(s.tax_rate) || 0.20,
      }));
    }).catch(() => {});
  }, [user]);

  const [tab,      setTab]      = useState("stock");
  const [products, setProducts] = useState([]);
  const [kits,     setKits]     = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Map DB row to component shape
  const mapProduct = (r) => ({
    id: r.id, name: r.name, category: r.category, type: r.type,
    unitCost: Number(r.unit_cost) || 0, qty: Number(r.qty) || 0,
    minQty: Number(r.min_qty) || 2, unit: r.unit || 'bottle',
    supplier: r.supplier || '', supplierUrl: r.supplier_url || '',
    notes: r.notes || '', icon: '📦',
  });

  const mapOrder = (r) => ({
    id: r.id, date: r.date, supplier: r.supplier || '',
    items: [{ name: r.product_name, qty: r.qty, cost: Number(r.unit_cost) || 0 }],
    total: Number(r.total_cost) || 0, receipt: false, logged: true,
  });

  // Load products + orders from Supabase
  useEffect(() => {
    if (!user) {
      setProducts(INITIAL_PRODUCTS);
      setOrders(INITIAL_ORDERS);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([listProducts(), listOrders()])
      .then(([prods, ords]) => {
        setProducts(prods.map(mapProduct));
        setOrders(ords.map(mapOrder));
      })
      .catch(() => {
        // Fallback to empty
        setProducts([]);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Wrap setProducts to persist changes to Supabase
  const updateProductLocal = useCallback(async (id, updates) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (isLive) {
      try {
        const dbUpdates = {};
        if ('qty' in updates) dbUpdates.qty = updates.qty;
        if ('unitCost' in updates) dbUpdates.unit_cost = updates.unitCost;
        if ('minQty' in updates) dbUpdates.min_qty = updates.minQty;
        if ('name' in updates) dbUpdates.name = updates.name;
        if ('category' in updates) dbUpdates.category = updates.category;
        if ('type' in updates) dbUpdates.type = updates.type;
        if ('unit' in updates) dbUpdates.unit = updates.unit;
        if ('supplier' in updates) dbUpdates.supplier = updates.supplier;
        if ('supplierUrl' in updates) dbUpdates.supplier_url = updates.supplierUrl;
        if ('notes' in updates) dbUpdates.notes = updates.notes;
        if (Object.keys(dbUpdates).length > 0) await updateProduct(id, dbUpdates);
      } catch (err) { console.error('Failed to update product:', err); }
    }
  }, [isLive]);

  const addProductLocal = useCallback(async (product) => {
    if (isLive) {
      try {
        const saved = await createProduct(product);
        setProducts(prev => [...prev, mapProduct(saved)]);
        return;
      } catch (err) { console.error('Failed to save product:', err); }
    }
    setProducts(prev => [...prev, { ...product, id: Date.now() }]);
  }, [isLive]);

  const deleteProductLocal = useCallback(async (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    if (isLive) {
      try { await deleteProduct(id); } catch (err) { console.error('Failed to delete product:', err); }
    }
  }, [isLive]);

  const handleOrderLogged = async ({ product, qty, total, date }) => {
    const orderData = {
      productId: product.id,
      productName: product.name,
      qty,
      unitCost: product.unitCost,
      totalCost: total,
      supplier: product.supplier,
      date: date?.split("T")[0] || new Date().toISOString().split('T')[0],
    };

    if (isLive) {
      try {
        const saved = await createOrder(orderData);
        setOrders(prev => [mapOrder(saved), ...prev]);
      } catch (err) {
        console.error('Failed to save order:', err);
        setOrders(prev => [{ id: `o${Date.now()}`, date: orderData.date, supplier: product.supplier, items: [{ name: product.name, qty, cost: product.unitCost }], total, receipt: false, logged: true }, ...prev]);
      }
    } else {
      setOrders(prev => [{ id: `o${Date.now()}`, date: orderData.date, supplier: product.supplier, items: [{ name: product.name, qty, cost: product.unitCost }], total, receipt: false, logged: true }, ...prev]);
    }

    // Also update product stock
    await updateProductLocal(product.id, { qty: product.qty + qty });
    onExpenseLog?.({ category: "cleaning-materials", amount: total, description: product.name, date, sa103Box: 19 });
  };

  const critical = products.filter(p => stockStatus(p) === "critical").length;
  const low      = products.filter(p => stockStatus(p) === "low").length;
  const ytdSpend = orders.filter(o => o.logged).reduce((s,o) => s+o.total, 0);
  const unlogged = orders.filter(o => !o.logged).length;

  const TABS = [
    { id: "stock",  label: "Stock",  emoji: "📦", badge: critical+low > 0 ? critical+low : null, badgeColor: critical > 0 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400" },
    { id: "kits",   label: "Kits",   emoji: "🧺", badge: null },
    { id: "spend",  label: "Spend",  emoji: "💷", badge: null },
    { id: "orders", label: "Orders", emoji: "🧾", badge: unlogged > 0 ? unlogged : null, badgeColor: "bg-amber-500/20 text-amber-400" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <SL className="mb-1">Supply management</SL>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-[rgba(153,197,255,0.5)]">{products.length} products</span>
              {critical > 0 && <span className="text-xs font-black text-red-400">🔴 {critical} critical</span>}
              {low > 0 && <span className="text-xs font-black text-amber-400">⚠ {low} low</span>}
              <span className="text-xs text-[rgba(153,197,255,0.4)]">YTD spend: <strong className="text-white">{fmt(ytdSpend)}</strong></span>
              <span className="text-xs text-[rgba(153,197,255,0.4)]">Tax saved: <strong className="text-emerald-400">{fmt(ytdSpend * accounts.taxRate)}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? "bg-emerald-400 animate-pulse" : "bg-[rgba(153,197,255,0.3)]"}`} />
            <span className="text-[10px] font-black text-[rgba(153,197,255,0.45)]">{isLive ? "Live" : "Demo"}</span>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 p-1 bg-[rgba(0,0,0,0.2)] rounded-2xl">
          {TABS.map(({ id, label, emoji, badge, badgeColor }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                tab === id ? "bg-[#1f48ff] text-white shadow-lg shadow-[#1f48ff]/30" : "text-[rgba(153,197,255,0.5)] hover:text-white"
              }`}>
              <span>{emoji}</span>
              <span className="hidden sm:inline">{label}</span>
              {badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${tab===id ? "bg-white/20 text-white" : badgeColor}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Section content */}
        {tab === "stock"  && <StockSection  products={products} setProducts={setProducts} accounts={accounts} onOrderLogged={handleOrderLogged} onUpdateProduct={updateProductLocal} onAddProduct={addProductLocal} onDeleteProduct={deleteProductLocal} />}
        {tab === "kits"   && <KitsSection   products={products} setProducts={setProducts} accounts={accounts} kits={kits} setKits={setKits} />}
        {tab === "spend"  && <SpendSection  accounts={accounts} orders={orders} />}
        {tab === "orders" && <OrdersSection orders={orders} setOrders={setOrders} accounts={accounts} />}
      </div>
    </div>
  );
}
