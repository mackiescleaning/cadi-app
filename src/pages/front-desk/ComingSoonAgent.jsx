// src/pages/front-desk/ComingSoonAgent.jsx
// Placeholder shown for Front Desk agents that aren't shipping at launch.

import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function ComingSoonAgent({ icon: Icon = Sparkles, accent = '#4f78ff', name, tagline, bullets = [] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div
        className="rounded-2xl p-8 border bg-white shadow-sm"
        style={{ borderColor: accent + '55' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: accent + '1a', color: accent }}
          >
            <Icon size={24} />
          </div>
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-full"
            style={{ backgroundColor: accent + '1a', color: accent }}
          >
            Coming soon
          </span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">{name}</h1>
        <p className="text-slate-600 mb-6 leading-relaxed">{tagline}</p>

        {bullets.length > 0 && (
          <ul className="space-y-2 mb-6">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="font-bold" style={{ color: accent }}>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          <Link
            to="/front-desk"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:opacity-80"
          >
            Back to Inbox <ArrowRight size={14} />
          </Link>
          <span className="text-xs text-slate-500">
            We'll notify you when this agent launches.
          </span>
        </div>
      </div>
    </div>
  );
}
