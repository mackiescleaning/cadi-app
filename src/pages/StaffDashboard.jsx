import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaff } from '../context/StaffContext';
import {
  MapPin, Clock, PoundSterling, CheckCircle,
  Circle, LogOut, BookOpen, Calendar, ChevronRight,
  Phone, Key, AlertCircle, Star, Zap
} from 'lucide-react';

// Sample jobs assigned to staff
const ALL_JOBS = [
  {
    id: 1, client: 'Sarah Johnson',
    address: '14 Maple Street, Southend-on-Sea, SS1 2AB',
    phone: '07712 345678',
    access: 'Key holder — key #3. Dog at home.',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00', duration: 2, price: 70,
    type: 'Residential', status: 'scheduled',
    assignedTo: [1, 2],
  },
  {
    id: 2, client: 'James & Karen Wright',
    address: '7 Oak Avenue, Rayleigh, SS6 8CD',
    phone: '07890 123456',
    access: 'Lockbox code: 4821',
    date: new Date().toISOString().split('T')[0],
    startTime: '11:30', duration: 1.5, price: 55,
    type: 'Residential', status: 'scheduled',
    assignedTo: [1],
  },
  {
    id: 3, client: 'The Patel Family',
    address: '23 Cedar Close, Basildon, SS14 1EF',
    phone: '07654 987321',
    access: 'Always home — ring doorbell',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '10:00', duration: 3, price: 90,
    type: 'Residential', status: 'scheduled',
    assignedTo: [1],
  },
  {
    id: 4, client: 'Commercial Office Ltd',
    address: '42 High Street, Basildon, SS14 1AB',
    phone: '01268 000000',
    access: 'Sign in at reception. Ask for key.',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '14:00', duration: 3, price: 150,
    type: 'Commercial', status: 'scheduled',
    assignedTo: [2],
  },
  {
    id: 5, client: 'EOT — New Client',
    address: '8 Birch Road, Chelmsford, CM1 1AA',
    phone: '07500 111222',
    access: 'Collect keys from letting agent on High Street',
    date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    startTime: '09:00', duration: 5, price: 220,
    type: 'End of Tenancy', status: 'scheduled',
    assignedTo: [1, 2],
  },
];

const UNASSIGNED_JOBS = [
  {
    id: 6, client: 'Mrs Thompson',
    address: '3 Pine Close, Rochford, SS4 1BB',
    date: new Date(Date.now() + 259200000).toISOString().split('T')[0],
    startTime: '09:00', duration: 2, price: 65,
    type: 'Residential', status: 'unassigned',
  },
];

