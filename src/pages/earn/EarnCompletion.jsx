import { useState } from 'react';
import { MapPin, Shield, Clock, Camera, CheckCircle2, AlertCircle, Upload, ChevronDown, Navigation } from 'lucide-react';

const ORANGE = '#C2410C';
const NAVY   = '#010a4f';

const JOB = {
  site: 'Next – Luton The Mall',
  address: 'Bute Street, Luton LU1 2TL',
  fm: 'Britannia Group',
  service: 'Retail morning clean',
  date: '9 May 2026',
  slaWindow: '06:00–08:00',
  value: 85,
  ref: '#BF-4471',
  coords: { lat: 51.8797, lng: -0.4138 },
};

const CHECK_IN = { time: '06:58', lat: 51.87972, lng: -0.41381, accuracy: 4, address: 'Bute Street, Luton LU1 2TL', distanceFromSite: 6 };
const CHECK_OUT = { time: '08:03', lat: 51.87971, lng: -0.41383, accuracy: 5, address: 'Bute Street, Luton LU1 2TL', distanceFromSite: 7 };

const PHOTOS = [
  {
    id: 'ph1', label: 'Main entrance — before', phase: 'before', time: '07:01:14',
    lat: 51.87971, lng: -0.41380, accuracy: 4, address: 'Bute Street, Luton',
    distanceFromSite: 5, status: 'verified', emoji: '🚪',
  },
  {
    id: 'ph2', label: 'Reception — before', phase: 'before', time: '07:04:38',
    lat: 51.87975, lng: -0.41385, accuracy: 6, address: 'Bute Street, Luton',
    distanceFromSite: 9, status: 'verified', emoji: '🪑',
  },
  {
    id: 'ph3', label: 'Corridor A — before', phase: 'before', time: '07:08:22',
    lat: 51.87973, lng: -0.41382, accuracy: 5, address: 'Bute Street, Luton',
    distanceFromSite: 7, status: 'verified', emoji: '🚶',
  },
  {
    id: 'ph4', label: 'Main entrance — after', phase: 'after', time: '07:41:05',
    lat: 51.87972, lng: -0.41381, accuracy: 4, address: 'Bute Street, Luton',
    distanceFromSite: 6, status: 'verified', emoji: '✨',
  },
  {
    id: 'ph5', label: 'Reception — after', phase: 'after', time: '07:45:51',
    lat: 51.87973, lng: -0.41384, accuracy: 5, address: 'Bute Street, Luton',
    distanceFromSite: 8, status: 'verified', emoji: '✨',
  },
  {
    id: 'ph6', label: 'Toilets — after', phase: 'after', time: '07:52:33',
    lat: 51.87976, lng: -0.41386, accuracy: 7, address: 'Bute Street, Luton',
    distanceFromSite: 11, status: 'verified', emoji: '🚿',
  },
  {
    id: 'ph7', label: 'Corridor A — after', phase: 'after', time: '07:57:18',
    lat: 51.87971, lng: -0.41380, accuracy: 4, address: 'Bute Street, Luton',
    distanceFromSite: 5, status: 'verified', emoji: '✨',
  },
];

const SLA_CHECKS = [
  { item: 'Arrived within SLA window (06:00–08:00)', done: true, detail: 'Check-in at 06:58 — 2 min early' },
  { item: 'All scheduled areas completed',           done: true, detail: '4 zones signed off' },
  { item: 'Before photos uploaded with geo-stamp',   done: true, detail: '3 photos · all within 15m of site' },
  { item: 'After photos uploaded with geo-stamp',    done: true, detail: '4 photos · all within 15m of site' },
  { item: 'Time on site recorded',                   done: true, detail: '65 min on site' },
  { item: 'Site sign-off obtained',                  done: false, detail: 'Pending supervisor' },
];

