import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaff } from '../context/StaffContext';
import {
  MapPin, Clock, CheckCircle, LogOut, Calendar,
  Phone, Key, AlertCircle, Users, ChevronLeft,
  ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Theme ────────────────────────────────────────────────────────────────────
const TYPE_THEME = {
  residential: { bar: '#10B981', fill: '#ECFDF5', ink: '#064E3B', dot: 'bg-emerald-500', label: 'Residential' },
  commercial:  { bar: '#1F48FF', fill: '#EEF2FF', ink: '#1E3A8A', dot: 'bg-blue-600',    label: 'Commercial'  },
  exterior:    { bar: '#F97316', fill: '#FFF4E6', ink: '#7C2D12', dot: 'bg-orange-500',   label: 'Exterior'    },
};

const CREW_PALETTE = ['#F97316','#10B981','#1F48FF','#7C3AED','#EC4899','#0891B2','#EA580C','#059669'];
function tintForName(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CREW_PALETTE[Math.abs(h) % CREW_PALETTE.length];
}

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function isoDate(d) { return d.toISOString().split('T')[0]; }

function fmtTime(h) {
  const hr = Math.floor(h);
  const m  = Math.round((h - hr) * 60);
  return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function parseHour(job) {
  if (job.startHour != null) return +job.startHour;
  if (job.startTime) {
    const [h, m] = job.startTime.split(':').map(Number);
    return h + m / 60;
  }
  return 9;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime())    return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Demo jobs (week-relative so they always show correctly) ──────────────────
function buildDemoJobs(staffName) {
  const sn = staffName || 'Sarah';
  const mon = getMonday(new Date());
  const dateFor = (dayIdx) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + dayIdx);
    return isoDate(d);
  };
  return [
    { id:1,  customer:'Davies',               type:'residential', service:'Deep clean',        postcode:'SW2 1AA',  startHour:9.00,  durationHrs:2.5, price:140, status:'complete',  assignees:[sn],          notes:'Key under mat. Dog in kitchen.', date:dateFor(0) },
    { id:2,  customer:'Wilson',               type:'residential', service:'Regular clean',     postcode:'SW3 2BB',  startHour:13.00, durationHrs:2.0, price:65,  status:'scheduled', assignees:[sn],          notes:'Ring doorbell. Pay by BACS.', date:dateFor(0) },
    { id:3,  customer:'Patel — End of Tenancy', type:'residential', service:'End of tenancy', postcode:'SE5 3CC',  startHour:9.00,  durationHrs:4.0, price:280, status:'scheduled', assignees:[sn,'Mia'],    notes:'Collect keys from letting agent on High St.', date:dateFor(1) },
    { id:4,  customer:'Adams',                type:'residential', service:'Deep clean',        postcode:'SW4 1DD',  startHour:10.00, durationHrs:3.0, price:175, status:'scheduled', assignees:[sn],          notes:'Access code: 4821. Let yourself in.', date:dateFor(2) },
    { id:5,  customer:'Greenfield Office',    type:'commercial',  service:'Evening clean',     postcode:'SW6 3FF',  startHour:16.00, durationHrs:2.5, price:120, status:'scheduled', assignees:[sn,'Tom'],    notes:'Sign in at reception. Keys at desk.', date:dateFor(2) },
    { id:6,  customer:'Miller',               type:'residential', service:'Regular clean',     postcode:'SW8 2EE',  startHour:9.00,  durationHrs:2.0, price:70,  status:'scheduled', assignees:[sn],          notes:'Always home — ring bell.', date:dateFor(3) },
    { id:7,  customer:'Barnes',               type:'residential', service:'Regular clean',     postcode:'SW9 1GG',  startHour:10.00, durationHrs:2.0, price:65,  status:'scheduled', assignees:[sn],          notes:'', date:dateFor(4) },
    { id:8,  customer:'Henderson',            type:'residential', service:'Deep clean',        postcode:'SW10 9HH', startHour:13.00, durationHrs:3.0, price:160, status:'scheduled', assignees:[sn,'Mia'],    notes:'Lockbox at gate: 7291.', date:dateFor(4) },
  ];
}

