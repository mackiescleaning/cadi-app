import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, Building2, Store, Smartphone } from 'lucide-react';

const PORTALS = [
  {
    id: 'fm',
    path: '/fm-demo',
    icon: Building2,
    label: 'FM Operations Portal',
    role: 'Britannia FM — Operations view',
    description: 'Live site monitoring, contract management, operative tracking, QA queue, compliance packs and monthly client reporting.',
    highlights: ['Live ops dashboard', 'Contract & client management', 'Cadi Connect operative network', 'QA & compliance tools'],
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
    role: 'Next Retail UK Ltd — Client view',
    description: 'Real-time visibility of every clean — live GPS tracking, geo-verified photo evidence, SLA reporting and compliance packs.',
    highlights: ['Live activity feed', 'Photo evidence gallery', 'SLA & compliance reports', 'Operative trust profile'],
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.1)',
    accentBorder: 'rgba(16,185,129,0.28)',
    tag: 'Client Portal',
  },
  {
    id: 'operative',
    path: '/connect',
    icon: Smartphone,
    label: 'Operative App',
    role: 'Cadi Connect — Operative view',
    description: 'How cleaners receive matched jobs, check in with GPS, upload geo-verified evidence, and build their portable Connect Score.',
    highlights: ['Job marketplace & matching', 'GPS check-in & evidence upload', 'Connect Score & reputation', 'Payment pipeline'],
    accent: '#C2410C',
    accentBg: 'rgba(194,65,12,0.1)',
    accentBorder: 'rgba(194,65,12,0.28)',
    tag: 'Operative App',
  },
];

export default function DemoLanding() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

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
            <div className="text-white font-black text-sm tracking-tight">Cadi</div>
            <div className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Platform demo</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(194,65,12,0.15)', border: '1px solid rgba(194,65,12,0.3)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-300 text-[10px] font-black tracking-widest uppercase">Live demo · May 2026</span>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10 text-center px-6 pt-10 pb-14">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Shield size={12} className="text-emerald-400" />
          <span className="text-white/50 text-xs font-bold">Prepared exclusively for Britannia FM</span>
        </div>
        <h1 className="text-white font-black text-5xl leading-tight mb-4 tracking-tight">
          The complete Cadi<br />
          <span style={{ background: 'linear-gradient(90deg, #4f78ff, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Connect platform
          </span>
        </h1>
        <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">
          Explore every angle of the platform — from your FM ops view to what your clients and operatives experience.
        </p>
      </div>

      {/* Portal cards */}
      <div className="relative z-10 flex-1 px-8 pb-10">
        <div className="grid grid-cols-3 gap-5 max-w-5xl mx-auto">
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

      {/* Footer */}
      <footer className="relative z-10 text-center px-6 py-7 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <span className="text-white/20 text-xs">© 2026 Cadi · cadi.cleaning</span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-white/20 text-xs">Confidential — prepared for Britannia FM stakeholders</span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-white/20 text-xs">All data in this demo is simulated</span>
        </div>
      </footer>
    </div>
  );
}
