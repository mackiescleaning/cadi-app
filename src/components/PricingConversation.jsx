import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Check, RotateCcw, Loader2, ChevronDown } from 'lucide-react';

// ─── Services list (same as PricingSettings) ──────────────────────────────────

const ALL_SERVICES = [
  { key: 'regular_clean', label: 'Regular home clean', cat: 'residential' },
  { key: 'deep_clean', label: 'Deep clean', cat: 'residential' },
  { key: 'end_of_tenancy_clean', label: 'End of tenancy clean', cat: 'residential' },
  { key: 'spring_clean', label: 'Spring clean', cat: 'residential' },
  { key: 'post_renovation_clean', label: 'Post-renovation clean', cat: 'residential' },
  { key: 'one_off_clean', label: 'One-off clean', cat: 'residential' },
  { key: 'softwash_render', label: 'Softwash / render clean', cat: 'exterior' },
  { key: 'driveway_clean', label: 'Driveway / pressure wash', cat: 'exterior' },
  { key: 'patio_clean', label: 'Patio clean', cat: 'exterior' },
  { key: 'gutter_clean', label: 'Gutter clean', cat: 'exterior' },
  { key: 'window_clean_exterior', label: 'Window clean (exterior)', cat: 'exterior' },
  { key: 'fascia_soffit_clean', label: 'Fascia & soffit clean', cat: 'exterior' },
  { key: 'roof_clean', label: 'Roof clean / moss treatment', cat: 'exterior' },
  { key: 'decking_clean', label: 'Decking clean', cat: 'exterior' },
  { key: 'garden_furniture_clean', label: 'Garden furniture clean', cat: 'exterior' },
  { key: 'office_clean', label: 'Office clean', cat: 'commercial' },
  { key: 'school_clean', label: 'School clean', cat: 'commercial' },
  { key: 'retail_clean', label: 'Retail clean', cat: 'commercial' },
  { key: 'medical_clean', label: 'Medical / dental clean', cat: 'commercial' },
  { key: 'industrial_clean', label: 'Industrial clean', cat: 'commercial' },
  { key: 'communal_areas_clean', label: 'Communal areas', cat: 'commercial' },
  { key: 'washroom_service', label: 'Washroom service', cat: 'commercial' },
];

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(serviceKey, serviceLabel) {
  const serviceContext = serviceKey
    ? `The owner wants to configure pricing for: ${serviceLabel} (service key: "${serviceKey}").`
    : 'Ask the owner which service they want to configure pricing for first.';

  return `You are Cadi's pricing setup assistant. You help UK cleaning business owners configure their service pricing through natural conversation.

${serviceContext}

## Your goal
Extract enough information to create a complete pricing rule, then present it for the owner's confirmation.

## Pricing methods (choose the best fit)
- **per_bedroom**: Different prices per bedroom count (1-bed, 2-bed, 3-bed etc). Most common for residential cleaning.
- **per_bedroom_bathroom**: Base price + rate per bedroom + rate per bathroom. Use when bathroom count varies significantly.
- **per_sqm**: Rate per square metre. Best for driveways, renders, patios, exterior surfaces.
- **per_hour**: Hourly rate × estimated hours by property size. Flexible, good when jobs vary a lot.
- **flat_rate_by_size**: Fixed prices for size buckets (small/medium/large/extra-large). Good for exterior or simple services.
- **flat_rate_fixed**: One price for all jobs. Best for simple, consistent services (gutter clean, window clean).
- **site_visit_required**: Commercial and complex jobs — no instant quote, book a site visit.

## Conversation rules
- Ask ONE question at a time — never multiple questions in one message
- Be warm, friendly, and professional — not robotic
- Accept approximate answers ("about £80" is fine)
- If a price seems unusually low (under £20 for a house clean), gently double-check: "Just checking — did you mean £X?"
- For residential services: start by asking about 3-bedroom pricing (the most common), then work outward
- For exterior services: ask if they price by size/m² or a flat rate
- Keep messages short — 1-3 sentences maximum
- After 4-6 questions, you should have enough to build the rule

## What to gather
1. Pricing method (figure this out from how they describe their prices)
2. Specific prices for each size/bedroom/rate
3. Frequency modifiers: do they charge more for one-offs? Less for weekly regulars?
4. Minimum charge (if any)
5. Any common add-ons they offer

## Frequency modifier defaults (use these unless they say otherwise)
Weekly: 10% discount (×0.90), Fortnightly: standard (×1.00), 4-weekly: +5% (×1.05), Monthly: +5% (×1.05), One-off: +25% (×1.25)

## When to output the rule
After the owner confirms the proposed pricing looks correct, output their rule in this exact format — no markdown, just the sentinel markers and valid JSON:

RULE_JSON_START
{
  "service": "service_key_here",
  "service_label": "Human readable label",
  "category": "residential",
  "pricing_method": "per_bedroom",
  "base_amounts": {},
  "frequency_modifiers": { "weekly": 0.90, "fortnightly": 1.00, "four_weekly": 1.05, "monthly": 1.05, "one_off": 1.25 },
  "minimum_price": null,
  "addons": []
}
RULE_JSON_END

The "addons" array contains objects: { "name": string, "price": number, "duration_minutes_added": number | null }

## base_amounts format per method
- per_bedroom: { "1": 55, "2": 65, "3": 80, "4": 95, "5": 110, "6_plus_per_extra": 15 }
- per_bedroom_bathroom: { "base": 30, "per_bedroom": 15, "per_bathroom": 10 }
- per_sqm: { "rate_per_sqm": 3.50 }
- per_hour: { "hourly_rate": 25, "estimated_hours_by_size": { "1_bed": 1.5, "2_bed": 2.5, "3_bed": 3, "4_bed": 4, "5_bed": 5 } }
- flat_rate_by_size: { "small": { "price": 60, "max_sqm": 30 }, "medium": { "price": 90, "max_sqm": 80 }, "large": { "price": 130, "max_sqm": 150 }, "extra_large": { "price": 180, "max_sqm": null } }
- flat_rate_fixed: { "price": 80 }

Start the conversation now.`;
}

