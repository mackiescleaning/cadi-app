export default function ClientSiteDashboard({ showToast, onNavigate }) {
  const WEEK = [
    { day: 'Mon', date: '5 May', done: true,  time: '07:42', photos: 12 },
    { day: 'Tue', date: '6 May', done: true,  time: '07:39', photos: 11 },
    { day: 'Wed', date: '7 May', done: true,  time: '07:51', photos: 9  },
    { day: 'Thu', date: '8 May', done: true,  time: '07:44', photos: 14 },
    { day: 'Fri', date: '9 May', done: false, time: null,    photos: 0, inProgress: true },
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Welcome */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="text-sm text-gray-400 mb-1">Good morning</div>
        <h1 className="text-xl font-black text-[#010a4f]">Next – Luton The Mall</h1>
        <p className="text-sm text-gray-500 mt-1">Asda Stores Ltd · Managed by Britannia Group</p>
      </div>

      {/* Today's status */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-xl shrink-0">✅</div>
        <div>
          <div className="font-bold text-emerald-800">Morning clean in progress</div>
          <div className="text-sm text-emerald-700 mt-0.5">Your cleaner arrived at 06:58 · 4 photos uploaded so far</div>
          <div className="text-xs text-emerald-600 mt-1">Expected completion by 08:00 · SLA window 06:00–08:00</div>
        </div>
      </div>

      {/* This week */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">This week</h2>
        <div className="space-y-3">
          {WEEK.map(({ day, date, done, time, photos, inProgress }) => (
            <div key={day} className="flex items-center gap-4">
              <div className="w-10 text-center">
                <div className="text-xs font-black text-gray-400">{day}</div>
                <div className="text-[10px] text-gray-300">{date.split(' ')[0]}</div>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                inProgress ? 'bg-blue-100 text-blue-700' :
                done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-300'
              }`}>
                {inProgress ? '→' : done ? '✓' : '·'}
              </div>
              <div className="flex-1 text-sm text-[#010a4f]">Morning clean</div>
              {time && <div className="text-xs text-gray-400">Completed {time}</div>}
              {photos > 0 && <div className="text-xs text-gray-400">{photos} photos</div>}
              {inProgress && <div className="text-xs text-blue-600 font-medium">In progress</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Report an issue', icon: '⚠️', action: () => onNavigate('issue') },
          { label: 'Request extra work', icon: '📋', action: () => showToast('submit additional work request') },
          { label: 'Download report', icon: '📄', action: () => showToast('download monthly cleaning report') },
        ].map(({ label, icon, action }) => (
          <button key={label} onClick={action}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-[#4f78ff]/30 hover:shadow-md transition-all">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
          </button>
        ))}
      </div>

      {/* Contract info */}
      <div className="bg-[#f8faff] rounded-2xl border border-[#99c5ff]/20 p-5">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Your contract</h2>
        <div className="space-y-2">
          {[
            { label: 'Service',       value: 'Daily morning clean — Mon–Fri' },
            { label: 'Time window',   value: '06:00–08:00' },
            { label: 'Your operative', value: 'Your assigned operative' },
            { label: 'Contract value', value: '£1,800/month' },
            { label: 'FM contact',    value: 'Britannia Group · 0800 123 4567' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-medium text-[#010a4f] text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