// ─── Teammate chips ───────────────────────────────────────────────────────────
function TeammateChips({ assignees, myName }) {
  const others = (assignees || []).filter(a => a !== myName);
  if (others.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      <Users size={10} className="text-[#99c5ff] flex-shrink-0" />
      {others.map(name => (
        <span
          key={name}
          className="flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ background: tintForName(name) }}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black">
            {name.charAt(0)}
          </span>
          {name.split(' ')[0]}
        </span>
      ))}
    </div>
  );
}

// ─── Job card (expandable) ────────────────────────────────────────────────────
function JobCard({ job, myName, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const t = TYPE_THEME[job.type] || TYPE_THEME.residential;
  const startHour = parseHour(job);
  const endHour   = startHour + (job.durationHrs || 1);
  const isDone    = job.status === 'complete' || job.status === 'completed';
  const isActive  = job.status === 'in-progress';

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      isDone   ? 'border-emerald-200 bg-white/80' :
      isActive ? 'border-amber-300 bg-white' :
      'border-[#99c5ff]/30 bg-white'
    }`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          {/* Time block */}
          <div
            className="w-12 shrink-0 rounded-xl flex flex-col items-center justify-center py-2 gap-0.5"
            style={{ background: t.fill, borderLeft: `3px solid ${t.bar}` }}
          >
            <span className="text-[10px] font-bold tabular-nums leading-none" style={{ color: t.ink }}>{fmtTime(startHour)}</span>
            <span className="text-[9px] opacity-50 leading-none" style={{ color: t.ink }}>↓</span>
            <span className="text-[10px] font-bold tabular-nums leading-none" style={{ color: t.ink }}>{fmtTime(endHour)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm text-[#010a4f] leading-tight ${isDone ? 'line-through opacity-50' : ''}`}>
              {job.customer}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{job.service}</p>
            <TeammateChips assignees={job.assignees} myName={myName} />
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-sm font-black text-emerald-600">£{job.price}</span>
            {isDone && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle size={9} /> Done
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                In progress
              </span>
            )}
            {!isDone && !isActive && (
              expanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {job.postcode && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-[#1f48ff] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#010a4f]">
                  {[job.address_line1, job.town, job.postcode].filter(Boolean).join(', ') || job.postcode}
                </p>
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(job.postcode)}`}
                  target="_blank" rel="noreferrer"
                  className="text-[11px] text-[#1f48ff] hover:underline mt-0.5 block"
                >Open in Maps →</a>
              </div>
            </div>
          )}
          {job.phone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-[#1f48ff] flex-shrink-0" />
              <a href={`tel:${job.phone}`} className="text-xs text-[#010a4f] hover:text-[#1f48ff]">{job.phone}</a>
            </div>
          )}
          {job.notes && (
            <div className="flex items-start gap-2">
              <Key size={14} className="text-[#1f48ff] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 leading-relaxed">{job.notes}</p>
            </div>
          )}

          {!isDone && (
            <div className="flex gap-2 pt-1">
              {job.status === 'scheduled' && (
                <button
                  onClick={() => onStatusChange(job.id, 'in-progress')}
                  className="flex-1 py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                  Start Job
                </button>
              )}
              <button
                onClick={() => onStatusChange(job.id, 'complete')}
                className="flex-1 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={13} /> Mark Complete
              </button>
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
              <CheckCircle size={14} className="text-emerald-500" />
              <p className="text-xs font-semibold text-emerald-700">Job completed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Week grid — day selector + expandable job list ───────────────────────────
function WeekGrid({ weekDates, jobs, myName, onStatusChange }) {
  const todayStr = isoDate(new Date());
  const [expandedDay, setExpandedDay] = useState(() => {
    const idx = weekDates.findIndex(d => isoDate(d) === todayStr);
    return idx >= 0 ? idx : 0;
  });

  return (
    <div className="space-y-3">
      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d, i) => {
          const ds       = isoDate(d);
          const isToday  = ds === todayStr;
          const isActive = expandedDay === i;
          const dayJobs  = jobs.filter(j => j.date === ds);
          const doneCount = dayJobs.filter(j => j.status === 'complete' || j.status === 'completed').length;
          const allDone  = dayJobs.length > 0 && doneCount === dayJobs.length;

          return (
            <button
              key={i}
              onClick={() => setExpandedDay(isActive ? -1 : i)}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                isActive && isToday ? 'bg-[#010a4f]' :
                isActive           ? 'bg-[#1f48ff]' :
                isToday            ? 'bg-[#f0f4ff] border border-[#1f48ff]/30' :
                'bg-white border border-transparent hover:border-[#99c5ff]/30'
              }`}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wide ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                {DAYS[i]}
              </span>
              <span className={`text-base font-black leading-tight ${
                isActive ? 'text-white' : isToday ? 'text-[#1f48ff]' : 'text-[#010a4f]'
              }`}>
                {d.getDate()}
              </span>
              <span className={`text-[9px] font-bold mt-0.5 leading-none ${
                isActive ? 'text-white/70' :
                allDone  ? 'text-emerald-600' :
                dayJobs.length > 0 ? 'text-[#1f48ff]' :
                'text-gray-200'
              }`}>
                {dayJobs.length > 0 ? (allDone ? '✓' : dayJobs.length) : '·'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded day */}
      {expandedDay >= 0 && expandedDay < weekDates.length && (() => {
        const d       = weekDates[expandedDay];
        const ds      = isoDate(d);
        const dayJobs = jobs.filter(j => j.date === ds).sort((a,b) => parseHour(a) - parseHour(b));
        const label   = formatDateLabel(ds);
        const rev     = dayJobs.reduce((s,j) => s + (j.price || 0), 0);
        return (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-bold text-[#010a4f]">{label}</p>
              {rev > 0 && <p className="text-xs font-black text-emerald-600">£{rev} day value</p>}
            </div>
            {dayJobs.length === 0 ? (
              <div className="bg-white/70 rounded-2xl border border-[#99c5ff]/20 px-4 py-8 text-center">
                <p className="text-sm font-bold text-[#010a4f]">Rest day</p>
                <p className="text-xs text-gray-400 mt-1">Nothing scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayJobs.map(job => (
                  <JobCard key={job.id} job={job} myName={myName} onStatusChange={onStatusChange} />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { staffMember, logoutStaff } = useStaff();
  const navigate = useNavigate();

  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab,  setActiveTab]  = useState('week');
  const [jobs,       setJobs]       = useState(() => buildDemoJobs(staffMember?.name));

  const weekDates = useMemo(() => {
    const mon = getMonday(new Date());
    mon.setDate(mon.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  if (!staffMember) {
    navigate('/staff-login');
    return null;
  }

  const todayStr    = isoDate(new Date());
  const weekStart   = isoDate(weekDates[0]);
  const weekEnd     = isoDate(weekDates[6]);

  // Filter jobs assigned to this staff member by name
  const myJobs    = jobs.filter(j =>
    (j.assignees || []).includes(staffMember.name) || j.assignee === staffMember.name
  );
  const weekJobs  = myJobs.filter(j => j.date >= weekStart && j.date <= weekEnd);
  const todayJobs = myJobs.filter(j => j.date === todayStr).sort((a,b) => parseHour(a) - parseHour(b));

  const weekHours    = weekJobs.reduce((s,j) => s + (j.durationHrs || 0), 0);
  const weekEarnings = weekHours * (staffMember.hourlyRate || 12);
  const todayDone    = todayJobs.filter(j => j.status === 'complete' || j.status === 'completed').length;

  const weekLabel = weekOffset === 0 ? 'This week'
    : weekOffset === 1  ? 'Next week'
    : weekOffset === -1 ? 'Last week'
    : `${weekDates[0].getDate()} ${weekDates[0].toLocaleString('en-GB',{month:'short'})} – ${weekDates[6].getDate()} ${weekDates[6].toLocaleString('en-GB',{month:'short'})}`;

  const handleStatusChange = (jobId, newStatus) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
  };

  const handleLogout = () => {
    logoutStaff();
    navigate('/staff-login');
  };

  const TABS = [
    { id: 'week',  label: 'My Week' },
    { id: 'today', label: 'Today'   },
    { id: 'pay',   label: 'My Pay'  },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4ff]">

      {/* Header */}
      <div className="bg-[#010a4f] px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm ${staffMember.color || 'bg-[#1f48ff]'}`}>
                {staffMember.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div>
                <p className="text-white font-black">{staffMember.name}</p>
                <p className="text-[#99c5ff] text-xs">{staffMember.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-[#99c5ff] text-xs font-semibold rounded-xl hover:bg-white/20 transition-colors"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Today",
                value: `${todayDone}/${todayJobs.length}`,
                sub: todayJobs.length === 0 ? 'No jobs' : todayDone === todayJobs.length ? 'All done!' : `${todayJobs.length - todayDone} to go`,
              },
              {
                label: 'This week',
                value: weekJobs.length,
                sub: `${weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1)} hrs`,
              },
              {
                label: 'Est. pay',
                value: `£${Math.round(weekEarnings)}`,
                sub: `£${staffMember.hourlyRate || 12}/hr`,
              },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-black text-lg leading-tight">{value}</p>
                <p className="text-[#99c5ff] text-[10px] mt-0.5">{label}</p>
                <p className="text-white/40 text-[9px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl shadow-sm border border-[#99c5ff]/20">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === id ? 'bg-[#1f48ff] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── MY WEEK ── */}
        {activeTab === 'week' && (
          <div className="space-y-3">
            {/* Week navigator */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                className="p-2 rounded-xl bg-white border border-[#99c5ff]/20 text-gray-500 hover:text-[#1f48ff] hover:border-[#1f48ff]/30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <p className="text-sm font-black text-[#010a4f]">{weekLabel}</p>
                <p className="text-[10px] text-gray-400">
                  {weekJobs.length} job{weekJobs.length !== 1 ? 's' : ''} · £{weekJobs.reduce((s,j) => s + (j.price||0), 0)}
                </p>
              </div>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                className="p-2 rounded-xl bg-white border border-[#99c5ff]/20 text-gray-500 hover:text-[#1f48ff] hover:border-[#1f48ff]/30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <WeekGrid
              weekDates={weekDates}
              jobs={weekJobs}
              myName={staffMember.name}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {/* ── TODAY ── */}
        {activeTab === 'today' && (
          <div className="space-y-3">
            {todayJobs.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-2xl border border-[#99c5ff]/20">
                <div className="w-14 h-14 bg-[#f0f4ff] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar size={24} className="text-[#1f48ff]" />
                </div>
                <p className="font-bold text-[#010a4f]">No jobs today</p>
                <p className="text-sm text-gray-400 mt-1">Check My Week for your upcoming schedule</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                  {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} today · £{todayJobs.reduce((s,j)=>s+(j.price||0),0)}
                </p>
                {todayJobs.map(job => (
                  <JobCard key={job.id} job={job} myName={staffMember.name} onStatusChange={handleStatusChange} />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── MY PAY ── */}
        {activeTab === 'pay' && (
          <div className="space-y-4">
            <div className="bg-[#010a4f] rounded-2xl p-5 text-white">
              <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-4">{weekLabel}</p>
              <div className="space-y-3">
                {[
                  { label: 'Jobs scheduled',  value: weekJobs.length },
                  { label: 'Hours scheduled', value: `${weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1)} hrs` },
                  { label: 'Hourly rate',     value: `£${staffMember.hourlyRate || 12}/hr` },
                  { label: 'Estimated pay',   value: `£${Math.round(weekEarnings)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-white/10 last:border-0 text-sm">
                    <span className="text-white/60">{label}</span>
                    <span className="font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Estimates are based on scheduled hours at your agreed hourly rate. Actual pay is confirmed by your manager — speak to them for payslip queries.
                </p>
              </div>
            </div>

            {/* Job breakdown */}
            <div className="bg-white rounded-2xl border border-[#99c5ff]/20 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Job breakdown</p>
              </div>
              {weekJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No jobs this week</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {weekJobs
                    .sort((a,b) => a.date.localeCompare(b.date) || parseHour(a) - parseHour(b))
                    .map(job => (
                      <div key={job.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#010a4f] truncate">{job.customer}</p>
                          <p className="text-xs text-gray-400">{formatDateLabel(job.date)} · {fmtTime(parseHour(job))}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#1f48ff]">
                            £{((job.durationHrs || 0) * (staffMember.hourlyRate || 12)).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">{job.durationHrs}hrs</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
