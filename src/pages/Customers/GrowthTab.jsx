import { useState, useEffect, useCallback } from "react";
import { usePlan } from "../../hooks/usePlan";
import { UpgradeBanner } from "../../components/UpgradePrompt";
import { GlassCard, GlassSurface, SL, Chip, Alert, PriorityBadge } from "./primitives";
import {
  listCustomerServices, upsertCustomerService, removeCustomerService,
  listServiceCalendar, upsertCalendarEntry, setCalendarStatus, removeCalendarEntry,
  getActiveSalesPlan, generateSalesPlan,
  listOutreach, updateOutreachDraft, sendOutreach, dismissOutreach, markOutreachConverted,
  getCrmMetrics,
} from "../../lib/db/customerCrmDb";

// Growth tab — the per-customer revenue engine (migration 080 backend).
// Sections: CRM metric tiles → Cadi sales plan (AI, Pro-gated) → annual
// service calendar → service ledger → heuristic quick wins (the old
// Suggestions tab, folded in here so there's one opportunities surface).

const TYPE_META = {
  upsell:             { label: "Upsell",     color: "blue"   },
  cross_sell:         { label: "Cross-sell", color: "purple" },
  frequency_increase: { label: "More often", color: "sky"    },
  annual_service:     { label: "Annual",     color: "amber"  },
  winback:            { label: "Win-back",   color: "red"    },
};

const LEDGER_STATUS = {
  active:   { chip: "green", label: "active",   next: "lapsed"   },
  lapsed:   { chip: "amber", label: "lapsed",   next: "prospect" },
  prospect: { chip: "purple", label: "prospect", next: "active"   },
};

const CAL_STATUS_CHIP = {
  planned: "gray", offered: "blue", booked: "sky", done: "green", skipped: "red",
};