function GeoStamp({ photo }) {
  return (
    <div className="mt-2 rounded-lg px-3 py-2 space-y-1"
      style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex items-center gap-1.5">
        <Shield size={10} className="text-emerald-600 shrink-0" />
        <span className="text-[10px] font-black text-emerald-700 tracking-wide">GEO-VERIFIED</span>
        <span className="ml-auto text-[9px] text-emerald-500">±{photo.accuracy}m GPS</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-700">
        <MapPin size={9} className="shrink-0" />
        <span>{photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
        <Navigation size={9} className="shrink-0" />
        <span>{photo.distanceFromSite}m from site · {photo.address}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
        <Clock size={9} className="shrink-0" />
        <span>{photo.time} · 9 May 2026 · tamper-evident hash recorded</span>
      </div>
    </div>
  );
}

function PhotoCard({ photo, expanded, onToggle }) {
  return (
    <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: photo.phase === 'before' ? '#f0f4ff' : 'rgba(16,185,129,0.08)' }}>
          {photo.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#010a4f] truncate">{photo.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">{photo.time} · {photo.distanceFromSite}m from site</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black">
            <Shield size={11} />
            GEO
          </div>
          <CheckCircle2 size={16} className="text-emerald-500" />
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && <div className="px-4 pb-4"><GeoStamp photo={photo} /></div>}
    </div>
  );
}

function CheckInCard({ data, label }) {
  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
          <MapPin size={14} className="text-emerald-700" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{label}</div>
          <div className="text-sm font-black text-[#010a4f]">{data.time}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black"
          style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Shield size={10} />
          GPS Verified
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={11} className="text-emerald-500 shrink-0" />
          <span className="font-mono text-[11px]">{data.lat.toFixed(5)}, {data.lng.toFixed(5)}</span>
          <span className="text-gray-400">±{data.accuracy}m</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Navigation size={11} className="text-emerald-500 shrink-0" />
          <span>{data.distanceFromSite}m from {JOB.address}</span>
        </div>
      </div>
    </div>
  );
}

