import { useNavigate } from 'react-router-dom';
import { Shield, MapPin, Star, TrendingUp, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';

const ORANGE = '#C2410C';
const NAVY   = '#010a4f';

const STATS = [
  { label: 'Connected FMs',      value: '1',      sub: 'Britannia Group active',       color: '#059669' },
  { label: 'Available to you',   value: '6 jobs', sub: 'matched to your score',     color: '#4f78ff' },
  { label: 'Pending payment',    value: '£460',   sub: 'awaiting FM sign-off',      color: '#f59e0b' },
  { label: 'Earned this month',  value: '£595',   sub: 'confirmed & paid',          color: '#059669' },
];

const PIPELINE_SNAPSHOT = [
  { status: 'On site now',       count: 1, color: '#3b82f6'  },
  { status: 'Upload evidence',   count: 1, color: ORANGE     },
  { status: 'Pending FM review', count: 2, color: '#f59e0b'  },
  { status: 'Upcoming',          count: 2, color: '#6366f1'  },
];

const FEATURED_JOBS = [
  {
    site: 'Premier Inn Luton Airport', postcode: 'MK42', fm: 'Britannia Group',
    service: 'Daily clean', schedule: 'Mon–Fri', window: '06:00–08:00',
    value: 85, valueFreq: '/visit', monthlyEst: 1700, matchScore: 94,
    freq: 'Recurring', action: 'accept',
  },
  {
    site: 'Luton Central Library', postcode: 'LU1', fm: 'Britannia Group',
    service: 'Evening clean', schedule: 'Mon–Fri', window: '18:00–20:00',
    value: 68, valueFreq: '/visit', monthlyEst: 1360, matchScore: 88,
    freq: 'Recurring', action: 'accept',
  },
  {
    site: 'Next – Centre:MK', postcode: 'MK41', fm: 'Metro Clean',
    service: 'Daily clean', schedule: 'Mon–Fri', window: '06:30–08:30',
    value: 92, valueFreq: '/visit', monthlyEst: 1840, matchScore: 82,
    freq: 'Recurring', action: 'apply',
  },
];

function MatchRing({ score }) {
  const color = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : '#f59e0b';
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black" style={{ borderColor: color, color }}>
        {score}
      </div>
      <div className="text-[9px] font-bold" style={{ color }}>match</div>
    </div>
  );
}

export default function EarnLanding() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl space-y-6 pb-12">

      {/* Hero strip */}
      <div className="rounded-2xl px-6 py-6 text-white overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #1a0a00 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(194,65,12,0.18) 0%, transparent 70%)', transform: 'translate(20%, -30%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#C2410C] flex items-center justify-center">
              <TrendingUp size={15} className="text-white" />
            </div>
            <span className="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">Connect</span>
          </div>
          <h1 className="text-2xl font-black leading-tight mb-1">Your FM command centre</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Connected to Britannia Group · 6 jobs available now · £460 pending payment
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {STATS.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4">
            <div className="text-2xl font-black mb-1" style={{ color }}>{value}</div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Active connection — Britannia Group */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest">Active Connection</h2>
          <button onClick={() => navigate('/connect/connections')}
            className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            Manage <ChevronRight size={12} />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f78ff, #010a4f)' }}>
              B
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-black text-[#010a4f]">Britannia Group</div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-emerald-700"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  Active
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Bedfordshire + Bucks · since Jan 2026</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black text-[#010a4f]">£3,995</div>
              <div className="text-[10px] text-gray-400">total earned</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Jobs done',  value: '47'      },
              { label: 'Avg rating', value: '4.8 ★'  },
              { label: 'Pending pay', value: '£420'   },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[#f8faff] px-3 py-2.5 text-center">
                <div className="text-sm font-black text-[#010a4f]">{value}</div>
                <div className="text-[10px] text-gray-400">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => navigate('/connect/marketplace')}
              className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:brightness-110"
              style={{ background: ORANGE }}>
              View matched jobs →
            </button>
            <button onClick={() => navigate('/connect/earnings')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300 transition-colors">
              Earnings
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline snapshot */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest">Job Pipeline</h2>
          <button onClick={() => navigate('/connect/pipeline')}
            className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            Full pipeline <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PIPELINE_SNAPSHOT.map(({ status, count, color }) => (
            <button key={status}
              onClick={() => navigate('/connect/pipeline')}
              className="flex items-center gap-3 bg-white rounded-xl border border-[#99c5ff]/20 shadow-sm px-4 py-3 text-left hover:shadow-md transition-all">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-700 flex-1">{status}</span>
              <span className="text-sm font-black" style={{ color }}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Work completion alert */}
      <div className="rounded-2xl px-5 py-4 flex items-start gap-4 cursor-pointer hover:shadow-md transition-all"
        style={{ background: 'rgba(194,65,12,0.06)', border: '1px solid rgba(194,65,12,0.25)' }}
        onClick={() => navigate('/connect/completion')}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ORANGE }}>
          <Shield size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-black text-[#010a4f]">Evidence required — Premier Inn Luton Airport</div>
          <div className="text-xs text-gray-500 mt-0.5">Upload geo-stamped photos for 8 May job · Britannia Group awaiting</div>
        </div>
        <ChevronRight size={16} className="text-gray-400 shrink-0 mt-1" />
      </div>

      {/* Featured jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black text-[#010a4f] uppercase tracking-widest">Jobs Matched to You</h2>
          <button onClick={() => navigate('/connect/marketplace')}
            className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            See all 6 <ChevronRight size={12} />
          </button>
        </div>
        <div className="space-y-3">
          {FEATURED_JOBS.map(job => (
            <div key={job.site}
              className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm text-[#010a4f]">{job.site}</span>
                  <span className="text-xs text-gray-400">{job.postcode}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                    {job.freq}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{job.fm} · {job.window}</div>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="text-sm font-black text-[#010a4f]">£{job.value}{job.valueFreq}</span>
                  {job.monthlyEst && <span className="text-[10px] text-gray-400">~£{job.monthlyEst.toLocaleString()}/mo</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <MatchRing score={job.matchScore} />
                <button
                  onClick={() => navigate('/connect/marketplace')}
                  className="px-3 py-1.5 rounded-xl text-xs font-black text-white transition-all hover:brightness-110"
                  style={{ background: ORANGE }}>
                  {job.action === 'accept' ? 'Accept →' : 'Apply →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My profile score teaser */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 flex items-center gap-5 cursor-pointer hover:shadow-md transition-all"
        onClick={() => navigate('/connect/reputation')}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black border-4 shrink-0"
          style={{ borderColor: '#10b981', color: '#10b981' }}>
          91
        </div>
        <div className="flex-1">
          <div className="font-black text-[#010a4f]">Your Connect Score</div>
          <div className="text-xs text-gray-500 mt-0.5">Reliability 96 · Evidence 92 · Quality 88</div>
          <div className="mt-2 text-[10px] text-emerald-600 font-bold">Visible to all connected FMs · score qualifies you for 6 jobs</div>
        </div>
        <ChevronRight size={16} className="text-gray-400 shrink-0" />
      </div>

    </div>
  );
}
