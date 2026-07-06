/**
 * SurveyQuote.jsx
 * Phase 3 — quote card: send, mark accepted/declined.
 *
 * Props:
 *   survey   — site_surveys row
 *   quote    — quotes row
 *   onAccept — () => void
 *   onDecline— () => void
 */

import { useState } from 'react';
import { updateQuoteStatus, updateSurveyStatus, logComparable } from '../../lib/db/surveyDb';

export default function SurveyQuote({ survey, quote, onAccept, onDecline }) {
  const [status, setStatus] = useState(quote?.status ?? 'draft');
  const [working, setWorking] = useState(null);

  const plan = quote?.cleaning_plan ?? {};
  const services = plan.services ?? quote?.payload?.services ?? [];

  const handleSend = async () => {
    setWorking('send');
    try {
      await updateQuoteStatus(quote.id, 'sent');
      setStatus('sent');
    } catch (err) {
      alert(err.message);
    } finally {
      setWorking(null);
    }
  };

  const handleAccept = async () => {
    setWorking('accept');
    try {
      await updateQuoteStatus(quote.id, 'accepted');
      await updateSurveyStatus(survey.id, 'accepted');
      // Log comparable for future pricing
      await logComparable({
        serviceTags: services.map((s) => s.name?.toLowerCase().replace(/\s+/g, '_')),
        propertySize: null,
        involvesHeight: false,
        finalPrice: quote.price,
        frequency: plan.schedule?.frequency ?? null,
      }).catch(() => {}); // non-fatal
      setStatus('accepted');
      onAccept?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setWorking(null);
    }
  };

  const handleDecline = async () => {
    setWorking('decline');
    try {
      await updateQuoteStatus(quote.id, 'declined');
      setStatus('declined');
      onDecline?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setWorking(null);
    }
  };

  const statusColour = {
    draft: 'bg-white/10 text-[rgba(153,197,255,0.6)] border-[rgba(153,197,255,0.15)]',
    sent: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    declined: 'bg-red-500/15 text-red-300 border-red-500/25',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Quote card */}
      <div className="rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-0.5">
              Quote
            </p>
            <p className="text-white font-bold">{survey.customers?.name ?? '—'}</p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-lg border text-xs font-bold capitalize ${statusColour[status] ?? statusColour.draft}`}
          >
            {status}
          </span>
        </div>

        <div className="px-4 py-4">
          {/* Services */}
          {services.length > 0 && (
            <div className="mb-4">
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 border-b border-[rgba(153,197,255,0.06)] last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{svc.name}</p>
                    {svc.frequency && (
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{svc.frequency}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex items-end justify-between pt-2">
            <div>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                {plan.schedule?.frequency === 'one_off'
                  ? 'Total'
                  : `Per visit (${plan.schedule?.frequency ?? ''})`}
              </p>
              {plan.schedule?.first_visit && (
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                  First visit:{' '}
                  {new Date(plan.schedule.first_visit).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
            <p className="text-3xl font-black text-white">
              £{Number(quote?.price ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {status === 'draft' && (
        <button
          onClick={handleSend}
          disabled={working === 'send'}
          className="w-full h-11 rounded-xl bg-[#1f48ff] hover:bg-[#2a55ff] disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          {working === 'send' ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending…
            </>
          ) : (
            'Mark as sent to customer'
          )}
        </button>
      )}

      {(status === 'draft' || status === 'sent') && (
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            disabled={Boolean(working)}
            className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {working === 'accept' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Accepting…
              </>
            ) : (
              'Quote accepted →'
            )}
          </button>
          <button
            onClick={handleDecline}
            disabled={Boolean(working)}
            className="flex-1 h-11 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-40 text-red-400 font-bold text-sm transition-colors"
          >
            Declined
          </button>
        </div>
      )}

      {status === 'accepted' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <p className="text-sm font-bold text-emerald-300">Quote accepted</p>
            <p className="text-xs text-emerald-400/70">
              Scroll down to assemble the onboarding pack
            </p>
          </div>
        </div>
      )}

      {status === 'declined' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <span className="text-red-400">✕</span>
          <p className="text-sm text-red-300">Quote declined — survey archived.</p>
        </div>
      )}
    </div>
  );
}
