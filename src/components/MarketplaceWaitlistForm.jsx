import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const EARN_ORANGE = '#C2410C';

const SERVICE_OPTIONS = [
  'Regular Cleaning',
  'Deep Clean',
  'End of Tenancy',
  'Office Clean',
  'School / Education',
  'Healthcare / Medical',
  'Retail Clean',
  'Window Cleaning',
  'Carpet Clean',
  'Post-Construction',
  'Industrial / Warehouse',
  'Hotel / Hospitality',
];

const RADIUS_OPTIONS = [
  { value: 10, label: 'Up to 10 miles' },
  { value: 25, label: 'Up to 25 miles' },
  { value: 50, label: 'Up to 50 miles' },
  { value: 100, label: 'Up to 100 miles' },
  { value: 0, label: 'UK-wide (any distance)' },
];

export default function MarketplaceWaitlistForm({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [radius, setRadius] = useState(25);
  const [flexible, setFlexible] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleService(s) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          marketplace_interest: true,
          marketplace_interest_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (err) throw err;
      onSuccess?.();
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#010a4f] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-black text-lg">Join the marketplace waitlist</h2>
            <p className="text-[#99c5ff]/60 text-xs mt-0.5">
              Founding 200 members get first access
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-[#99c5ff]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Services */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#99c5ff]/60 mb-2">
              Services you'd offer through the marketplace
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    services.includes(s)
                      ? 'border-orange-500 text-white'
                      : 'border-white/10 text-[#99c5ff]/60 hover:border-white/20 hover:text-white'
                  }`}
                  style={
                    services.includes(s)
                      ? { backgroundColor: EARN_ORANGE + '22', borderColor: EARN_ORANGE }
                      : {}
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#99c5ff]/60 mb-2">
              How far would you travel for marketplace work?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RADIUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadius(value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    radius === value
                      ? 'text-white'
                      : 'border-white/10 text-[#99c5ff]/60 hover:border-white/20 hover:text-white'
                  }`}
                  style={
                    radius === value
                      ? {
                          backgroundColor: EARN_ORANGE + '22',
                          borderColor: EARN_ORANGE,
                          color: 'white',
                        }
                      : {}
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Flexible */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#99c5ff]/60 mb-2">
              Would you take work outside your primary area occasionally?
            </label>
            <div className="flex gap-3">
              {[
                { v: true, l: 'Yes, occasionally' },
                { v: false, l: 'No, stay local' },
              ].map(({ v, l }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setFlexible(v)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    flexible === v
                      ? 'text-white'
                      : 'border-white/10 text-[#99c5ff]/60 hover:border-white/20'
                  }`}
                  style={
                    flexible === v
                      ? {
                          backgroundColor: EARN_ORANGE + '22',
                          borderColor: EARN_ORANGE,
                          color: 'white',
                        }
                      : {}
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#99c5ff]/60 mb-2">
              Average capacity available per week (optional)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="80"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 20"
                className="w-full rounded-xl border border-white/10 bg-[#091660] px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 placeholder:text-[#99c5ff]/30"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#99c5ff]/40">
                hours
              </span>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl text-white font-black text-sm transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: EARN_ORANGE }}
          >
            {submitting ? 'Saving…' : "I'm interested — add me to the waitlist"}
          </button>

          <p className="text-center text-[10px] text-[#99c5ff]/30">
            We'll only contact you about marketplace opportunities. No spam.
          </p>
        </form>
      </div>
    </div>
  );
}
