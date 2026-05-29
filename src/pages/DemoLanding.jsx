import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, Building2, Store, Smartphone, Briefcase, Mail, CalendarDays, Link2 } from 'lucide-react';
import CadiWordmark from '../components/CadiWordmark';

const PORTALS = [
  {
    id: 'fm',
    path: '/fm-demo',
    icon: Building2,
    label: 'FM Operations Portal',
    role: 'Britannia Group — Operations view',
    description: 'Live site monitoring, contract management, rota publishing, HR & DBS compliance, area manager dispatch, and payroll — contract and exterior in one place.',
    highlights: ['Contract & exterior workflows', 'Staff & HR management', 'Live check-in map', 'Client portal management'],
    accent: '#4f78ff',
    accentBg: 'rgba(79,120,255,0.12)',
    accentBorder: 'rgba(79,120,255,0.3)',
    tag: 'FM Portal',
  },
  {
    id: 'client',
    path: '/client-demo',
    icon: Store,
    label: 'Client Portal',
    role: 'Mock client data — Asda Stores Ltd',
    description: 'Real-time job status per site — geo-stamped photo evidence confirmed on arrival, SLA tracking and compliance packs your client can view any time.',
    highlights: ['Live job status per site', 'Geo-stamped photo evidence', 'SLA & compliance reports', 'Mobilisation tracker'],
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.1)',
    accentBorder: 'rgba(16,185,129,0.28)',
    tag: 'Client Portal',
  },
  {
    id: 'staff',
    path: '/staff-demo',
    icon: Smartphone,
    label: 'Staff App',
    role: 'Employed cleaner — Contracted staff view',
    description: 'What a PAYE contracted cleaner sees on their phone: assigned rota, geo-stamped check-in, task checklist, photo evidence upload, and pay summary.',
    highlights: ['Assigned rota — no marketplace', 'Geo-stamped check-in', 'Task checklist & photo evidence', 'Pay summary & payslips'],
    accent: '#ea580c',
    accentBg: 'rgba(234,88,12,0.1)',
    accentBorder: 'rgba(234,88,12,0.28)',
    tag: 'Staff App',
  },
  {
    id: 'operative',
    path: '/operative-demo',
    icon: Briefcase,
    label: 'Contractor App',
    role: 'Contractor — exterior jobs view',
    description: 'How verified contractors receive exterior job cards, accept or decline, schedule their visit, upload completion evidence, and submit invoices.',
    highlights: ['Job card notifications', 'Accept or decline jobs', 'Photo evidence & completion', 'Invoice submission'],
    accent: '#6366f1',
    accentBg: 'rgba(99,102,241,0.1)',
    accentBorder: 'rgba(99,102,241,0.28)',
    tag: 'Contractor',
  },
];

