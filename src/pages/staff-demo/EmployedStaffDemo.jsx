import { useState, useRef, useEffect } from 'react';
import {
  Home, Calendar, Banknote, MapPin, Clock, Camera,
  CheckCircle2, Circle, Shield, ArrowLeft,
  MessageSquare, Send, Umbrella, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';

const NAVY   = '#010a4f';
const ORANGE = '#ea580c';

/* ─── Schedule data ─────────────────────────────────────────────────────────── */

const WEEK_SHIFTS = [
  { day: 'Mon', date: '25 May', status: 'done',  checkIn: '05:57', checkOut: '10:02', hrs: 4.1, supervisor: 'Karen Price', notes: null },
  { day: 'Tue', date: '26 May', status: 'done',  checkIn: '06:01', checkOut: '09:58', hrs: 3.9, supervisor: 'Karen Price', notes: null },
  { day: 'Wed', date: '27 May', status: 'done',  checkIn: '05:59', checkOut: '10:05', hrs: 4.1, supervisor: 'Karen Price', notes: 'Ward 4B sluice room flagged by AM — resolved ✓' },
  { day: 'Thu', date: '28 May', status: 'done',  checkIn: '06:03', checkOut: '10:00', hrs: 3.9, supervisor: 'Karen Price', notes: null },
  { day: 'Fri', date: '29 May', status: 'today', checkIn: null,    checkOut: null,    hrs: null, supervisor: 'Karen Price', notes: null },
];

const NEXT_WEEK = [
  { day: 'Mon', date: '1 Jun',  time: '06:00 – 10:00', type: 'Early Clean' },
  { day: 'Tue', date: '2 Jun',  time: '06:00 – 10:00', type: 'Early Clean' },
  { day: 'Wed', date: '3 Jun',  time: '06:00 – 10:00', type: 'Early Clean' },
  { day: 'Thu', date: '4 Jun',  time: 'Off',            type: 'Rest day'   },
  { day: 'Fri', date: '5 Jun',  time: '06:00 – 10:00', type: 'Early Clean' },
];

/* ─── Leave data ────────────────────────────────────────────────────────────── */

const INIT_REQUESTS = [
  { id: 1, from: '14 Jul', to: '18 Jul', days: 5, reason: 'Family holiday',  status: 'pending',  submitted: '24 May' },
  { id: 2, from: '23 Dec', to: '31 Dec', days: 7, reason: 'Christmas break', status: 'pending',  submitted: '27 May' },
  { id: 3, from: '14 Apr', to: '17 Apr', days: 4, reason: 'Easter break',    status: 'approved', submitted: '10 Mar', approvedBy: 'James Harper' },
];

const ENTITLEMENT = 28;
const USED_DAYS   = 8;

/* ─── Message thread ────────────────────────────────────────────────────────── */

const INIT_MESSAGES = [
  { from: 'manager', name: 'James Harper', time: 'Mon 07:45', text: 'Morning Sarah — ward 4B sluice room needs prioritising first thing today.' },
  { from: 'me',                            time: 'Mon 07:52', text: "Morning! Yes, I'll head there first ✅" },
  { from: 'manager', name: 'James Harper', time: 'Mon 07:53', text: 'Perfect, thanks 👍' },
  { from: 'me',                            time: 'Mon 08:34', text: 'Ward 4B all done and signed off.' },
  { from: 'manager', name: 'James Harper', time: 'Tue 09:10', text: "Hi Sarah, your 6-month review is coming up. I'll send over a time this week." },
];

/* ─── Task data ─────────────────────────────────────────────────────────────── */

const INITIAL_TASKS = [
  { id: 1, area: 'Entrance & main foyer' },
  { id: 2, area: 'Checkout lanes (×12)' },
  { id: 3, area: 'Customer service desk' },
  { id: 4, area: 'Toilets ×4 — COSHH register' },
  { id: 5, area: 'Staff canteen & lockers' },
  { id: 6, area: 'Loading bay corridor' },
];

const KEYFRAMES = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes check-in-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
}
@keyframes slide-up {
  from { opacity:0; transform: translateY(12px); }
  to   { opacity:1; transform: translateY(0); }
}
`;

/* ─── Today tab ─────────────────────────────────────────────────────────────── */

function TodayTab({ checkedIn, checkingIn, onCheckIn, tasks, onToggleTask, photoUploaded, onPhotoUpload, shiftComplete, onComplete }) {
  const completedTasks = tasks.filter(t => t.done).length;
  const canComplete    = completedTasks === tasks.length && photoUploaded;

  return (
    <div style={{ padding: '1.25rem 1.1rem 1.5rem' }}>
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ color: 'rgba(0,0,0,0.38)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.15rem' }}>Friday 29 May 2026</div>
        <div style={{ color: NAVY, fontWeight: 900, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>Good morning, Sarah</div>
      </div>

      {/* Shift card */}
      <div style={{
        borderRadius: '1rem', overflow: 'hidden', marginBottom: '1rem',
        boxShadow: checkedIn ? '0 2px 16px rgba(16,185,129,0.15)' : '0 2px 12px rgba(1,10,79,0.1)',
        border: `1px solid ${checkedIn ? 'rgba(16,185,129,0.3)' : 'rgba(1,10,79,0.12)'}`,
      }}>
        <div style={{
          padding: '0.8rem 1rem',
          background: checkedIn
            ? 'linear-gradient(135deg, #059669, #10b981)'
            : 'linear-gradient(135deg, #010a4f, #0d1f6e)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: 'white', fontWeight: 900, fontSize: '0.82rem' }}>Today's shift</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', marginTop: 2 }}>
              {checkedIn ? '✓ Checked in 06:03 · Geo-stamped' : '06:00 – 10:00 · Early Clean'}
            </div>
          </div>
          {checkedIn && (
            <div style={{
              background: 'rgba(255,255,255,0.22)', borderRadius: '0.4rem',
              padding: '0.25rem 0.55rem', fontSize: '0.6rem', fontWeight: 900, color: 'white',
              letterSpacing: '0.08em',
            }}>ON SITE</div>
          )}
        </div>
        <div style={{ padding: '0.85rem 1rem', background: 'white' }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: NAVY, marginBottom: '0.25rem' }}>Asda Luton Supercentre</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(0,0,0,0.38)', fontSize: '0.67rem', marginBottom: '0.15rem' }}>
            <MapPin size={9} /> Gipsy Lane, Luton LU1 3HR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(0,0,0,0.38)', fontSize: '0.67rem', marginBottom: '0.15rem' }}>
            <Clock size={9} /> SLA window closes 08:30
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(0,0,0,0.38)', fontSize: '0.67rem' }}>
            <Shield size={9} /> Supervisor on shift: Karen Price
          </div>
        </div>
      </div>

      {/* Check-in or task list */}
      {!checkedIn ? (
        <button
          onClick={onCheckIn}
          disabled={checkingIn}
          style={{
            width: '100%', padding: '0.95rem', borderRadius: '1rem', border: 'none', cursor: 'pointer',
            background: checkingIn ? 'rgba(1,10,79,0.35)' : 'linear-gradient(135deg, #010a4f, #1a2f7f)',
            color: 'white', fontWeight: 900, fontSize: '0.88rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 4px 20px rgba(1,10,79,0.25)',
            animation: checkingIn ? 'none' : 'check-in-pulse 2.5s ease-in-out infinite',
          }}>
          {checkingIn ? (
            <>
              <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Getting your location…
            </>
          ) : (
            <><MapPin size={17} /> CHECK IN TO SHIFT</>
          )}
        </button>
      ) : (
        <div style={{ animation: 'slide-up 0.3s ease-out' }}>
          {/* Task list */}
          <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.875rem' }}>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', color: NAVY }}>Areas to clean</div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: completedTasks === tasks.length ? '#10b981' : 'rgba(0,0,0,0.35)' }}>
                {completedTasks}/{tasks.length} done
              </div>
            </div>
            {tasks.map((task, i) => (
              <button key={task.id} onClick={() => onToggleTask(task.id)}
                style={{
                  width: '100%', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem',
                  background: 'none', border: 'none', borderBottom: i < tasks.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                {task.done
                  ? <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                  : <Circle size={15} style={{ color: 'rgba(0,0,0,0.18)', flexShrink: 0 }} />
                }
                <span style={{
                  fontSize: '0.73rem', fontWeight: 600,
                  color: task.done ? 'rgba(0,0,0,0.32)' : '#1a1a2e',
                  textDecoration: task.done ? 'line-through' : 'none',
                }}>
                  {task.area}
                </span>
              </button>
            ))}
          </div>

          {/* Photo evidence */}
          <button onClick={onPhotoUpload}
            style={{
              width: '100%', padding: '0.8rem 1rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', marginBottom: '0.75rem',
              background: photoUploaded ? 'rgba(16,185,129,0.07)' : 'rgba(234,88,12,0.06)',
              border: `1px solid ${photoUploaded ? 'rgba(16,185,129,0.25)' : 'rgba(234,88,12,0.18)'}`,
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
            <Camera size={18} style={{ color: photoUploaded ? '#10b981' : ORANGE, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: '0.73rem', color: photoUploaded ? '#059669' : ORANGE }}>
                {photoUploaded ? '3 photos uploaded ✓' : 'Upload photo evidence'}
              </div>
              <div style={{ fontSize: '0.61rem', color: 'rgba(0,0,0,0.36)', marginTop: 2 }}>
                {photoUploaded ? 'Attached to job card — Britannia can see this on the staff app' : '3 photos required before completing shift'}
              </div>
            </div>
          </button>

          {/* Complete shift */}
          {!shiftComplete ? (
            <button onClick={canComplete ? onComplete : undefined}
              style={{
                width: '100%', padding: '0.9rem', borderRadius: '1rem', border: 'none', cursor: canComplete ? 'pointer' : 'default',
                background: canComplete ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(0,0,0,0.05)',
                color: canComplete ? 'white' : 'rgba(0,0,0,0.22)',
                fontWeight: 900, fontSize: '0.83rem',
                boxShadow: canComplete ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
                transition: 'all 0.2s',
              }}>
              Complete shift
            </button>
          ) : (
            <div style={{
              padding: '1rem', borderRadius: '1rem', textAlign: 'center',
              background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
              animation: 'slide-up 0.3s ease-out',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>✅</div>
              <div style={{ fontWeight: 900, color: '#059669', fontSize: '0.82rem' }}>Shift complete · 4.0 hrs logged</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.38)', marginTop: '0.15rem' }}>Hours sent to payroll automatically</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── My Week tab ───────────────────────────────────────────────────────────── */

function WeekTab({ onSwitchTab }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const completedHrs = WEEK_SHIFTS.filter(s => s.status === 'done').reduce((sum, s) => sum + s.hrs, 0);

  return (
    <div style={{ padding: '1.25rem 1.1rem 1.5rem' }}>
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ color: 'rgba(0,0,0,0.38)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.15rem' }}>Week 22 · May 2026</div>
        <div style={{ color: NAVY, fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>My rota</div>
      </div>

      {/* This week */}
      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.875rem' }}>
        {WEEK_SHIFTS.map((s, i) => {
          const isExpanded = expandedDay === s.day;
          return (
            <div key={s.day}>
              <button onClick={() => setExpandedDay(isExpanded ? null : s.day)}
                style={{
                  width: '100%', padding: '0.72rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: s.status === 'today' ? 'rgba(234,88,12,0.03)' : 'white',
                  border: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ width: 38, flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(0,0,0,0.35)' }}>{s.day}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: s.status === 'today' ? ORANGE : NAVY }}>
                    {s.date.split(' ')[0]}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.74rem', color: NAVY }}>Asda Luton Supercentre</div>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(0,0,0,0.38)' }}>06:00 – 10:00 · Early Clean</div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {s.status === 'done' && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981' }}>✓ {s.hrs}h</div>
                      <div style={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.28)' }}>out {s.checkOut}</div>
                    </div>
                  )}
                  {s.status === 'today' && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: ORANGE, background: 'rgba(234,88,12,0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.35rem' }}>TODAY</span>
                  )}
                  {isExpanded
                    ? <ChevronUp size={12} style={{ color: 'rgba(0,0,0,0.25)' }} />
                    : <ChevronDown size={12} style={{ color: 'rgba(0,0,0,0.25)' }} />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '0.65rem 1rem 0.75rem', background: 'rgba(1,10,79,0.02)', borderBottom: i < WEEK_SHIFTS.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: s.notes ? '0.55rem' : 0 }}>
                    {[
                      { label: 'Site',             value: 'Asda Luton Supercentre' },
                      { label: 'Supervisor',        value: s.supervisor },
                      { label: 'SLA window',        value: 'Closes 08:30' },
                      { label: 'Contract hours',    value: '4.0 hrs' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: '0.57rem', color: 'rgba(0,0,0,0.35)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: NAVY }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {s.notes && (
                    <div style={{ padding: '0.4rem 0.65rem', borderRadius: '0.4rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', fontSize: '0.63rem', color: '#059669', lineHeight: 1.4 }}>
                      📝 {s.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.875rem' }}>
        {[
          { label: 'Hours logged',   value: `${completedHrs.toFixed(1)} hrs` },
          { label: 'Contracted',     value: '20 hrs/wk' },
          { label: 'Site',           value: 'Asda Luton' },
          { label: 'Area manager',   value: 'James Harper' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'white', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '0.6rem', color: 'rgba(0,0,0,0.36)', marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: '0.77rem', color: NAVY }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Next week preview */}
      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.875rem' }}>
        <div style={{ padding: '0.55rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '0.7rem', color: NAVY }}>Next week — 1–5 Jun</div>
          <span style={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.35)', fontWeight: 600 }}>Published ✓</span>
        </div>
        {NEXT_WEEK.map((s, i) => (
          <div key={s.day} style={{
            padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
            borderBottom: i < NEXT_WEEK.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
            background: s.type === 'Rest day' ? 'rgba(16,185,129,0.02)' : 'white',
          }}>
            <div style={{ width: 38, flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(0,0,0,0.35)' }}>{s.day}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: NAVY }}>{s.date.split(' ')[0]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: s.type === 'Rest day' ? 'rgba(0,0,0,0.3)' : NAVY }}>{s.time}</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(0,0,0,0.35)' }}>{s.type === 'Rest day' ? 'Day off' : 'Asda Luton · ' + s.type}</div>
            </div>
            {s.type === 'Rest day' && (
              <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.35rem' }}>OFF</span>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button onClick={() => onSwitchTab('leave')} style={{
          flex: 1, padding: '0.82rem 0.6rem', borderRadius: '0.875rem',
          border: `1px solid rgba(234,88,12,0.2)`, background: 'rgba(234,88,12,0.06)',
          color: ORANGE, fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}>
          <Umbrella size={13} /> Request holiday
        </button>
        <button onClick={() => onSwitchTab('leave')} style={{
          flex: 1, padding: '0.82rem 0.6rem', borderRadius: '0.875rem',
          border: `1px solid rgba(1,10,79,0.15)`, background: 'rgba(1,10,79,0.05)',
          color: NAVY, fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}>
          <MessageSquare size={13} /> Message James
        </button>
      </div>
    </div>
  );
}

/* ─── My Pay tab ────────────────────────────────────────────────────────────── */

function PayTab() {
  return (
    <div style={{ padding: '1.25rem 1.1rem 1.5rem' }}>
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ color: 'rgba(0,0,0,0.38)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.15rem' }}>May 2026</div>
        <div style={{ color: NAVY, fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>My pay</div>
      </div>

      <div style={{
        borderRadius: '1rem', padding: '1.25rem',
        background: 'linear-gradient(135deg, #010a4f, #0d1f6e)',
        marginBottom: '1rem', boxShadow: '0 4px 20px rgba(1,10,79,0.2)',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.67rem', fontWeight: 700, marginBottom: '0.2rem' }}>Next payment</div>
        <div style={{ color: 'white', fontWeight: 900, fontSize: '1.85rem', letterSpacing: '-0.03em', marginBottom: '0.15rem' }}>£1,240.00</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem' }}>29 May 2026 · BACS · PAYE</div>
        <div style={{
          marginTop: '1rem', paddingTop: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { label: 'Hours this week',  value: '16.0 hrs' },
            { label: 'Hours this month', value: '70.9 hrs' },
            { label: 'Last payment',     value: '30 Apr' },
            { label: 'Last amount',      value: '£1,240.00' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.6rem', marginBottom: '0.1rem' }}>{label}</div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '0.75rem' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.875rem' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Shield size={11} style={{ color: NAVY }} />
          <div style={{ fontWeight: 800, fontSize: '0.7rem', color: NAVY }}>Employment details</div>
        </div>
        {[
          { label: 'Employee ID',  value: 'E-0112' },
          { label: 'Employer',     value: 'Britannia Group Ltd' },
          { label: 'Employment',   value: 'PAYE · Permanent' },
          { label: 'NI Number',    value: 'SX 12 34 56 C' },
          { label: 'Tax code',     value: '1257L' },
          { label: 'DBS status',   value: 'Valid · exp 12 Aug 2026' },
        ].map(({ label, value }, i, arr) => (
          <div key={label} style={{
            padding: '0.58rem 1rem', display: 'flex', justifyContent: 'space-between',
            borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
          }}>
            <span style={{ fontSize: '0.67rem', color: 'rgba(0,0,0,0.38)' }}>{label}</span>
            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#1a1a2e' }}>{value}</span>
          </div>
        ))}
      </div>

      <button style={{
        width: '100%', padding: '0.85rem', borderRadius: '1rem', border: '1px solid rgba(1,10,79,0.15)',
        background: 'rgba(1,10,79,0.04)', color: NAVY, fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
      }}>
        Download May payslip
        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(0,0,0,0.35)' }}>(available now)</span>
      </button>
    </div>
  );
}

/* ─── Leave & Messages tab ──────────────────────────────────────────────────── */

function LeaveTab() {
  const [requests, setRequests]   = useState(INIT_REQUESTS);
  const [showForm, setShowForm]   = useState(false);
  const [formFrom, setFormFrom]   = useState('');
  const [formTo, setFormTo]       = useState('');
  const [formReason, setFormReason] = useState('');
  const [messages, setMessages]   = useState(INIT_MESSAGES);
  const [draft, setDraft]         = useState('');
  const msgEndRef = useRef(null);

  // scroll to bottom when new message arrives
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const pendingDays = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.days, 0);
  const remaining   = ENTITLEMENT - USED_DAYS - pendingDays;

  function submitRequest() {
    if (!formFrom || !formTo) return;
    const from = new Date(formFrom);
    const to   = new Date(formTo);
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    setRequests(prev => [
      { id: Date.now(), from: formFrom, to: formTo, days, reason: formReason || 'Annual leave', status: 'pending', submitted: 'Today' },
      ...prev,
    ]);
    setFormFrom(''); setFormTo(''); setFormReason('');
    setShowForm(false);
    // Auto-message to manager
    setTimeout(() => {
      setMessages(prev => [...prev,
        { from: 'manager', name: 'James Harper', time: 'Just now', text: `Thanks Sarah — I can see your holiday request. I'll review it and get back to you shortly.` },
      ]);
    }, 800);
  }

  function sendMessage() {
    if (!draft.trim()) return;
    setMessages(prev => [...prev, { from: 'me', time: 'Now', text: draft.trim() }]);
    setDraft('');
    setTimeout(() => {
      setMessages(prev => [...prev,
        { from: 'manager', name: 'James Harper', time: 'Just now', text: "Got it Sarah, thanks for letting me know. I'll sort that for you." },
      ]);
    }, 1100);
  }

  return (
    <div style={{ padding: '1.25rem 1.1rem 1.5rem' }}>
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ color: 'rgba(0,0,0,0.38)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.15rem' }}>2026 leave year</div>
        <div style={{ color: NAVY, fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Leave & Messages</div>
      </div>

      {/* Entitlement bar */}
      <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.875rem' }}>
        <div style={{ fontWeight: 800, fontSize: '0.72rem', color: NAVY, marginBottom: '0.6rem' }}>Annual leave entitlement</div>
        <div style={{ height: 8, borderRadius: 9999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '0.6rem' }}>
          <div style={{ height: '100%', display: 'flex', borderRadius: 9999 }}>
            <div style={{ width: `${(USED_DAYS / ENTITLEMENT) * 100}%`, background: NAVY, transition: 'width 0.4s' }} />
            <div style={{ width: `${(pendingDays / ENTITLEMENT) * 100}%`, background: ORANGE, opacity: 0.6, transition: 'width 0.4s' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
          {[
            { label: 'Entitlement', value: `${ENTITLEMENT}d`, color: 'rgba(0,0,0,0.5)' },
            { label: 'Used',        value: `${USED_DAYS}d`,   color: NAVY },
            { label: 'Pending',     value: `${pendingDays}d`, color: ORANGE },
            { label: 'Remaining',   value: `${remaining}d`,   color: '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: '0.92rem', color }}>{value}</div>
              <div style={{ fontSize: '0.57rem', color: 'rgba(0,0,0,0.35)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Requests list */}
      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.75rem' }}>
        <div style={{ padding: '0.55rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '0.7rem', color: NAVY }}>My requests</div>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '0.4rem',
            background: showForm ? 'rgba(0,0,0,0.06)' : ORANGE, border: 'none', cursor: 'pointer',
            color: showForm ? 'rgba(0,0,0,0.5)' : 'white', fontSize: '0.6rem', fontWeight: 800,
          }}>
            <Plus size={10} /> {showForm ? 'Cancel' : 'New request'}
          </button>
        </div>

        {/* Request form */}
        {showForm && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(234,88,12,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', display: 'block', marginBottom: 3 }}>From</label>
                <input type="date" value={formFrom} onChange={e => setFormFrom(e.target.value)}
                  style={{ width: '100%', padding: '0.38rem 0.5rem', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '0.4rem', fontSize: '0.63rem', fontFamily: 'inherit', color: NAVY, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', display: 'block', marginBottom: 3 }}>To</label>
                <input type="date" value={formTo} onChange={e => setFormTo(e.target.value)}
                  style={{ width: '100%', padding: '0.38rem 0.5rem', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '0.4rem', fontSize: '0.63rem', fontFamily: 'inherit', color: NAVY, boxSizing: 'border-box' }} />
              </div>
            </div>
            <input type="text" placeholder="Reason (e.g. family holiday)" value={formReason} onChange={e => setFormReason(e.target.value)}
              style={{ width: '100%', padding: '0.38rem 0.55rem', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '0.4rem', fontSize: '0.63rem', fontFamily: 'inherit', color: NAVY, marginBottom: '0.5rem', boxSizing: 'border-box' }} />
            <button onClick={submitRequest}
              disabled={!formFrom || !formTo}
              style={{
                width: '100%', padding: '0.5rem', borderRadius: '0.45rem', border: 'none', cursor: formFrom && formTo ? 'pointer' : 'default',
                background: formFrom && formTo ? ORANGE : 'rgba(0,0,0,0.07)',
                color: formFrom && formTo ? 'white' : 'rgba(0,0,0,0.3)',
                fontWeight: 800, fontSize: '0.68rem',
              }}>
              Send request to James Harper →
            </button>
          </div>
        )}

        {requests.map((req, i) => (
          <div key={req.id} style={{
            padding: '0.62rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
            borderBottom: i < requests.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.7rem', color: NAVY }}>{req.from} → {req.to}</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(0,0,0,0.38)', marginTop: 1 }}>{req.days} days · {req.reason}</div>
              <div style={{ fontSize: '0.56rem', color: 'rgba(0,0,0,0.28)', marginTop: 2 }}>
                Submitted {req.submitted}{req.approvedBy ? ` · Approved by ${req.approvedBy}` : ''}
              </div>
            </div>
            <span style={{
              flexShrink: 0, fontSize: '0.6rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '999px',
              background: req.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(234,88,12,0.1)',
              color: req.status === 'approved' ? '#10b981' : ORANGE,
              border: `1px solid ${req.status === 'approved' ? 'rgba(16,185,129,0.25)' : 'rgba(234,88,12,0.25)'}`,
            }}>
              {req.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
            </span>
          </div>
        ))}
      </div>

      {/* Message thread */}
      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '0.55rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            background: `${NAVY}15`, border: `1px solid ${NAVY}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.52rem', fontWeight: 900, color: NAVY,
          }}>JH</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.7rem', color: NAVY }}>James Harper</div>
            <div style={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.35)' }}>Your area manager · usually replies quickly</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: 190, overflowY: 'auto' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '0.42rem 0.65rem',
                borderRadius: msg.from === 'me'
                  ? '0.75rem 0.75rem 0.15rem 0.75rem'
                  : '0.75rem 0.75rem 0.75rem 0.15rem',
                background: msg.from === 'me' ? NAVY : '#f0f2ff',
                fontSize: '0.63rem', lineHeight: 1.45,
                color: msg.from === 'me' ? 'white' : '#1a1a2e',
              }}>
                {msg.text}
                <div style={{
                  fontSize: '0.5rem', marginTop: 3,
                  color: msg.from === 'me' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.3)',
                  textAlign: msg.from === 'me' ? 'right' : 'left',
                }}>{msg.time}</div>
              </div>
            </div>
          ))}
          <div ref={msgEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="Message James…"
            style={{ flex: 1, padding: '0.42rem 0.65rem', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.63rem', fontFamily: 'inherit', outline: 'none', color: NAVY, background: '#f7f8ff' }} />
          <button onClick={sendMessage} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: draft.trim() ? NAVY : 'rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}>
            <Send size={12} style={{ color: draft.trim() ? 'white' : 'rgba(0,0,0,0.3)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Root ──────────────────────────────────────────────────────────────────── */

export default function EmployedStaffDemo() {
  const [tab,           setTab]           = useState('today');
  const [checkedIn,     setCheckedIn]     = useState(false);
  const [checkingIn,    setCheckingIn]    = useState(false);
  const [tasks,         setTasks]         = useState(INITIAL_TASKS.map(t => ({ ...t, done: false })));
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [shiftComplete, setShiftComplete] = useState(false);

  function handleCheckIn() {
    setCheckingIn(true);
    setTimeout(() => { setCheckingIn(false); setCheckedIn(true); }, 1500);
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  const NAV_TABS = [
    { id: 'today', Icon: Home,         label: 'Today'   },
    { id: 'week',  Icon: Calendar,     label: 'My Week' },
    { id: 'pay',   Icon: Banknote,     label: 'My Pay'  },
    { id: 'leave', Icon: Umbrella,     label: 'Leave'   },
  ];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #eef2ff 0%, #e0e7ff 50%, #ede9fe 100%)',
        fontFamily: "'Satoshi','Inter',sans-serif", padding: '2rem 1rem',
      }}>

        {/* DEMO ribbon */}
        <div className="fixed top-0 right-0 z-50 pointer-events-none overflow-hidden w-20 h-20">
          <div style={{
            background: 'linear-gradient(135deg, #C2410C, #ea580c)',
            color: 'white', fontSize: 9, fontWeight: 900, letterSpacing: '0.15em',
            padding: '6px 0', textAlign: 'center',
            transform: 'rotate(45deg) translate(14px, -14px)', transformOrigin: 'center', width: 80,
          }}>DEMO</div>
        </div>

        {/* Back link */}
        <a href="/demo" style={{
          position: 'fixed', top: 20, left: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '0.8rem', fontWeight: 700, color: NAVY,
          textDecoration: 'none', zIndex: 50,
        }}>
          <ArrowLeft size={15} /> Demo home
        </a>

        {/* Label */}
        <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.3)', marginBottom: '0.2rem' }}>
            Britannia Group · Employed Cleaner View
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.45)', fontWeight: 600 }}>
            Sarah Mitchell · E-0112 · Asda Luton Supercentre
          </div>
        </div>

        {/* Phone frame */}
        <div style={{
          width: '100%', maxWidth: 390,
          borderRadius: '2.75rem', overflow: 'hidden',
          border: '8px solid #1a1a2e',
          background: '#f5f7ff',
          boxShadow: '0 40px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          minHeight: 620,
        }}>

          {/* Status bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 6px', background: NAVY }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700 }}>09:24</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[0.7, 0.45, 0.2].map((o, i) => (
                <div key={i} style={{ width: 12, height: 6, borderRadius: 2, background: `rgba(255,255,255,${o})` }} />
              ))}
              <div style={{ marginLeft: 4, width: 20, height: 11, borderRadius: 3, border: '1.5px solid rgba(255,255,255,0.4)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 2, top: 2, bottom: 2, width: '60%', borderRadius: 1.5, background: 'rgba(255,255,255,0.7)' }} />
              </div>
            </div>
          </div>

          {/* App header */}
          <div style={{ padding: '10px 18px 12px', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.58rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Britannia Group</div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '0.88rem', marginTop: 1 }}>Staff App</div>
            </div>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(234,88,12,0.22)', border: '1.5px solid rgba(234,88,12,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.68rem', fontWeight: 900, color: 'white',
            }}>SM</div>
          </div>

          {/* Screen content */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f5f7ff' }}>
            {tab === 'today' && (
              <TodayTab
                checkedIn={checkedIn}
                checkingIn={checkingIn}
                onCheckIn={handleCheckIn}
                tasks={tasks}
                onToggleTask={toggleTask}
                photoUploaded={photoUploaded}
                onPhotoUpload={() => setPhotoUploaded(true)}
                shiftComplete={shiftComplete}
                onComplete={() => setShiftComplete(true)}
              />
            )}
            {tab === 'week'  && <WeekTab onSwitchTab={setTab} />}
            {tab === 'pay'   && <PayTab />}
            {tab === 'leave' && <LeaveTab />}
          </div>

          {/* Bottom nav */}
          <div style={{ display: 'flex', background: 'white', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {NAV_TABS.map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex: 1, padding: '10px 0 8px', border: 'none', background: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  position: 'relative',
                }}>
                {/* notification dot for leave tab if pending */}
                {id === 'leave' && (
                  <div style={{ position: 'absolute', top: 8, right: '50%', marginRight: -14, width: 6, height: 6, borderRadius: '50%', background: ORANGE, border: '1.5px solid white' }} />
                )}
                <Icon size={18} style={{ color: tab === id ? ORANGE : 'rgba(0,0,0,0.25)' }} />
                <span style={{ fontSize: '0.55rem', fontWeight: 800, color: tab === id ? ORANGE : 'rgba(0,0,0,0.32)' }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Home indicator */}
          <div style={{ background: 'white', display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
            <div style={{ width: 100, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)' }} />
          </div>
        </div>
      </div>
    </>
  );
}
