import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRoundsForCustomer } from '../../lib/db/customerRoundsDb';
import { createSurvey, listSurveysForCustomer } from '../../lib/db/surveyDb';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { BILLING_MODES } from '../../lib/billing';
import { generateSuggestions, JOB_TYPES } from './helpers';
import { GlassCard, GlassSurface, SL, Chip, StatusBadge, StarRating } from './primitives';
import SecureVault from './SecureVault';
import ArchiveButton from './ArchiveButton';
import AddCustomerModal from './AddCustomerModal';
import CustomerMetrics from './CustomerMetrics';
import GrowthTab from './GrowthTab';

export default function CustomerDetail({
  customer,
  onMessage,
  onClose,
  onBookJob,
  onUpdateCustomer,
  onDeleteCustomer,
  onEraseCustomer,
  onExportCustomer,
  ownerId,
}) {
  const suggestions = useMemo(() => generateSuggestions(customer), [customer]);
  const hasLastJob = Boolean(customer.lastJobDate);
  const daysSince = hasLastJob
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const totalJobs = customer.completedJobs ?? 0;
  const lastJobLabel =
    hasLastJob && daysSince >= 0
      ? `${daysSince}d ago`
      : customer.nextJobDate
        ? `in ${Math.max(0, Math.ceil((new Date(customer.nextJobDate) - Date.now()) / 86400000))}d`
        : '—';
  const uniqueTypes = [...new Set(customer.services.map((s) => s.type))];

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Everything in this drawer saves the moment it's changed — there is no
  // save button by design. The flash pill makes that visible, because
  // silent auto-save reads as "not saved" to users.
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);
  const saveCustomer = (id, patch) => {
    const result = onUpdateCustomer?.(id, patch);
    clearTimeout(savedTimer.current);
    setSavedFlash(true);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    return result;
  };
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const [rounds, setRounds] = useState([]);
  const [openSurveys, setOpenSurveys] = useState([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const phoneHref = customer.phone ? `tel:${customer.phone.replace(/\s+/g, '')}` : null;

  const saveNote = async () => {
    const text = noteDraft.trim();
    if (!text) {
      setNoteOpen(false);
      return;
    }
    setNoteSaving(true);
    const stamp = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const entry = `[${stamp}] ${text}`;
    const merged = customer.notes ? `${entry}\n${customer.notes}` : entry;
    try {
      await saveCustomer(customer.id, { notes: merged });
    } finally {
      setNoteSaving(false);
      setNoteDraft('');
      setNoteOpen(false);
    }
  };

  const isCommercial =
    customer.segment === 'commercial' ||
    (customer.tags ?? []).some((t) => t === 'commercial' || t === 'contract');

  useEffect(() => {
    if (!isCommercial || !customer.id) return;
    listSurveysForCustomer(customer.id)
      .then((rows) => setOpenSurveys(rows.filter((r) => r.status !== 'archived')))
      .catch(() => {});
  }, [customer.id, isCommercial]);

  const handleStartSurvey = async () => {
    setSurveyLoading(true);
    try {
      const survey = await createSurvey({ customerId: customer.id });
      navigate(`/survey/${survey.id}`);
    } catch (err) {
      alert(`Could not start survey: ${err.message}`);
      setSurveyLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listRoundsForCustomer(customer.id)
      .then((r) => {
        if (!cancelled) setRounds(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  // Jobs come from the shared DataContext so the list stays in sync with
  // the Scheduler — marking a job Done in another view re-renders the
  // customer profile immediately. Invoices are still queried per-open
  // because they're not held in DataContext.
  const { jobs: contextJobs } = useData();
  const allJobs = useMemo(() => {
    return (contextJobs || [])
      .filter((j) => j.customerId === customer.id)
      .map((j) => ({
        id: j.id,
        date: j.date,
        service: j.service,
        type: j.type,
        price: j.price,
        status: j.status,
        start_hour: j.startHour,
        duration_hrs: j.durationHrs,
        notes: j.notes,
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 200);
  }, [contextJobs, customer.id]);

  const [allInvoices, setAllInvoices] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setAllInvoices([]);
    supabase
      .from('invoices')
      .select('id, invoice_num, date, status, lines, paid_at, payment_method')
      .eq('customer_id', customer.id)
      .order('date', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) setAllInvoices(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  // "growth" is the CRM tab (migration 080): sales plan, annual calendar,
  // service ledger — it also absorbed the old heuristic "suggestions" tab.
  const TABS = ['overview', 'growth', 'metrics', 'history', 'messages', 'secure'];

  const [gcLoading, setGcLoading] = useState(false);
  const [gcMandateUrl, setGcMandateUrl] = useState(null);
  const [gcPayAmount, setGcPayAmount] = useState('');
  const [gcPayLoading, setGcPayLoading] = useState(false);
  const [gcError, setGcError] = useState(null);
  const [gcSuccess, setGcSuccess] = useState(null);

  const gcInvoke = async (body) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('gocardless-api', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      let msg = error.message;
      try {
        const rb = await error.context?.json?.();
        if (rb?.error) msg = rb.error;
      } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleGcSync = async () => {
    setGcLoading(true);
    setGcError(null);
    setGcSuccess(null);
    try {
      const res = await gcInvoke({ action: 'sync_customer', customerId: customer.id });
      onUpdateCustomer?.(customer.id, { gc_customer_id: res.gcCustomerId });
      setGcSuccess('Customer synced to GoCardless.');
    } catch (e) {
      setGcError(e.message);
    } finally {
      setGcLoading(false);
    }
  };

  const handleGcMandateLink = async () => {
    setGcLoading(true);
    setGcError(null);
    setGcSuccess(null);
    try {
      const res = await gcInvoke({ action: 'create_mandate_link', customerId: customer.id });
      setGcMandateUrl(res.mandateUrl);
    } catch (e) {
      setGcError(e.message);
    } finally {
      setGcLoading(false);
    }
  };

  const handleGcCollect = async () => {
    const pence = Math.round(parseFloat(gcPayAmount) * 100);
    if (!pence || pence <= 0) {
      setGcError('Enter a valid amount.');
      return;
    }
    setGcPayLoading(true);
    setGcError(null);
    setGcSuccess(null);
    try {
      await gcInvoke({
        action: 'create_payment',
        customerId: customer.id,
        amountPence: pence,
        description: `Payment — ${customer.name}`,
      });
      setGcSuccess(`£${gcPayAmount} collection sent to GoCardless.`);
      setGcPayAmount('');
    } catch (e) {
      setGcError(e.message);
    } finally {
      setGcPayLoading(false);
    }
  };

  const handleGcSyncMandate = async () => {
    setGcLoading(true);
    setGcError(null);
    setGcSuccess(null);
    try {
      const res = await gcInvoke({ action: 'sync_mandate', customerId: customer.id });
      onUpdateCustomer?.(customer.id, {
        gc_mandate_id: res.mandateId,
        gc_mandate_status: res.mandateStatus,
      });
      setGcSuccess(`Mandate synced — status: ${res.mandateStatus}`);
    } catch (e) {
      setGcError(e.message);
    } finally {
      setGcLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#010a4f]">
      {showEdit && (
        <AddCustomerModal
          customer={customer}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            saveCustomer(customer.id, updated);
            setShowEdit(false);
          }}
        />
      )}

      <div
        className="relative overflow-hidden shrink-0"
        style={{ background: 'linear-gradient(135deg, #0d1e78 0%, #05124a 60%, #010a4f 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[rgba(31,72,255,0.15)] blur-2xl pointer-events-none" />

        <div className="relative px-5 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">
                Customer Profile
              </p>
              <p className="font-black text-xl text-white">{customer.name}</p>
              <p className="text-xs text-[#99c5ff] mt-0.5">
                {customer.postcode} · {customer.frequency}
              </p>
              <div className="mt-1.5">
                <StarRating
                  value={customer.rating || 0}
                  onChange={(r) => saveCustomer(customer.id, { rating: r })}
                  size="sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-2 py-0.5 transition-opacity duration-300 ${
                  savedFlash ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                ✓ Saved
              </span>
              <StatusBadge status={customer.status} />
              <button
                onClick={() => setShowEdit(true)}
                className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-[rgba(153,197,255,0.7)] hover:text-white transition-all text-xs font-bold"
              >
                Edit
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Lifetime value',
                value: `£${customer.lifetimeValue.toLocaleString()}`,
                accent: 'text-emerald-600',
                // Sub-label surfaces collection state. If anything is
                // outstanding the owner sees it inline; otherwise the
                // tile reads as a clean win.
                sub:
                  customer.outstandingBalance > 0
                    ? `£${customer.outstandingBalance.toLocaleString()} outstanding`
                    : customer.paidLifetimeValue > 0
                      ? 'all paid ✓'
                      : null,
                subAccent: customer.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600',
              },
              { label: 'Total jobs', value: totalJobs, accent: 'text-[#010a4f]' },
              {
                label: hasLastJob && daysSince >= 0 ? 'Last job' : 'Next job',
                value: lastJobLabel,
                accent: hasLastJob && daysSince > 60 ? 'text-amber-600' : 'text-[#010a4f]',
              },
            ].map(({ label, value, accent, sub, subAccent }) => (
              <GlassSurface key={label} tone="light" depth="lift" className="px-2 py-2 text-center">
                <p className="text-[10px] text-[#010a4f]/55 mb-0.5 font-semibold tracking-wide uppercase">
                  {label}
                </p>
                <p className={`text-base font-black ${accent}`}>{value}</p>
                {sub && (
                  <p
                    className={`text-[10px] font-semibold mt-0.5 ${subAccent || 'text-[#010a4f]/55'}`}
                  >
                    {sub}
                  </p>
                )}
              </GlassSurface>
            ))}
          </div>
        </div>
      </div>

      <div className="flex border-b border-[rgba(153,197,255,0.08)] bg-[#010a4f] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
              t === 'secure'
                ? activeTab === t
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-[rgba(153,197,255,0.35)] hover:text-amber-400'
                : activeTab === t
                  ? 'border-[#99c5ff] text-white'
                  : 'border-transparent text-[rgba(153,197,255,0.35)] hover:text-[rgba(153,197,255,0.7)]'
            }`}
          >
            {t === 'secure' ? '🔒' : t}
            {t === 'growth' && suggestions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] border border-amber-500/25">
                {suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#010a4f] p-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={customer.status} />
              {customer.tags.map((tag) => (
                <Chip key={tag} color="sky">
                  {tag}
                </Chip>
              ))}
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)] mb-1.5">
                Customer type
              </p>
              <div className="flex gap-1.5">
                {[
                  { value: 'residential', label: 'Residential', icon: '🏠' },
                  { value: 'commercial', label: 'Commercial', icon: '🏢' },
                  { value: 'exterior', label: 'Exterior', icon: '🏗' },
                ].map(({ value, label, icon }) => {
                  const active = customer.segment === value;
                  return (
                    <button
                      key={value}
                      onClick={() =>
                        saveCustomer(customer.id, { segment: value, segmentSource: 'owner_set' })
                      }
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                        active
                          ? 'bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white'
                          : 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.10)] text-[rgba(153,197,255,0.4)] hover:border-[rgba(153,197,255,0.25)] hover:text-[rgba(153,197,255,0.7)]'
                      }`}
                    >
                      <span className="text-sm">{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {isCommercial && (
              <div className="rounded-xl border border-[rgba(31,72,255,0.25)] bg-[rgba(31,72,255,0.06)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[rgba(31,72,255,0.15)]">
                  <p className="text-xs font-bold text-[#99c5ff]">Commercial — Quote & Survey</p>
                </div>
                <div className="px-4 py-3">
                  {openSurveys.length > 0 ? (
                    <div className="space-y-2">
                      {openSurveys.map((sv) => (
                        <button
                          key={sv.id}
                          onClick={() => navigate(`/survey/${sv.id}`)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(31,72,255,0.1)] hover:bg-[rgba(31,72,255,0.18)] border border-[rgba(31,72,255,0.2)] transition-all"
                        >
                          <div className="text-left">
                            <p className="text-xs font-bold text-[#99c5ff] capitalize">
                              {sv.status.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                              {new Date(sv.created_at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <span className="text-[#99c5ff] text-sm">→</span>
                        </button>
                      ))}
                      <button
                        onClick={handleStartSurvey}
                        disabled={surveyLoading}
                        className="w-full h-9 rounded-lg bg-[rgba(31,72,255,0.15)] hover:bg-[rgba(31,72,255,0.25)] border border-[rgba(31,72,255,0.25)] text-xs font-bold text-[#99c5ff] transition-colors disabled:opacity-40"
                      >
                        {surveyLoading ? 'Starting…' : '+ New survey'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartSurvey}
                      disabled={surveyLoading}
                      className="w-full h-10 rounded-lg bg-[#1f48ff] hover:bg-[#2a55ff] disabled:opacity-40 text-white text-sm font-bold transition-colors"
                    >
                      {surveyLoading ? 'Starting…' : 'Quote / Site survey →'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <GlassCard>
              {[
                ['Phone', customer.phone],
                ['Email', customer.email],
                ['Postcode', customer.postcode],
                [
                  'Next job',
                  customer.nextJobDate
                    ? new Date(customer.nextJobDate).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Not booked',
                ],
                ['Source', customer.source],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(153,197,255,0.06)] last:border-b-0"
                >
                  <span className="text-[rgba(153,197,255,0.4)] w-16 shrink-0 text-[10px] font-bold tracking-wide uppercase">
                    {label}
                  </span>
                  <span
                    className={`font-semibold text-sm ${label === 'Next job' && !customer.nextJobDate ? 'text-amber-400' : 'text-white'}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </GlassCard>

            {customer.notes && (
              <GlassCard className="p-4">
                <SL>Notes</SL>
                <p className="text-sm text-[rgba(153,197,255,0.8)] leading-relaxed">
                  {customer.notes}
                </p>
              </GlassCard>
            )}

            {rounds.length > 0 && (
              <GlassCard>
                <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
                  <SL>Rounds & Services</SL>
                  <span className="text-[10px] font-bold text-emerald-400">
                    £{rounds.reduce((s, r) => s + (r.price_per_visit ?? 0), 0).toFixed(2)}/visit
                    total
                  </span>
                </div>
                <div className="divide-y divide-[rgba(153,197,255,0.06)]">
                  {rounds.map((r) => {
                    const statusStyles = {
                      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
                    };
                    return (
                      <div key={r.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-white truncate">
                            {r.round_name || r.job_reference || 'Round'}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusStyles[r.account_status] ?? statusStyles.active}`}
                          >
                            {r.account_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[rgba(153,197,255,0.5)]">
                          {r.price_per_visit != null && (
                            <span className="font-bold text-emerald-400">
                              £{Number(r.price_per_visit).toFixed(2)}
                            </span>
                          )}
                          {r.schedule && <span>{r.schedule}</span>}
                          {r.due_date && (
                            <span>
                              Due{' '}
                              {new Date(r.due_date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                          {r.job_reference && (
                            <span className="font-mono opacity-60">#{r.job_reference}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            <GlassCard className="p-4">
              <SL>Services</SL>
              <div className="flex flex-wrap gap-1.5">
                {uniqueTypes.map((type) => {
                  const jt = JOB_TYPES.find((j) => j.id === type);
                  return jt ? (
                    <Chip key={type} color={jt.color}>
                      {jt.label}
                    </Chip>
                  ) : null;
                })}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <SL>Services offered</SL>
                <span className="text-[10px] text-[rgba(153,197,255,0.4)]">Tap to toggle</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {JOB_TYPES.filter((jt) => jt.id !== 'all').map((jt) => {
                  const active = (customer.serviceTypes || []).includes(jt.id);
                  return (
                    <button
                      key={jt.id}
                      type="button"
                      onClick={() => {
                        const current = customer.serviceTypes || [];
                        const next = active
                          ? current.filter((s) => s !== jt.id)
                          : [...current, jt.id];
                        saveCustomer(customer.id, { serviceTypes: next });
                      }}
                      className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-all ${
                        active
                          ? 'bg-[#1f48ff]/20 text-[#99c5ff] border-[#1f48ff]/40'
                          : 'bg-[rgba(153,197,255,0.04)] text-[rgba(153,197,255,0.35)] border-[rgba(153,197,255,0.08)] hover:border-[rgba(153,197,255,0.2)]'
                      }`}
                    >
                      {jt.label}
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onMessage(customer, null)}
                className="py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25"
              >
                Send message
              </button>
              <button
                onClick={() => onBookJob?.(customer)}
                className="py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
              >
                Book job
              </button>
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="py-2.5 flex items-center justify-center bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
                >
                  Call
                </a>
              ) : (
                <button
                  disabled
                  title="No phone number on file"
                  className="py-2.5 bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.3)] text-xs font-bold uppercase tracking-wide rounded-xl cursor-not-allowed"
                >
                  Call
                </button>
              )}
              <button
                onClick={() => {
                  setNoteDraft('');
                  setNoteOpen((o) => !o);
                }}
                className="py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
              >
                {noteOpen ? 'Cancel' : 'Add note'}
              </button>
            </div>

            {noteOpen && (
              <GlassCard className="p-3 space-y-2">
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="What happened? (saved with today's date)"
                  rows={3}
                  className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors resize-none"
                  autoFocus
                />
                <button
                  onClick={saveNote}
                  disabled={noteSaving || !noteDraft.trim()}
                  className="w-full py-2 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all"
                >
                  {noteSaving ? 'Saving…' : 'Save note'}
                </button>
              </GlassCard>
            )}
          </>
        )}

        {activeTab === 'metrics' && <CustomerMetrics customer={customer} jobs={allJobs} />}

        {activeTab === 'history' && (
          <>
            <div className="flex items-center justify-between">
              <SL>Jobs</SL>
              <span className="text-xs text-emerald-400 font-semibold">
                £{customer.lifetimeValue.toLocaleString()} lifetime
              </span>
            </div>

            {allJobs.length === 0 ? (
              <p className="text-xs text-[rgba(153,197,255,0.4)] py-2">No jobs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {allJobs.map((job) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isPast = job.date < today;
                  const statusColour =
                    job.status === 'completed' || job.status === 'invoiced'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                      : job.status === 'cancelled'
                        ? 'bg-red-500/15 text-red-300 border-red-500/25'
                        : isPast
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/25';
                  return (
                    <GlassCard key={job.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${job.status === 'completed' ? 'bg-emerald-400' : isPast ? 'bg-amber-400' : 'bg-[#99c5ff]'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {job.service || 'Clean'}
                          </p>
                          <p className="text-xs text-[rgba(153,197,255,0.4)]">
                            {job.date
                              ? new Date(job.date).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {job.price > 0 && (
                            <p className="text-sm font-bold text-emerald-400">
                              £{Number(job.price).toFixed(2)}
                            </p>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-lg border font-bold capitalize ${statusColour}`}
                          >
                            {job.status}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}

            {allInvoices.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-2">
                  <SL>Invoices & payments</SL>
                  <span className="text-xs text-emerald-400 font-semibold">
                    £
                    {allInvoices
                      .filter((i) => i.status === 'paid')
                      .reduce((s, i) => {
                        const total = Array.isArray(i.lines)
                          ? i.lines.reduce((t, l) => t + Number(l.amount ?? l.total ?? 0), 0)
                          : 0;
                        return s + total;
                      }, 0)
                      .toLocaleString()}{' '}
                    paid
                  </span>
                </div>
                <div className="space-y-2">
                  {allInvoices.map((inv) => {
                    const total = Array.isArray(inv.lines)
                      ? inv.lines.reduce(
                          (t, l) => t + Number(l.amount ?? l.total ?? l.unit_price ?? 0),
                          0
                        )
                      : 0;
                    const statusColour =
                      inv.status === 'paid'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                        : inv.status === 'overdue'
                          ? 'bg-red-500/15 text-red-300 border-red-500/25'
                          : inv.status === 'sent'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/25'
                            : 'bg-white/10 text-[rgba(153,197,255,0.5)] border-white/10';
                    return (
                      <GlassCard key={inv.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">
                              {inv.invoice_num || 'Invoice'}
                            </p>
                            <p className="text-xs text-[rgba(153,197,255,0.4)]">
                              {inv.date
                                ? new Date(inv.date).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                              {inv.paid_at
                                ? ` · Paid ${new Date(inv.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                                : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {total > 0 && (
                              <p className="text-sm font-bold text-emerald-400">
                                £{total.toFixed(2)}
                              </p>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-lg border font-bold capitalize ${statusColour}`}
                            >
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'growth' && (
          <GrowthTab customer={customer} suggestions={suggestions} onMessage={onMessage} />
        )}

        {activeTab === 'messages' && (
          <>
            <div>
              <SL>Quick message</SL>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Win-back', type: 'winback' },
                  { label: 'Job reminder', type: 'reminder' },
                  { label: 'Deep clean offer', type: 'upsell_deep' },
                  { label: 'Exterior add-on', type: 'crosssell_exterior' },
                ].map(({ label, type }) => (
                  <button
                    key={type}
                    onClick={() => onMessage(customer, { type, title: label })}
                    className="flex items-center gap-2 px-3 py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white rounded-xl text-sm font-semibold transition-all text-left"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <GlassCard className="p-4">
              <SL>Message history</SL>
              <p className="text-xs text-[rgba(153,197,255,0.4)]">
                No messages logged yet. Send your first message above — it will appear here.
              </p>
            </GlassCard>
          </>
        )}

        {activeTab === 'secure' && <SecureVault customer={customer} ownerId={ownerId} />}

        {/* Billing mode — picks how a completed job becomes an invoice for
            this customer. Affects what onJobCompleted() does when the
            Scheduler marks one of their jobs Done. */}
        <GlassCard>
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)] flex items-center gap-2">
            <span className="text-base">💷</span>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.7)]">
              Billing
            </span>
            <span className="ml-auto text-[10px] text-[rgba(153,197,255,0.45)]">
              When a job is done…
            </span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {BILLING_MODES.map((opt) => {
              const active = (customer.billing_mode || 'invoice_per_job') === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => saveCustomer(customer.id, { billing_mode: opt.key })}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    active
                      ? 'border-[#1f48ff] bg-[rgba(31,72,255,0.12)]'
                      : 'border-[rgba(153,197,255,0.12)] bg-[rgba(153,197,255,0.04)] hover:border-[rgba(153,197,255,0.25)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        active ? 'border-[#1f48ff]' : 'border-[rgba(153,197,255,0.3)]'
                      }`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#1f48ff]" />}
                    </span>
                    <span
                      className={`text-[12px] font-black ${active ? 'text-white' : 'text-[rgba(153,197,255,0.85)]'}`}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[rgba(153,197,255,0.55)] mt-1 pl-5 leading-snug">
                    {opt.hint}
                  </p>
                </button>
              );
            })}
            {customer.billing_mode === 'gocardless' && !customer.gc_mandate_id && (
              <p className="text-[10.5px] text-amber-400 mt-1 pl-1">
                ⚠ Set up the Direct Debit mandate below before this can collect.
              </p>
            )}
            {customer.billing_mode === 'stripe' && (
              <p className="text-[10.5px] text-[rgba(153,197,255,0.55)] mt-1 pl-1">
                Invoices will be sent with a Stripe payment link when this customer has an email on
                file.
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)] flex items-center gap-2">
            <span className="text-base">🏦</span>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.7)]">
              Direct Debit
            </span>
            {customer.gc_mandate_status && (
              <span
                className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                  customer.gc_mandate_status === 'active'
                    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                    : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                }`}
              >
                {customer.gc_mandate_status}
              </span>
            )}
          </div>
          <div className="px-4 py-3 space-y-3">
            {!customer.gc_customer_id && (
              <button
                onClick={handleGcSync}
                disabled={gcLoading}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded-xl bg-[rgba(153,197,255,0.1)] border border-[rgba(153,197,255,0.2)] text-[#99c5ff] hover:bg-[rgba(153,197,255,0.18)] transition-all disabled:opacity-50"
              >
                {gcLoading ? 'Syncing…' : 'Set up GoCardless →'}
              </button>
            )}
            {customer.gc_customer_id && !customer.gc_mandate_id && (
              <button
                onClick={handleGcMandateLink}
                disabled={gcLoading}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded-xl bg-[rgba(153,197,255,0.1)] border border-[rgba(153,197,255,0.2)] text-[#99c5ff] hover:bg-[rgba(153,197,255,0.18)] transition-all disabled:opacity-50"
              >
                {gcLoading ? 'Generating…' : 'Get Direct Debit link →'}
              </button>
            )}
            {gcMandateUrl && (
              <div className="rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] p-3 space-y-2">
                <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                  Send this link to {customer.name.split(' ')[0]} to authorise the Direct Debit:
                </p>
                <p className="text-[10px] text-[#99c5ff] break-all font-mono">{gcMandateUrl}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gcMandateUrl);
                    setGcSuccess('Link copied!');
                  }}
                  className="text-[10px] font-bold text-[#99c5ff] hover:text-white transition-colors"
                >
                  Copy link
                </button>
              </div>
            )}
            {customer.gc_customer_id &&
              (!customer.gc_mandate_id ||
                (customer.gc_mandate_status &&
                  !['active'].includes(customer.gc_mandate_status))) && (
                <button
                  onClick={handleGcSyncMandate}
                  disabled={gcLoading}
                  className="w-full py-2 text-[10px] font-bold uppercase tracking-wide rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] hover:border-[rgba(153,197,255,0.25)] transition-all disabled:opacity-50"
                >
                  {gcLoading ? 'Checking…' : '↻ Sync mandate status'}
                </button>
              )}
            {['active', 'submitted', 'pending_submission'].includes(customer.gc_mandate_status) && (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount £"
                  value={gcPayAmount}
                  onChange={(e) => setGcPayAmount(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-white text-xs placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[rgba(153,197,255,0.4)]"
                />
                <button
                  onClick={handleGcCollect}
                  disabled={gcPayLoading || !gcPayAmount}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {gcPayLoading ? '…' : 'Collect'}
                </button>
              </div>
            )}
            {gcError && <p className="text-[11px] text-red-400">{gcError}</p>}
            {gcSuccess && <p className="text-[11px] text-emerald-400">{gcSuccess}</p>}
          </div>
        </GlassCard>

        <ArchiveButton
          onConfirm={() => onDeleteCustomer?.(customer.id)}
          onErase={onEraseCustomer ? () => onEraseCustomer(customer.id) : undefined}
          onExport={onExportCustomer ? () => onExportCustomer(customer.id) : undefined}
          name={customer.name}
        />
      </div>
    </div>
  );
}
