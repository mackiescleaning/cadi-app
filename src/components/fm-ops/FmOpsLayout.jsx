import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Send, Calendar,
  CheckCircle2, Receipt, ChevronLeft, Building2, LogOut, UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const NAVY    = '#010a4f';
const INK     = '#0f172a';
const SUB     = '#64748b';
const MUTE    = '#94a3b8';
const LINE    = '#e2e8f0';
const PAPER   = '#ffffff';
const BG      = '#f8faff';
const ACCENT  = '#C2410C';

const SCREENS = [
  { path: 'overview',    label: 'Overview',          icon: LayoutDashboard },
  { path: 'contracts',   label: 'Contracts',         icon: FileText        },
  { path: 'sites',       label: 'Sites / Job Cards', icon: ClipboardList   },
  { path: 'contractors', label: 'Contractors',       icon: Users           },
  { path: 'marketplace', label: 'Marketplace',       icon: Send            },
  { path: 'schedule',    label: 'Schedule',          icon: Calendar        },
  { path: 'approval',    label: 'Work approval',     icon: CheckCircle2    },
  { path: 'accounts',    label: 'Accounts inbox',    icon: Receipt         },
  { path: 'team',        label: 'Team',              icon: UserPlus        },
];

function NoFmAccess() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 480, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <Building2 size={26} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: INK, marginBottom: 6 }}>FM Ops Portal</h1>
        <p style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginBottom: 22 }}>
          This portal is for facilities-management partners co-ordinating sub-contractor networks.
          Your account isn't linked to an FM organisation yet — speak to your Cadi partner manager to get set up.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: NAVY, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}
        >
          ← Back to Cadi
        </button>
      </div>
    </div>
  );
}

function FmOpsLoader() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 12, color: SUB, fontWeight: 700 }}>Loading FM Ops…</div>
    </div>
  );
}

export default function FmOpsLayout() {
  const { user, profile, profileLoading } = useAuth();
  const [orgName, setOrgName] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.fm_organisation_id) return;
    let cancelled = false;
    supabase
      .from('fm_organisations')
      .select('id, name')
      .eq('id', profile.fm_organisation_id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setOrgName(data?.name ?? null); });
    return () => { cancelled = true; };
  }, [profile?.fm_organisation_id]);

  if (profileLoading) return <FmOpsLoader />;
  if (!user) return <FmOpsLoader />;
  if (!profile?.fm_organisation_id) return <NoFmAccess />;

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: NAVY, color: 'white',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)' }}>CADI · FM OPS</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'white', marginTop: 6, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {orgName ?? 'Your organisation'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SCREENS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/fm-ops/${path}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                fontSize: 12.5, fontWeight: 700,
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                background: isActive ? `${ACCENT}` : 'transparent',
                textDecoration: 'none',
              })}
            >
              <Icon size={14} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 8,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <ChevronLeft size={12} /> Back to Cadi
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'transparent',
              color: 'rgba(255,255,255,0.45)', border: 'none', borderRadius: 8,
              fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 4,
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1280 }}>
        <Outlet />
      </main>
    </div>
  );
}

export const FM_OPS_TOKENS = { NAVY, INK, SUB, MUTE, LINE, PAPER, BG, ACCENT };
