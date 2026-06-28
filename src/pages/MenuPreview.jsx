// MenuPreview.jsx — screenshot-ready service menu.
// What the owner sees when they hit "Preview menu" in Services. Same shareable
// view we'll expose publicly in Phase C. Designed to be screenshot-able as-is
// (Instagram story 9:16, square 1:1, or LinkedIn post).

import { useEffect, useState } from 'react';
import { ArrowLeft, Phone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listServices, formatPricingSummary, getFrequencyLabels } from '../lib/db/servicesDb';
import { SECTORS } from './Services';

export default function MenuPreview() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bgVariant, setBgVariant] = useState('dark'); // 'dark' | 'light'

  useEffect(() => {
    listServices({ includeInactive: false })
      .then(rows => setServices(rows.filter(s => s.is_active)))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  const businessName = profile?.business_name || profile?.first_name || 'Cleaning Services';
  const phone        = profile?.phone || '';
  const postcode     = profile?.postcode || '';
  const email        = user?.email || '';

  const categories = ['residential', 'exterior', 'commercial']
    .map(key => ({ key, items: services.filter(s => s.category === key) }))
    .filter(g => g.items.length > 0);

  const isDark = bgVariant === 'dark';

  return (
    <div className={`min-h-full w-full ${isDark ? 'bg-[#010a4f]' : 'bg-slate-50'}`}>
      {/* Floating chrome — hidden when "Hide chrome" toggled on, so it's
          out of every screenshot. */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[#010a4f]/70 border-b border-[rgba(153,197,255,0.12)] px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/services')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#99c5ff] hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Back to Services
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(153,197,255,0.45)]">Theme</span>
          <div className="flex rounded-lg border border-[rgba(153,197,255,0.2)] overflow-hidden">
            <button
              onClick={() => setBgVariant('dark')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                isDark ? 'bg-[#1f48ff] text-white' : 'bg-transparent text-[#99c5ff] hover:bg-white/5'
              }`}
            >
              Navy
            </button>
            <button
              onClick={() => setBgVariant('light')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                !isDark ? 'bg-white text-slate-900' : 'bg-transparent text-[#99c5ff] hover:bg-white/5'
              }`}
            >
              Light
            </button>
          </div>
        </div>
      </div>

      {/* The screenshot-ready menu card. Centred + capped width so the layout
          is identical on every device. */}
      <div className="flex justify-center py-8 px-3 sm:py-12 sm:px-6">
        <MenuCard
          businessName={businessName}
          phone={phone}
          postcode={postcode}
          email={email}
          categories={categories}
          loading={loading}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

// ── The menu itself — exported so Phase C public route can reuse it ─────────
export function MenuCard({ businessName, phone, postcode, email, categories, loading, isDark = true }) {
  // Initials for the logo bubble
  const initials = businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase();

  return (
    <article
      className={`relative w-full max-w-[560px] overflow-hidden rounded-3xl shadow-2xl ${
        isDark
          ? 'border border-[rgba(153,197,255,0.15)] text-white'
          : 'border border-slate-200 text-slate-900 bg-white'
      }`}
      style={
        isDark
          ? { background: 'linear-gradient(160deg, #010a4f 0%, #05124a 45%, #0d1e78 100%)' }
          : undefined
      }
    >
      {/* Subtle grid texture — only on dark */}
      {isDark && (
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      )}
      {isDark && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />}

      {/* Header */}
      <header className="relative px-6 pt-8 pb-6 text-center">
        <div
          className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-xl font-black shadow-lg ${
            isDark
              ? 'bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.2)] text-white'
              : 'bg-[#1f48ff]/10 border border-[#1f48ff]/20 text-[#1f48ff]'
          }`}
        >
          {initials || '✦'}
        </div>
        <p className={`text-[10px] font-bold tracking-[0.25em] uppercase mb-2 ${isDark ? 'text-[#99c5ff]' : 'text-[#1f48ff]'}`}>
          Service Menu
        </p>
        <h1 className={`text-2xl font-black leading-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {businessName}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {phone && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${
              isDark ? 'bg-white/5 text-[#99c5ff] border border-[rgba(153,197,255,0.15)]' : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <Phone size={11} /> {phone}
            </span>
          )}
          {postcode && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${
              isDark ? 'bg-white/5 text-[#99c5ff] border border-[rgba(153,197,255,0.15)]' : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <MapPin size={11} /> {postcode}
            </span>
          )}
        </div>
      </header>

      <div className={`mx-6 h-px ${isDark ? 'bg-[rgba(153,197,255,0.12)]' : 'bg-slate-200'}`} />

      {/* Body */}
      <div className="relative px-6 py-6 space-y-7">
        {loading ? (
          <p className={`text-center text-sm ${isDark ? 'text-[rgba(153,197,255,0.5)]' : 'text-slate-400'}`}>Loading services…</p>
        ) : categories.length === 0 ? (
          <p className={`text-center text-sm ${isDark ? 'text-[rgba(153,197,255,0.5)]' : 'text-slate-400'}`}>
            Add active services in the Services tab and they'll appear here.
          </p>
        ) : (
          categories.map(({ key, items }) => {
            const sector = SECTORS[key];
            return (
              <section key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: `${sector.accent}25`, border: `1px solid ${sector.accent}40` }}>
                    {sector.icon}
                  </span>
                  <h2 className={`text-[11px] font-black tracking-[0.18em] uppercase ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {sector.label}
                  </h2>
                  <div className="flex-1 h-px" style={{ background: `${sector.accent}30` }} />
                </div>
                <ul className="space-y-2.5">
                  {items.map(s => (
                    <ServiceLine key={s.id} service={s} sector={sector} isDark={isDark} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {/* Footer */}
      <footer className={`relative px-6 py-4 text-center border-t ${
        isDark ? 'border-[rgba(153,197,255,0.12)] bg-[#010a4f]/50' : 'border-slate-200 bg-slate-50'
      }`}>
        <p className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? 'text-[rgba(153,197,255,0.4)]' : 'text-slate-400'}`}>
          {email ? <>To book: {email}</> : phone ? <>To book: {phone}</> : 'Get in touch to book'}
        </p>
        <p className={`text-[9px] mt-1 ${isDark ? 'text-[rgba(153,197,255,0.25)]' : 'text-slate-300'}`}>
          Menu by Cadi · cadi.cleaning
        </p>
      </footer>
    </article>
  );
}

function ServiceLine({ service, sector, isDark }) {
  const pricing = formatPricingSummary(service);
  const freq = getFrequencyLabels(service);

  return (
    <li
      className={`relative rounded-xl px-3.5 py-3 ${
        isDark
          ? 'bg-white/[0.04] border border-[rgba(153,197,255,0.08)]'
          : 'bg-white border border-slate-200'
      }`}
    >
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r" style={{ background: sector.accent }} />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{service.name}</p>
            {service.description_included && (
              <p className={`text-[11px] mt-1 leading-snug ${isDark ? 'text-[rgba(153,197,255,0.55)]' : 'text-slate-500'}`}>
                {service.description_included}
              </p>
            )}
          </div>
          <span className={`text-sm font-black tabular-nums shrink-0 ${
            isDark ? 'text-emerald-300' : 'text-emerald-700'
          }`}>
            {pricing}
          </span>
        </div>
        {freq.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {freq.map(f => (
              <span
                key={f}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isDark
                    ? 'bg-white/5 text-[rgba(153,197,255,0.65)] border border-[rgba(153,197,255,0.12)]'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
