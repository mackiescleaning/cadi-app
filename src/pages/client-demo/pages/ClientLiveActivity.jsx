const TIMELINE = [
  { time: '06:00', label: 'Clean scheduled to begin',         status: 'done',       icon: '📋', note: null },
  { time: '06:58', label: 'Operative arrived on site',        status: 'done',       icon: '📍', note: 'Arrived within SLA window' },
  { time: '07:09', label: 'Evidence — Main entrance (before)',status: 'done',       icon: '📷', note: null },
  { time: '07:11', label: 'Evidence — Reception (before)',    status: 'done',       icon: '📷', note: null },
  { time: '07:33', label: 'Evidence — Main entrance (after)', status: 'done',       icon: '✅', note: null },
  { time: '07:41', label: 'Evidence — Toilets (after)',       status: 'done',       icon: '✅', note: null },
  { time: '07:52', label: 'Evidence — Corridor A (after)',    status: 'done',       icon: '✅', note: null },
  { time: '07:58', label: 'Evidence — Reception (after)',     status: 'done',       icon: '✅', note: null },
  { time: '08:00', label: 'Clean expected complete',          status: 'current',    icon: '⏳', note: 'Awaiting final sign-off' },
  { time: '08:00', label: 'SLA window closes',                status: 'upcoming',   icon: '🔔', note: 'SLA met ✓' },
];

const WEEK = [
  { day: 'Mon', date: '5 May',  done: true,  time: '07:42', photos: 12, sla: true  },
  { day: 'Tue', date: '6 May',  done: true,  time: '07:39', photos: 11, sla: true  },
  { day: 'Wed', date: '7 May',  done: true,  time: '07:51', photos: 9,  sla: true  },
  { day: 'Thu', date: '8 May',  done: true,  time: '07:44', photos: 14, sla: true  },
  { day: 'Fri', date: '9 May',  done: false, time: null,    photos: 4,  sla: null, inProgress: true },
];

const UPCOMING = [
  { date: 'Mon 12 May', service: 'Morning clean', window: '06:00–08:00' },
  { date: 'Tue 13 May', service: 'Morning clean', window: '06:00–08:00' },
  { date: 'Wed 14 May', service: 'Morning clean', window: '06:00–08:00' },
  { date: 'Thu 15 May', service: 'Morning clean', window: '06:00–08:00' },
  { date: 'Fri 16 May', service: 'Morning clean', window: '06:00–08:00' },
  { date: 'Sat 17 May', service: 'Periodic deep clean', window: '08:00–12:00' },
];

export default function ClientLiveActivity({ showToast }) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Live status banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl shrink-0 animate-pulse">
          ⏳
        </div>
        <div className="flex-1">
          <div className="font-bold text-blue-900">Morning clean in progress</div>
          <div className="text-sm text-blue-700 mt-0.5">Operative on site since 06:58 · 6 photos uploaded · expected out by 08:00</div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-blue-600">SLA window: 06:00–08:00</span>
            <span className="text-xs font-bold text-emerald-600">✓ SLA on track</span>
          </div>
        </div>
      </div>

      {/* Today's timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Today — 9 May 2026</div>
        </div>
        <div className="p-5">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-4">
              {TIMELINE.map(({ time, label, status, icon, note }, i) => (
                <div key={i} className="flex items-start gap-4 pl-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 z-10 relative ${
                    status === 'done'     ? 'bg-emerald-50 border border-emerald-200' :
                    status === 'current'  ? 'bg-blue-50 border-2 border-blue-400' :
                    'bg-gray-50 border border-gray-200'
                  }`}>
                    {status === 'done' ? <span className="text-[10px] text-emerald-600">✓</span> : <span className="text-xs">{icon}</span>}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[11px] font-bold text-gray-400 shrink-0">{time}</span>
                      <span className={`text-sm font-medium ${
                        status === 'done' ? 'text-[#010a4f]' :
                        status === 'current' ? 'text-blue-700 font-bold' :
                        'text-gray-400'
                      }`}>{label}</span>
                    </div>
                    {note && (
                      <div className={`text-xs ml-14 mt-0.5 ${
                        status === 'done' ? 'text-emerald-600' :
                        status === 'current' ? 'text-blue-600' :
                        'text-gray-400'
                      }`}>{note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* This week */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">This week</div>
        <div className="space-y-3">
          {WEEK.map(({ day, date, done, time, photos, sla, inProgress }) => (
            <div key={day} className="flex items-center gap-4">
              <div className="w-10 shrink-0">
                <div className="text-xs font-black text-gray-400">{day}</div>
                <div className="text-[10px] text-gray-300">{date.split(' ')[0]}</div>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                inProgress ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                done       ? 'bg-emerald-100 text-emerald-700' :
                             'bg-gray-100 text-gray-300'
              }`}>
                {inProgress ? '→' : done ? '✓' : '·'}
              </div>
              <div className="flex-1 text-sm text-[#010a4f] font-medium">Morning clean</div>
              {time && <div className="text-xs text-gray-400">Done {time}</div>}
              {photos > 0 && <div className="text-xs text-gray-400">{photos} photos</div>}
              {sla === false && <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Late</div>}
              {inProgress && <div className="text-xs text-blue-600 font-bold">In progress</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Coming up</div>
        <div className="space-y-2">
          {UPCOMING.map(({ date, service, window }) => (
            <div key={date} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid #f9fafb' }}>
              <div className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
              <div className="text-xs font-bold text-gray-500 w-24 shrink-0">{date}</div>
              <div className="text-sm font-medium text-[#010a4f] flex-1">{service}</div>
              <div className="text-xs text-gray-400">{window}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <button onClick={() => showToast('view full job history')}
          className="text-sm font-bold text-[#4f78ff] hover:text-[#1f48ff] transition-colors">
          View full job history →
        </button>
      </div>
    </div>
  );
}