export default function DemoLanding() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const [copied,  setCopied]  = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #010a4f 0%, #050d2e 55%, #0a0515 100%)', fontFamily: "'Satoshi', sans-serif" }}>

      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #4f78ff, transparent)', top: '-100px', left: '-100px' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #C2410C, transparent)', bottom: '-50px', right: '-50px' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #10b981, transparent)', top: '40%', left: '50%' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 py-7">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #4f78ff, #010a4f)', border: '1px solid rgba(79,120,255,0.4)' }}>
            C
          </div>
          <div>
            <CadiWordmark height={18} />
            <div className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Platform demo</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
            style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', border: copied ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
            <Link2 size={11} style={{ color: copied ? '#10b981' : 'rgba(255,255,255,0.45)' }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: copied ? '#10b981' : 'rgba(255,255,255,0.45)' }}>
              {copied ? 'Link copied!' : 'Share demo'}
            </span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(194,65,12,0.15)', border: '1px solid rgba(194,65,12,0.3)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-orange-300 text-[10px] font-black tracking-widest uppercase">Live demo · May 2026</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10 text-center px-6 pt-10 pb-14">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Shield size={12} className="text-emerald-400" />
          <span className="text-white/50 text-xs font-bold">Prepared exclusively for Britannia Group</span>
        </div>
        <h1 className="text-white font-black text-5xl leading-tight mb-4 tracking-tight">
          We simplify your workflows and<br />
          <span style={{ background: 'linear-gradient(90deg, #4f78ff, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            connect your clients to your cleaners
          </span>
        </h1>
        <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed mb-8">
          Four perspectives. One connected system. Built for Britannia Group's scale.
        </p>
      </div>

      {/* Portal cards */}
      <div className="relative z-10 px-8 pb-10">
        <div className="grid grid-cols-2 gap-5 max-w-4xl mx-auto">
          {PORTALS.map(portal => {
            const Icon = portal.icon;
            const isHovered = hovered === portal.id;
            return (
              <button
                key={portal.id}
                onClick={() => navigate(portal.path)}
                onMouseEnter={() => setHovered(portal.id)}
                onMouseLeave={() => setHovered(null)}
                className="text-left rounded-3xl p-7 flex flex-col gap-5 transition-all duration-200 group"
                style={{
                  background: isHovered ? `rgba(255,255,255,0.08)` : 'rgba(255,255,255,0.04)',
                  border: isHovered ? `1px solid ${portal.accentBorder}` : '1px solid rgba(255,255,255,0.09)',
                  backdropFilter: 'blur(20px)',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isHovered ? `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${portal.accentBorder}` : 'none',
                }}>

                {/* Icon + tag */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: portal.accentBg, border: `1px solid ${portal.accentBorder}` }}>
                    <Icon size={20} style={{ color: portal.accent }} />
                  </div>
                  <span className="text-[9px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase"
                    style={{ background: portal.accentBg, color: portal.accent, border: `1px solid ${portal.accentBorder}` }}>
                    {portal.tag}
                  </span>
                </div>

                {/* Labels */}
                <div>
                  <div className="text-white font-black text-lg leading-tight mb-1">{portal.label}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: portal.accent }}>{portal.role}</div>
                </div>

                {/* Description */}
                <p className="text-white/45 text-sm leading-relaxed flex-1">{portal.description}</p>

                {/* Highlights */}
                <div className="space-y-2">
                  {portal.highlights.map(h => (
                    <div key={h} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: portal.accent }} />
                      <span className="text-white/50 text-xs">{h}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 pt-2" style={{ color: portal.accent }}>
                  <span className="text-sm font-black">Enter {portal.tag}</span>
                  <ChevronRight size={16} className={`transition-transform duration-200 ${isHovered ? 'translate-x-1' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next Steps CTA */}
      <div className="relative z-10 px-8 pb-10">
        <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(79,120,255,0.25)',
            backdropFilter: 'blur(20px)',
          }}>
          <div className="px-8 py-7 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Ready to move forward?</span>
              </div>
              <div className="text-white font-black text-xl leading-tight mb-2">
                See this live for Britannia's actual workflows
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-lg">
                This demo is a snapshot. A discovery call lets us map Cadi to Britannia's specific regions, clients, and contractor pool — and give you a realistic rollout timeline.
              </p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="mailto:hello@cadi.cleaning?subject=Britannia Group — Cadi discovery call&body=Hi Rhianna,%0A%0AWe've reviewed the Cadi demo and would like to discuss a rollout for Britannia Group.%0A%0ABest regards"
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm text-white no-underline transition-all"
                style={{
                  background: 'linear-gradient(135deg, #4f78ff, #6366f1)',
                  boxShadow: '0 8px 32px rgba(79,120,255,0.35)',
                  textDecoration: 'none',
                }}>
                <Mail size={15} />
                Book a discovery call
              </a>
              <a
                href="mailto:hello@cadi.cleaning?subject=Britannia Group — Cadi questions"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.55)',
                  textDecoration: 'none',
                }}>
                <CalendarDays size={14} />
                Ask a question first
              </a>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{
                  background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  color: copied ? '#10b981' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}>
                <Link2 size={14} />
                {copied ? 'Link copied!' : 'Share this demo'}
              </button>
            </div>
          </div>
          <div className="px-8 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-white/20 text-[10px]">hello@cadi.cleaning</span>
            <span className="text-white/10">·</span>
            <span className="text-white/20 text-[10px]">cadi.cleaning</span>
            <span className="text-white/10">·</span>
            <span className="text-white/20 text-[10px]">Typically responds within 2 hours</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center px-6 py-7 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <span className="text-white/20 text-xs">© 2026 Cadi · cadi.cleaning</span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-white/20 text-xs">Confidential — prepared for Britannia Group stakeholders</span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-white/20 text-xs">All data in this demo is simulated</span>
        </div>
      </footer>
    </div>
  );
}