export default function EarnCompletion() {
  const [submitted, setSubmitted] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [issues, setIssues] = useState('');

  const beforePhotos = PHOTOS.filter(p => p.phase === 'before');
  const afterPhotos  = PHOTOS.filter(p => p.phase === 'after');

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto space-y-5 pb-8 px-4">
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="font-black text-xl text-[#010a4f]">Submitted to Britannia Group</h2>
            <p className="text-sm text-gray-500 mt-1">Next – Luton The Mall · 9 May 2026</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { label: 'Job reference',   value: '#BF-4471'       },
              { label: 'Photos submitted', value: '7 geo-stamped'  },
              { label: 'Time on site',    value: '65 min'         },
              { label: 'FM review',       value: 'Within 24 hrs'  },
              { label: 'Payment',         value: '£85 pending'    },
              { label: 'SLA status',      value: '✓ Met'          },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[#f8faff] p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                <div className="text-sm font-bold text-[#010a4f]">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-3 text-xs text-emerald-700 text-left"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="font-bold mb-1 flex items-center gap-1.5"><Shield size={12} /> Geo-verification complete</div>
            All 7 photos verified on-site. Coordinates, timestamps, and a tamper-evident hash have been logged to the audit trail and shared with Britannia Group.
          </div>
          <button onClick={() => setSubmitted(false)}
            className="text-xs text-[#4f78ff] font-bold hover:underline">
            ← Back to completion form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Job header */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Work completion</div>
            <h2 className="font-black text-xl text-[#010a4f] mt-1">{JOB.site}</h2>
            <div className="text-sm text-gray-500 mt-0.5">{JOB.fm} · {JOB.service} · {JOB.date}</div>
            <div className="text-xs text-gray-400 mt-0.5">{JOB.address}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-[#010a4f]">£{JOB.value}</div>
            <div className="text-xs text-gray-400">job value</div>
            <div className="text-[10px] text-gray-300 mt-0.5">{JOB.ref}</div>
          </div>
        </div>

        {/* Time on site */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 rounded-xl bg-[#f8faff] px-3 py-2.5 text-center">
            <div className="text-sm font-black text-[#010a4f]">{CHECK_IN.time}</div>
            <div className="text-[10px] text-gray-400">Arrived</div>
          </div>
          <div className="text-gray-300 text-sm">→</div>
          <div className="flex-1 rounded-xl bg-[#f8faff] px-3 py-2.5 text-center">
            <div className="text-sm font-black text-[#010a4f]">{CHECK_OUT.time}</div>
            <div className="text-[10px] text-gray-400">Finished</div>
          </div>
          <div className="text-gray-300 text-sm">·</div>
          <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-sm font-black text-emerald-700">65 min</div>
            <div className="text-[10px] text-emerald-600">On site</div>
          </div>
        </div>
      </div>

      {/* GPS Check-in / Check-out */}
      <div>
        <h3 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest mb-3">GPS Location Verification</h3>
        <div className="grid grid-cols-2 gap-3">
          <CheckInCard data={CHECK_IN}  label="Check-in" />
          <CheckInCard data={CHECK_OUT} label="Check-out" />
        </div>
        <div className="mt-2 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-700"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <Shield size={12} className="shrink-0" />
          <span>Cleaner was confirmed within <strong>15m of site boundary</strong> throughout the visit. Location data is tamper-evident and logged.</span>
        </div>
      </div>

      {/* SLA checklist */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">SLA Checklist</div>
        <div className="space-y-2.5">
          {SLA_CHECKS.map(({ item, done, detail }) => (
            <div key={item} className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-500'
              }`}>
                {done ? '✓' : '·'}
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-700">{item}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{detail}</div>
              </div>
              {!done && <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">Pending</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Before photos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest">Before Photos</h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <Shield size={11} />
            {beforePhotos.length}/{beforePhotos.length} geo-verified
          </div>
        </div>
        <div className="space-y-2">
          {beforePhotos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              expanded={expandedPhoto === photo.id}
              onToggle={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
            />
          ))}
        </div>
      </div>

      {/* After photos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest">After Photos</h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <Shield size={11} />
            {afterPhotos.length}/{afterPhotos.length} geo-verified
          </div>
        </div>
        <div className="space-y-2">
          {afterPhotos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              expanded={expandedPhoto === photo.id}
              onToggle={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
            />
          ))}
        </div>
      </div>

      {/* Audit trail summary */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(79,120,255,0.04) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} className="text-emerald-600" />
          <div className="text-sm font-black text-[#010a4f]">Audit Trail Summary</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Photos submitted',   value: '7 total',        color: '#059669' },
            { label: 'Geo-verified',        value: '7 of 7',         color: '#059669' },
            { label: 'Max distance',        value: '11m from site',  color: '#059669' },
            { label: 'GPS accuracy',        value: '4–7m average',   color: '#059669' },
            { label: 'Hash recorded',       value: 'SHA-256 ✓',      color: '#4f78ff' },
            { label: 'Time on site',        value: '65 min',         color: '#059669' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/70 px-3 py-2.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
              <div className="text-sm font-bold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 pt-1">
          This evidence package is tamper-evident. Any modification after upload will invalidate the audit hash and flag the submission for review.
        </div>
      </div>

      {/* Issues */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Issues Encountered (optional)</div>
        <textarea
          value={issues}
          onChange={e => setIssues(e.target.value)}
          placeholder="Report any issues found during the clean — equipment problems, access issues, areas not completed and why…"
          rows={3}
          className="w-full text-sm border border-[#99c5ff]/30 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#4f78ff] resize-none text-[#010a4f] placeholder-gray-300"
        />
      </div>

      {/* Submit */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          {['Before photos', 'After photos', 'GPS verified'].map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <div className="text-[10px] text-gray-500 text-center">{label}</div>
            </div>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-emerald-400" />
        <div className="text-xs text-gray-400">
          ✓ All evidence complete and geo-verified. Ready to submit to Britannia Group.
        </div>
        <button
          onClick={() => setSubmitted(true)}
          className="w-full py-4 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, #9a3412 100%)` }}>
          Submit to Britannia Group for review →
        </button>
        <div className="text-[10px] text-gray-400 text-center">
          By submitting you confirm all work was completed to the required standard. Geo-verification data will be shared with Britannia Group.
        </div>
      </div>
    </div>
  );
}