const TYPE_COLOURS = {
  Residential: 'bg-blue-100 text-blue-700',
  Commercial: 'bg-purple-100 text-purple-700',
  'End of Tenancy': 'bg-orange-100 text-orange-700',
  Exterior: 'bg-green-100 text-green-700',
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function JobCard({ job, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = job.status === 'completed';

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
      isComplete ? 'border-green-200 opacity-70' : 'border-[#99c5ff]/30'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isComplete ? 'bg-green-500' : 'bg-[#1f48ff]'
          }`}>
            {isComplete
              ? <CheckCircle size={18} className="text-white" />
              : <span className="text-white font-black text-sm">{job.startTime}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${isComplete ? 'line-through text-gray-400' : 'text-[#010a4f]'}`}>
              {job.client}
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin size={10} className="flex-shrink-0" />
              {job.address.split(',')[0]}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs font-bold text-[#1f48ff] flex items-center gap-1">
                <Clock size={10} />{job.startTime} · {job.duration}hr
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOURS[job.type] || 'bg-gray-100 text-gray-600'}`}>
                {job.type}
              </span>
            </div>
          </div>
          <ChevronRight size={16} className={`text-gray-300 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={14} className="text-[#1f48ff] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#010a4f]">{job.address}</p>
              <a
                href={`https://maps.apple.com/?address=${encodeURIComponent(job.address)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#1f48ff] hover:underline mt-0.5 block"
              >
                Open in Maps →
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Phone size={14} className="text-[#1f48ff] flex-shrink-0" />
            <a href={`tel:${job.phone}`} className="text-[#010a4f] hover:text-[#1f48ff] transition-colors">
              {job.phone}
            </a>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <Key size={14} className="text-[#1f48ff] flex-shrink-0 mt-0.5" />
            <p className="text-gray-600">{job.access}</p>
          </div>

          {!isComplete && (
            <button
              onClick={() => onComplete(job.id)}
              className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Mark as Complete
            </button>
          )}

          {isComplete && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
              <CheckCircle size={14} className="text-green-500" />
              <p className="text-sm font-semibold text-green-700">Job completed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const { staffMember, logoutStaff } = useStaff();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(ALL_JOBS);
  const [activeTab, setActiveTab] = useState('today');
  const [claimedJobs, setClaimedJobs] = useState([]);

  if (!staffMember) {
    navigate('/staff-login');
    return null;
  }

  const myJobs = jobs.filter(j => j.assignedTo?.includes(staffMember.id));
  const today = new Date().toISOString().split('T')[0];
  const todayJobs = myJobs.filter(j => j.date === today);
  const upcomingJobs = myJobs.filter(j => j.date > today);
  const completedToday = todayJobs.filter(j => j.status === 'completed').length;
  const todayEarnings = todayJobs
    .filter(j => j.status === 'completed')
    .reduce((s, j) => s + (j.price * (staffMember.hourlyRate / 15)), 0);

  const weekEarnings = myJobs.reduce((s, j) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const jobDate = new Date(j.date);
    if (jobDate >= weekStart && jobDate <= weekEnd) {
      return s + (j.duration * staffMember.hourlyRate);
    }
    return s;
  }, 0);

  const markComplete = (jobId) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed' } : j));
  };

  const claimJob = (job) => {
    setJobs(prev => prev.map(j =>
      j.id === job.id
        ? { ...j, assignedTo: [...(j.assignedTo || []), staffMember.id], status: 'scheduled' }
        : j
    ));
    setClaimedJobs(prev => [...prev, job.id]);
  };

  const handleLogout = () => {
    logoutStaff();
    navigate('/staff-login');
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff]">

      {/* Header */}
      <div className="bg-[#010a4f] px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 ${staffMember.color} rounded-xl flex items-center justify-center text-white font-black`}>
                {staffMember.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="text-white font-black">{staffMember.name}</p>
                <p className="text-[#99c5ff] text-xs">{staffMember.role}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-[#99c5ff] text-xs font-semibold rounded-xl hover:bg-white/20 transition-colors">
              <LogOut size={13} /> Sign Out
            </button>
          </div>

          {/* Today's stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Today's Jobs", value: todayJobs.length, icon: Calendar },
              { label: 'Completed', value: `${completedToday}/${todayJobs.length}`, icon: CheckCircle },
              { label: 'Week Est.', value: `£${Math.round(weekEarnings)}`, icon: PoundSterling },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
                <Icon size={14} className="text-[#99c5ff] mx-auto mb-1" />
                <p className="text-white font-black text-lg">{value}</p>
                <p className="text-[#99c5ff] text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Tabs */}
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-[#99c5ff]/20">
          {[
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'available', label: 'Available Jobs' },
            { id: 'pay', label: 'My Pay' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === id ? 'bg-[#1f48ff] text-white shadow-sm' : 'text-gray-500'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Today tab */}
        {activeTab === 'today' && (
          <div className="space-y-3">
            {todayJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#99c5ff]/20">
                <div className="w-14 h-14 bg-[#f0f4ff] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Star size={24} className="text-[#1f48ff]" />
                </div>
                <p className="font-bold text-[#010a4f]">No jobs today</p>
                <p className="text-sm text-gray-400 mt-1">Check upcoming or grab an available job</p>
              </div>
            ) : (
              todayJobs.map(job => (
                <JobCard key={job.id} job={job} onComplete={markComplete} />
              ))
            )}
          </div>
        )}

        {/* Upcoming tab */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcomingJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#99c5ff]/20">
                <p className="font-bold text-[#010a4f]">No upcoming jobs</p>
                <p className="text-sm text-gray-400 mt-1">Your schedule is clear ahead</p>
              </div>
            ) : (
              Object.entries(
                upcomingJobs.reduce((acc, job) => {
                  if (!acc[job.date]) acc[job.date] = [];
                  acc[job.date].push(job);
                  return acc;
                }, {})
              ).map(([date, dayJobs]) => (
                <div key={date}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {formatDate(date)}
                  </p>
                  <div className="space-y-3">
                    {dayJobs.map(job => (
                      <JobCard key={job.id} job={job} onComplete={markComplete} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Available jobs tab */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-[#f0f4ff] rounded-xl">
              <Zap size={14} className="text-[#1f48ff]" />
              <p className="text-xs font-semibold text-[#010a4f]">
                These jobs need someone — tap Claim to add to your schedule
              </p>
            </div>

            {UNASSIGNED_JOBS.filter(j => !claimedJobs.includes(j.id)).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#99c5ff]/20">
                <CheckCircle size={24} className="text-green-500 mx-auto mb-3" />
                <p className="font-bold text-[#010a4f]">All jobs are covered</p>
                <p className="text-sm text-gray-400 mt-1">Nothing available right now</p>
              </div>
            ) : (
              UNASSIGNED_JOBS.filter(j => !claimedJobs.includes(j.id)).map(job => (
                <div key={job.id} className="bg-white rounded-2xl border-2 border-dashed border-[#99c5ff] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-[#010a4f]">{job.client}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{job.address.split(',')[0]}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-bold text-[#1f48ff]">{formatDate(job.date)}</span>
                        <span className="text-xs text-gray-400">{job.startTime} · {job.duration}hr</span>
                        <span className="text-xs font-bold text-green-600">£{job.price}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => claimJob(job)}
                    className="w-full py-2.5 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
                  >
                    Claim This Job
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pay tab */}
        {activeTab === 'pay' && (
          <div className="space-y-4">
            <div className="bg-[#010a4f] rounded-2xl p-5 text-white">
              <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-4">This Week</p>
              <div className="space-y-3">
                {[
                  { label: 'Hours Scheduled', value: `${myJobs.filter(j => {
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    return new Date(j.date) >= weekStart && new Date(j.date) <= weekEnd;
                  }).reduce((s, j) => s + j.duration, 0)}hrs` },
                  { label: 'Hourly Rate', value: `£${staffMember.hourlyRate}/hr` },
                  { label: 'Estimated Pay', value: `£${Math.round(weekEarnings)}` },
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
                  Pay estimates are based on scheduled hours at your hourly rate. Actual pay is confirmed by your manager and may differ. Speak to your manager for payslip queries.
                </p>
              </div>
            </div>

            {/* Job breakdown */}
            <div className="bg-white rounded-2xl border border-[#99c5ff]/20 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">This Week's Jobs</p>
              </div>
              <div className="divide-y divide-gray-50">
                {myJobs.filter(j => {
                  const weekStart = new Date();
                  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  return new Date(j.date) >= weekStart && new Date(j.date) <= weekEnd;
                }).map(job => (
                  <div key={job.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#010a4f]">{job.client}</p>
                      <p className="text-xs text-gray-400">{formatDate(job.date)} · {job.startTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1f48ff]">
                        £{(job.duration * staffMember.hourlyRate).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">{job.duration}hrs</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