const monthLabel = (d) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const gbp = (n) => `£${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function GrowthTab({ customer, suggestions = [], onMessage }) {
  const { isPro } = usePlan();
  const firstName = (customer.name || "").split(" ")[0] || "them";

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [ledger, setLedger]       = useState([]);
  const [plan, setPlan]           = useState(null);
  const [outreach, setOutreach]   = useState([]);
  const [calendar, setCalendar]   = useState([]);
  const [generating, setGenerating] = useState(false);

  const [expandedKey, setExpandedKey] = useState(null);
  const [draft, setDraft]             = useState(null); // { id, subject, body }
  const [busyId, setBusyId]           = useState(null);
  const [winningId, setWinningId]     = useState(null);
  const [winValue, setWinValue]       = useState("");

  const [newService, setNewService] = useState(null); // { label, frequency, price }
  const [newCal, setNewCal]         = useState(null); // { label, month, price }

  const reload = useCallback(async () => {
    try {
      const [m, l, p, o, c] = await Promise.all([
        getCrmMetrics(customer.id),
        listCustomerServices(customer.id),
        getActiveSalesPlan(customer.id),
        listOutreach({ customerId: customer.id }),
        listServiceCalendar({ customerId: customer.id }),
      ]);
      setMetrics(m); setLedger(l); setPlan(p); setOutreach(o); setCalendar(c);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => {
    setLoading(true);
    setExpandedKey(null); setDraft(null); setWinningId(null);
    setNewService(null); setNewCal(null);
    reload();
  }, [reload]);

  const handleGenerate = async () => {
    setGenerating(true); setError(null);
    try {
      await generateSalesPlan(customer.id);
      await reload();
    } catch (e) {
      setError(`Plan generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (row) => {
    setBusyId(row.id); setError(null);
    try {
      if (draft?.id === row.id) {
        await updateOutreachDraft(row.id, { subject: draft.subject, body: draft.body });
      }
      const res = await sendOutreach(row.id);
      if (res?.dry_run) setError("Email service not configured — marked sent without delivering.");
      setDraft(null); setExpandedKey(null);
      await reload();
    } catch (e) {
      setError(`Send failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleWin = async (row) => {
    setBusyId(row.id);
    try {
      await markOutreachConverted(row.id, { value: winValue !== "" ? Number(winValue) : null });
      setWinningId(null); setWinValue("");
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  };

  const outreachFor = (key) =>
    outreach.find((o) => o.opportunity_key === key && o.plan_id === plan?.id && o.status !== "dismissed");

  const opportunities = Array.isArray(plan?.opportunities) ? plan.opportunities : [];

  const inputCls = "bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors";

  if (loading) {
    return <p className="text-xs text-[rgba(153,197,255,0.4)] py-2">Loading growth data…</p>;
  }

  return (
    <>
      {error && <Alert type="red">{error}</Alert>}

      {/* ── Metric tiles ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "12-mo revenue", value: gbp(metrics?.revenue_12m), accent: "text-emerald-600" },
          { label: "Avg visit",     value: metrics?.avg_visit_value != null ? gbp(metrics.avg_visit_value) : "—", accent: "text-[#010a4f]" },
          {
            label: "Plan potential",
            value: plan?.potential_annual_value != null ? `+${gbp(plan.potential_annual_value)}/yr` : "—",
            accent: "text-[#1f48ff]",
          },
        ].map(({ label, value, accent }) => (
          <GlassSurface key={label} tone="light" depth="static" className="px-2 py-2 text-center">
            <p className="text-[10px] text-[#010a4f]/55 mb-0.5 font-semibold tracking-wide uppercase">{label}</p>
            <p className={`text-base font-black ${accent}`}>{value}</p>
          </GlassSurface>
        ))}
      </div>

      {/* ── Cadi sales plan ── */}
      <GlassCard>
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.7)]">✨ Cadi sales plan</p>
            {plan && (
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">
                Generated {new Date(plan.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
          {isPro && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 text-white text-[11px] font-bold transition-all shadow-lg shadow-[#1f48ff]/25"
            >
              {generating ? "Thinking…" : plan ? "↻ Regenerate" : "Generate plan"}
            </button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          {!isPro ? (
            <UpgradeBanner compact reason="Cadi's AI sales plans are a Pro feature." />
          ) : generating ? (
            <p className="text-xs text-[rgba(153,197,255,0.6)] leading-relaxed animate-pulse">
              Cadi is studying {firstName}'s history, your catalogue and their spending pattern — drafting the emails now…
            </p>
          ) : !plan ? (
            <p className="text-xs text-[rgba(153,197,255,0.5)] leading-relaxed">
              No plan yet. Cadi will study this customer's history against your service list, pick the upsells and
              annual services most likely to land, and pre-write the emails — you just approve and send.
            </p>
          ) : (
            <>
              {plan.summary && (
                <p className="text-xs text-[rgba(153,197,255,0.75)] leading-relaxed">{plan.summary}</p>
              )}

              {opportunities.map((opp) => {
                const meta = TYPE_META[opp.type] ?? { label: opp.type, color: "gray" };
                const row  = outreachFor(opp.key);
                const open = expandedKey === opp.key;
                const sendable = row && ["draft", "pending_approval", "approved"].includes(row.status);
                const sent     = row?.status === "sent";
                const won      = row?.converted_at != null;

                return (
                  <div key={opp.key} className="rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(153,197,255,0.03)] overflow-hidden">
                    <button
                      onClick={() => {
                        setExpandedKey(open ? null : opp.key);
                        setDraft(open || !row ? null : { id: row.id, subject: row.subject ?? "", body: row.body ?? "" });
                      }}
                      className="w-full text-left px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-white truncate">{opp.label}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {won ? (
                            <Chip color="green">Won {row.converted_value != null ? gbp(row.converted_value) : ""}</Chip>
                          ) : sent ? (
                            <Chip color="sky">Sent</Chip>
                          ) : (
                            <>
                              <Chip color={meta.color}>{meta.label}</Chip>
                              {opp.price_estimate != null && <Chip color="green">~{gbp(opp.price_estimate)}</Chip>}
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-[rgba(153,197,255,0.55)] leading-snug">
                        {opp.rationale}
                        {opp.suggested_month && (
                          <span className="text-amber-300/80"> · {monthLabel(`${opp.suggested_month}-01`)}</span>
                        )}
                      </p>
                    </button>

                    {open && row && (
                      <div className="px-3 pb-3 space-y-2 border-t border-[rgba(153,197,255,0.08)] pt-2.5">
                        {sendable ? (
                          <>
                            <input
                              value={draft?.subject ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                              className={`w-full ${inputCls}`}
                              placeholder="Subject"
                            />
                            <textarea
                              value={draft?.body ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                              rows={5}
                              className={`w-full resize-none ${inputCls}`}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSend(row)}
                                disabled={busyId === row.id || !customer.email}
                                title={customer.email ? "" : "No email address on file"}
                                className="flex-1 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all"
                              >
                                {busyId === row.id ? "Sending…" : `Send to ${firstName} →`}
                              </button>
                              <button
                                onClick={async () => { await dismissOutreach(row.id); setExpandedKey(null); reload(); }}
                                className="px-3 py-2 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:text-red-300 hover:border-red-400/30 text-xs font-bold transition-all"
                              >
                                Dismiss
                              </button>
                            </div>
                            {!customer.email && (
                              <p className="text-[10px] text-amber-400">Add an email address to this customer to send.</p>
                            )}
                          </>
                        ) : sent && !won ? (
                          <div className="space-y-2">
                            <p className="text-[11px] text-[rgba(153,197,255,0.55)]">
                              Sent {row.sent_at ? new Date(row.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}.
                              Did it land a booking?
                            </p>
                            {winningId === row.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={winValue}
                                  onChange={(e) => setWinValue(e.target.value)}
                                  placeholder={opp.price_estimate != null ? `£${opp.price_estimate}` : "Value £"}
                                  className={`flex-1 ${inputCls}`}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleWin(row)}
                                  disabled={busyId === row.id}
                                  className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-40"
                                >
                                  {busyId === row.id ? "…" : "Confirm"}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setWinningId(row.id); setWinValue(opp.price_estimate != null ? String(opp.price_estimate) : ""); }}
                                className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-black hover:bg-emerald-500/25 transition-all"
                              >
                                ✓ Mark won
                              </button>
                            )}
                          </div>
                        ) : won ? (
                          <p className="text-[11px] text-emerald-300">
                            Converted {new Date(row.converted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {row.converted_value != null ? ` — ${gbp(row.converted_value)}` : ""} 🎉
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </GlassCard>

      {/* ── Annual service calendar ── */}
      <GlassCard>
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>📅 Annual service calendar</SL>
          <button
            onClick={() => setNewCal(newCal ? null : { label: "", month: "", price: "" })}
            className="text-[10px] font-bold text-[#99c5ff] hover:text-white transition-colors"
          >
            {newCal ? "Cancel" : "+ Add"}
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {newCal && (
            <div className="space-y-2 pb-2 border-b border-[rgba(153,197,255,0.08)]">
              <input value={newCal.label} onChange={(e) => setNewCal({ ...newCal, label: e.target.value })}
                placeholder="Service (e.g. Gutter clean)" className={`w-full ${inputCls}`} autoFocus />
              <div className="flex gap-2">
                <input type="month" value={newCal.month} onChange={(e) => setNewCal({ ...newCal, month: e.target.value })}
                  className={`flex-1 ${inputCls}`} />
                <input type="number" value={newCal.price} onChange={(e) => setNewCal({ ...newCal, price: e.target.value })}
                  placeholder="£" className={`w-24 ${inputCls}`} />
              </div>
              <button
                onClick={async () => {
                  if (!newCal.label.trim() || !newCal.month) return;
                  try {
                    await upsertCalendarEntry({
                      customerId: customer.id,
                      label: newCal.label.trim(),
                      plannedMonth: `${newCal.month}-01`,
                      priceEstimate: newCal.price !== "" ? Number(newCal.price) : null,
                    });
                    setNewCal(null); reload();
                  } catch (e) { setError(e.message); }
                }}
                disabled={!newCal.label.trim() || !newCal.month}
                className="w-full py-2 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all"
              >
                Add to calendar
              </button>
            </div>
          )}

          {calendar.length === 0 && !newCal ? (
            <p className="text-xs text-[rgba(153,197,255,0.4)]">
              Nothing planned yet. Annual services (gutters, deep cleans, conservatory roofs…) live here —
              generate a plan or add one manually.
            </p>
          ) : (
            calendar.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-1.5">
                <div className="shrink-0 w-16 text-center rounded-lg bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] px-1 py-1">
                  <p className="text-[10px] font-black text-[#99c5ff] uppercase">{monthLabel(entry.planned_month)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{entry.label}</p>
                  {entry.price_estimate != null && (
                    <p className="text-[10px] text-emerald-400 font-bold">~{gbp(entry.price_estimate)}</p>
                  )}
                </div>
                <Chip color={CAL_STATUS_CHIP[entry.status] ?? "gray"}>{entry.status}</Chip>
                {["planned", "offered"].includes(entry.status) && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setCalendarStatus(entry.id, "booked").then(reload).catch((e) => setError(e.message))}
                      title="Mark booked"
                      className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/30 transition-all"
                    >✓</button>
                    <button
                      onClick={() => setCalendarStatus(entry.id, "skipped").then(reload).catch((e) => setError(e.message))}
                      title="Skip this year"
                      className="w-6 h-6 rounded-lg bg-white/5 border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)] text-[10px] font-black hover:text-red-300 hover:border-red-400/30 transition-all"
                    >✕</button>
                  </div>
                )}
                {entry.status === "booked" && (
                  <button
                    onClick={() => setCalendarStatus(entry.id, "done").then(reload).catch((e) => setError(e.message))}
                    className="shrink-0 px-2 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/30 transition-all"
                  >Done</button>
                )}
                {entry.status === "skipped" && (
                  <button
                    onClick={() => removeCalendarEntry(entry.id).then(reload).catch((e) => setError(e.message))}
                    title="Remove"
                    className="shrink-0 w-6 h-6 rounded-lg text-[rgba(153,197,255,0.3)] hover:text-red-300 text-[10px] font-black transition-all"
                  >🗑</button>
                )}
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* ── Service ledger ── */}
      <GlassCard>
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>🧾 Services this customer uses</SL>
          <button
            onClick={() => setNewService(newService ? null : { label: "", frequency: "", price: "" })}
            className="text-[10px] font-bold text-[#99c5ff] hover:text-white transition-colors"
          >
            {newService ? "Cancel" : "+ Add"}
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {newService && (
            <div className="space-y-2 pb-2 border-b border-[rgba(153,197,255,0.08)]">
              <input value={newService.label} onChange={(e) => setNewService({ ...newService, label: e.target.value })}
                placeholder="Service name" className={`w-full ${inputCls}`} autoFocus />
              <div className="flex gap-2">
                <input value={newService.frequency} onChange={(e) => setNewService({ ...newService, frequency: e.target.value })}
                  placeholder="Frequency (e.g. monthly)" className={`flex-1 ${inputCls}`} />
                <input type="number" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  placeholder="£" className={`w-24 ${inputCls}`} />
              </div>
              <button
                onClick={async () => {
                  if (!newService.label.trim()) return;
                  try {
                    await upsertCustomerService({
                      customerId: customer.id,
                      label: newService.label.trim(),
                      frequency: newService.frequency.trim() || null,
                      price: newService.price !== "" ? Number(newService.price) : null,
                    });
                    setNewService(null); reload();
                  } catch (e) { setError(e.message); }
                }}
                disabled={!newService.label.trim()}
                className="w-full py-2 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all"
              >
                Add service
              </button>
            </div>
          )}

          {ledger.length === 0 && !newService ? (
            <p className="text-xs text-[rgba(153,197,255,0.4)]">No services tracked yet — they'll appear from job history, or add one.</p>
          ) : (
            ledger.map((svc) => {
              const st = LEDGER_STATUS[svc.status] ?? LEDGER_STATUS.active;
              return (
                <div key={svc.id} className="flex items-center gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{svc.label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.45)]">
                      {[
                        svc.frequency,
                        svc.price != null ? gbp(svc.price) : null,
                        svc.last_used_at ? `last ${new Date(svc.last_used_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : null,
                      ].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {svc.total_revenue > 0 && (
                    <span className="shrink-0 text-[10px] font-bold text-emerald-400">{gbp(svc.total_revenue)}</span>
                  )}
                  <button
                    onClick={() => upsertCustomerService({
                      id: svc.id, customerId: customer.id, label: svc.label,
                      status: st.next, frequency: svc.frequency, price: svc.price, source: svc.source,
                    }).then(reload).catch((e) => setError(e.message))}
                    title={`Change to ${st.next}`}
                    className="shrink-0"
                  >
                    <Chip color={st.chip}>{st.label}</Chip>
                  </button>
                  {svc.source === "manual" && (
                    <button
                      onClick={() => removeCustomerService(svc.id).then(reload).catch((e) => setError(e.message))}
                      title="Remove"
                      className="shrink-0 text-[rgba(153,197,255,0.3)] hover:text-red-300 text-xs transition-colors"
                    >✕</button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {/* ── Heuristic quick wins (the old Suggestions tab) ── */}
      {suggestions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <SL>⚡ Quick wins</SL>
            <Chip color="amber">{suggestions.length}</Chip>
          </div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] ${
                s.priority === "urgent" ? "border-l-[3px] border-l-red-400"
                : s.priority === "high" ? "border-l-[3px] border-l-amber-400"
                : "border-l-[3px] border-l-[#99c5ff]"
              }`}
              style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-white">{s.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={s.priority} />
                    {s.value > 0 && <Chip color="green">+£{s.value}</Chip>}
                  </div>
                </div>
                <p className="text-xs text-[rgba(153,197,255,0.7)] leading-relaxed mb-3">{s.body}</p>
                <button
                  onClick={() => onMessage?.(customer, s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25"
                >
                  {s.action}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