// ─── Parse rule from AI response ─────────────────────────────────────────────

function parseRuleFromText(text) {
  const start = text.indexOf('RULE_JSON_START');
  const end = text.indexOf('RULE_JSON_END');
  if (start === -1 || end === -1) return null;
  const jsonStr = text.slice(start + 'RULE_JSON_START'.length, end).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function cleanMessageText(text) {
  const start = text.indexOf('RULE_JSON_START');
  if (start === -1) return text;
  return text.slice(0, start).trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RulePreview({ rule }) {
  const method = rule.pricing_method?.replace(/_/g, ' ');
  const amounts = rule.base_amounts ?? {};

  return (
    <div className="mt-3 rounded-xl border border-[#1f48ff]/20 bg-[#f0f4ff] p-4 text-xs space-y-2">
      <div className="flex items-center gap-1.5 font-bold text-[#1f48ff] text-sm">
        <Check size={14} />
        Proposed pricing rule
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
        <span className="font-medium text-gray-500">Service</span>
        <span>{rule.service_label ?? rule.service}</span>
        <span className="font-medium text-gray-500">Method</span>
        <span className="capitalize">{method}</span>
        {rule.minimum_price && (
          <>
            <span className="font-medium text-gray-500">Minimum</span>
            <span>£{rule.minimum_price}</span>
          </>
        )}
      </div>

      {rule.pricing_method === 'per_bedroom' && (
        <div className="grid grid-cols-5 gap-1 pt-1">
          {['1', '2', '3', '4', '5'].map(
            (n) =>
              amounts[n] != null && (
                <div
                  key={n}
                  className="bg-white rounded-lg p-1.5 text-center border border-[#99c5ff]/30"
                >
                  <p className="text-[10px] text-gray-400">{n} bed</p>
                  <p className="font-bold text-[#010a4f]">£{amounts[n]}</p>
                </div>
              )
          )}
        </div>
      )}

      {rule.pricing_method === 'flat_rate_fixed' && amounts.price && (
        <div className="bg-white rounded-lg p-2 text-center border border-[#99c5ff]/30">
          <p className="font-bold text-[#010a4f] text-base">£{amounts.price}</p>
          <p className="text-[10px] text-gray-400">fixed price</p>
        </div>
      )}

      {rule.pricing_method === 'per_sqm' && amounts.rate_per_sqm && (
        <div className="bg-white rounded-lg p-2 text-center border border-[#99c5ff]/30">
          <p className="font-bold text-[#010a4f] text-base">£{amounts.rate_per_sqm}/m²</p>
        </div>
      )}

      {rule.pricing_method === 'per_hour' && amounts.hourly_rate && (
        <div className="bg-white rounded-lg p-2 text-center border border-[#99c5ff]/30">
          <p className="font-bold text-[#010a4f] text-base">£{amounts.hourly_rate}/hour</p>
        </div>
      )}

      {rule.pricing_method === 'flat_rate_by_size' && (
        <div className="grid grid-cols-2 gap-1 pt-1">
          {['small', 'medium', 'large', 'extra_large'].map(
            (s) =>
              amounts[s]?.price != null && (
                <div key={s} className="bg-white rounded-lg p-1.5 border border-[#99c5ff]/30">
                  <p className="text-[10px] text-gray-400 capitalize">{s.replace('_', ' ')}</p>
                  <p className="font-bold text-[#010a4f]">£{amounts[s].price}</p>
                </div>
              )
          )}
        </div>
      )}

      {rule.addons?.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Add-ons</p>
          <div className="space-y-0.5">
            {rule.addons.map((a, i) => (
              <div key={i} className="flex justify-between text-gray-600">
                <span>{a.name}</span>
                <span className="tabular-nums">+£{a.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ role, text, rule }) {
  const isUser = role === 'user';
  const displayText = cleanMessageText(text);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-[#1f48ff] text-white rounded-br-sm'
            : 'bg-white border border-[#99c5ff]/30 text-[#010a4f] rounded-bl-sm shadow-sm'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
        {rule && <RulePreview rule={rule} />}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PricingConversation({ businessId, onRuleSaved, initialService }) {
  const [serviceKey, setServiceKey] = useState(initialService?.key ?? '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRule, setPendingRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const selectedService = ALL_SERVICES.find((s) => s.key === serviceKey);

  const startConversation = async (svcKey) => {
    const svc = ALL_SERVICES.find((s) => s.key === svcKey);
    setStarted(true);
    setMessages([]);
    setPendingRule(null);
    setSaved(false);
    setError(null);
    setLoading(true);

    const system = buildSystemPrompt(svcKey || null, svc?.label ?? '');
    const initMessages = [{ role: 'user', content: 'Hello, I want to set up my pricing.' }];

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-generate', {
        body: {
          messages: initMessages,
          system,
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
        },
      });
      if (fnError) throw fnError;
      const reply = data?.content?.[0]?.text ?? 'Sorry, something went wrong.';
      const rule = parseRuleFromText(reply);
      if (rule) setPendingRule(rule);
      setMessages([{ role: 'assistant', text: reply, rule }]);
    } catch {
      setError('Could not connect to Cadi AI. Please try again.');
      setStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newUserMsg = { role: 'user', text };
    const nextHistory = [...messages, newUserMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setPendingRule(null);
    setError(null);

    const svc = selectedService;
    const system = buildSystemPrompt(serviceKey || null, svc?.label ?? '');

    const apiMessages = nextHistory.map((m) => ({
      role: m.role,
      content: m.role === 'user' ? m.text : cleanMessageText(m.text),
    }));

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-generate', {
        body: {
          messages: apiMessages,
          system,
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
        },
      });
      if (fnError) throw fnError;
      const reply = data?.content?.[0]?.text ?? 'Sorry, something went wrong.';
      const rule = parseRuleFromText(reply);
      if (rule) setPendingRule(rule);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, rule }]);
    } catch {
      setError('Message failed to send. Please try again.');
      setMessages((prev) => prev.filter((m) => m !== newUserMsg));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async () => {
    if (!pendingRule || !businessId) return;
    setSaving(true);
    setError(null);

    try {
      // Archive existing active rule for this service
      await supabase
        .from('pricing_rules')
        .update({ status: 'archived' })
        .eq('business_id', businessId)
        .eq('service', pendingRule.service)
        .eq('status', 'active');

      const { error: insertError } = await supabase.from('pricing_rules').insert({
        business_id: businessId,
        service: pendingRule.service,
        service_label: pendingRule.service_label ?? pendingRule.service,
        category: pendingRule.category ?? 'residential',
        pricing_method: pendingRule.pricing_method,
        base_amounts: pendingRule.base_amounts ?? {},
        frequency_modifiers: pendingRule.frequency_modifiers ?? null,
        minimum_price: pendingRule.minimum_price ?? null,
        status: 'active',
        version: 1,
        source: 'conversation',
      });

      if (insertError) throw insertError;

      // Save add-ons if any
      if (pendingRule.addons?.length > 0) {
        const addonRows = pendingRule.addons.map((a, i) => ({
          business_id: businessId,
          service: pendingRule.service,
          name: a.name,
          price: a.price,
          duration_minutes_added: a.duration_minutes_added ?? null,
          active: true,
          display_mode: 'common',
          display_order: i,
        }));
        await supabase.from('pricing_addons').insert(addonRows);
      }

      setSaved(true);
      onRuleSaved?.();
    } catch {
      setError('Could not save the rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Before starting ──

  if (!started) {
    return (
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Set up pricing with AI</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Answer a few questions and Cadi will build your pricing rule automatically.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Which service do you want to price?
            </label>
            <div className="relative">
              <select
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm bg-white focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 pr-8"
              >
                <option value="">Let Cadi ask me</option>
                <optgroup label="Residential">
                  {ALL_SERVICES.filter((s) => s.cat === 'residential').map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Exterior">
                  {ALL_SERVICES.filter((s) => s.cat === 'exterior').map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Commercial">
                  {ALL_SERVICES.filter((s) => s.cat === 'commercial').map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <button
            onClick={() => startConversation(serviceKey)}
            className="w-full py-3.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/20 flex items-center justify-center gap-2"
          >
            Start pricing setup
          </button>

          <p className="text-center text-xs text-gray-400">
            Takes about 2 minutes · You can edit the rule manually afterwards
          </p>
        </div>
      </div>
    );
  }

  // ── Chat interface ──

  return (
    <div
      className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden flex flex-col"
      style={{ height: '70vh', minHeight: '500px' }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="font-bold text-[#010a4f] text-sm">
            Pricing setup{selectedService ? ` · ${selectedService.label}` : ''}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Powered by Cadi AI</p>
        </div>
        <button
          onClick={() => {
            setStarted(false);
            setMessages([]);
            setPendingRule(null);
            setSaved(false);
            setError(null);
          }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
        >
          <RotateCcw size={12} />
          Start over
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.text} rule={msg.rule} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#99c5ff]/30 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 size={14} className="text-[#1f48ff] animate-spin" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-center">
            <p className="text-xs text-red-500 bg-red-50 inline-block px-3 py-1.5 rounded-lg">
              {error}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Save rule panel */}
      {pendingRule && !saved && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between gap-3">
          <p className="text-xs text-green-700 font-medium">
            Rule ready to save for{' '}
            <strong>{pendingRule.service_label ?? pendingRule.service}</strong>
          </p>
          <button
            onClick={saveRule}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      )}
      {saved && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2">
          <Check size={14} className="text-green-600" />
          <p className="text-xs text-green-700 font-medium">
            Pricing rule saved for {pendingRule?.service_label ?? pendingRule?.service}. You can
            test it in the sandbox.
          </p>
        </div>
      )}

      {/* Input */}
      {!saved && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type your answer…"
            disabled={loading}
            className="flex-1 px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 resize-none disabled:opacity-50"
            style={{ maxHeight: '100px', overflowY: 'auto' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
