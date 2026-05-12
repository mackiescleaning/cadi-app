import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { listLeaderboard } from '../lib/db/leaderboardDb';

const EARN_ORANGE = '#C2410C';

function ScoreBadge({ score }) {
  const tier =
    score >= 90 ? { label: 'Elite',     color: '#f59e0b' } :
    score >= 75 ? { label: 'Advanced',  color: '#059669' } :
    score >= 55 ? { label: 'Solid',     color: '#4f78ff' } :
                  { label: 'Building',  color: '#6b7280' };
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-black"
        style={{ borderColor: tier.color, color: tier.color }}>
        {score}
      </div>
      <div>
        <div className="text-xs font-black" style={{ color: tier.color }}>{tier.label}</div>
        <div className="text-[10px] text-gray-400">Cadi score</div>
      </div>
    </div>
  );
}

export default function PublicProfilePreview() {
  const { user, profile } = useAuth();
  const [settings, setSettings]     = useState(null);
  const [score, setScore]           = useState(0);
  const [rank, setRank]             = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: biz }, leaderboard] = await Promise.all([
        supabase.from('business_settings').select('setup_data,vat_registered,hourly_rate').eq('owner_id', user.id).single(),
        listLeaderboard(),
      ]);
      setSettings(biz);
      const entry = leaderboard?.find(e => e.owner_id === user.id);
      if (entry) {
        setScore(entry.score || 0);
        const idx = leaderboard.findIndex(e => e.owner_id === user.id);
        setRank(idx >= 0 ? idx + 1 : null);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-[#99c5ff]/20 p-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    );
  }

  const bizName    = profile?.business_name || profile?.first_name || 'Your Business';
  const postcode   = profile?.postcode || settings?.setup_data?.postcode || '';
  const services   = settings?.setup_data?.services || [];
  const sectors    = settings?.setup_data?.cleanerSectors || [];
  const accreditations = settings?.setup_data?.accreditations || [];
  const logoUrl    = settings?.setup_data?.logo_url || '';
  const hourlyRate = settings?.hourly_rate || 0;

  const sectorLabels = { residential: 'Residential', commercial: 'Commercial', exterior: 'Exterior' };

  return (
    <div className="rounded-2xl bg-white border border-[#99c5ff]/20 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="text-xs font-black text-gray-400 uppercase tracking-wider">FM view — your public profile</div>
        <div className="text-[10px] px-2.5 py-1 rounded-full font-bold"
          style={{ backgroundColor: EARN_ORANGE + '15', color: EARN_ORANGE }}>
          Preview
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Identity row */}
        <div className="flex items-start gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-14 h-14 rounded-xl object-contain bg-gray-50 border border-gray-100 p-1 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#010a4f] flex items-center justify-center text-white text-xl font-black shrink-0">
              {bizName[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-[#010a4f] text-lg leading-tight truncate">{bizName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {postcode && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span>📍</span> {postcode}
                </span>
              )}
              {sectors.slice(0, 2).map(s => (
                <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4ff] text-[#4f78ff]">
                  {sectorLabels[s] || s}
                </span>
              ))}
            </div>
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cadi rank',   value: rank ? `#${rank}` : '—' },
            { label: 'Hourly rate', value: hourlyRate ? `£${hourlyRate}/hr` : '—' },
            { label: 'Verified',    value: settings?.setup_data ? 'Yes' : 'Pending' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-[#f8faff]">
              <div className="text-base font-black text-[#010a4f]">{value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Services offered</div>
            <div className="flex flex-wrap gap-1.5">
              {services.slice(0, 8).map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">{s}</span>
              ))}
              {services.length > 8 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">+{services.length - 8} more</span>
              )}
            </div>
          </div>
        )}

        {/* Accreditations */}
        {accreditations.length > 0 && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Accreditations</div>
            <div className="flex flex-wrap gap-1.5">
              {accreditations.map(a => (
                <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center gap-1">
                  <span>✓</span> {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Score prompt */}
        {score < 75 && (
          <div className="rounded-xl p-4 border" style={{ backgroundColor: EARN_ORANGE + '08', borderColor: EARN_ORANGE + '30' }}>
            <p className="text-xs font-bold" style={{ color: EARN_ORANGE }}>
              Improve your score to unlock premium FM jobs
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              FMs filter by score. Reach 75+ to access the top job tier.
              Use your Run and Grow tabs to push your number up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
