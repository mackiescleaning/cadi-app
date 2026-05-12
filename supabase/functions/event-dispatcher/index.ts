/**
 * supabase/functions/event-dispatcher/index.ts
 * Cadi — Job event router.
 *
 * Called via Supabase Database Webhook when a row is inserted into job_events.
 * Routes the event_type to the appropriate agent action.
 *
 * Request body (from Supabase webhook):
 *   { type: "INSERT", table: "job_events", record: { ...job_events row } }
 *
 * Or called directly with:
 *   { event_type, business_id, job_id, payload }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Action risk tiers (mirrors agentFramework.js)
const LOW_RISK_ACTIONS = new Set(["send_quote", "send_review_request", "send_followup"]);

function shouldAutoApprove(trustLevel: string, actionType: string): boolean {
  if (trustLevel === "autonomous") return true;
  if (trustLevel === "cautious")   return false;
  return LOW_RISK_ACTIONS.has(actionType);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  // Normalise: accept both webhook shape and direct call shape
  const record: Record<string, unknown> = (body.record as Record<string, unknown>) ?? body;
  const eventType   = record.event_type   as string;
  const businessId  = record.business_id  as string;
  const jobId       = record.job_id       as string | null;
  const eventId     = record.id           as string | null;
  const payload     = (record.payload     as Record<string, unknown>) ?? {};

  if (!eventType || !businessId) {
    return new Response("Missing event_type or business_id", { status: 400, headers: CORS_HEADERS });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Mark event as being processed
  if (eventId) {
    await sb.from("job_events").update({ processed_at: new Date().toISOString() }).eq("id", eventId);
  }

  // Load business trust level and agent modes
  const [{ data: profileData }, { data: agentData }] = await Promise.all([
    sb.from("profiles").select("trust_level").eq("id",
      // get owner_user_id from businesses
      sb.from("businesses").select("owner_user_id").eq("id", businessId).single()
    ).single(),
    sb.from("agent_settings").select("agent, mode").eq("business_id", businessId),
  ]);

  // Simpler approach: load business then profile
  const { data: biz } = await sb.from("businesses").select("owner_user_id").eq("id", businessId).single();
  const { data: prof } = biz
    ? await sb.from("profiles").select("trust_level, brand_voice").eq("id", biz.owner_user_id).single()
    : { data: null };

  const trustLevel  = prof?.trust_level ?? "cautious";
  const agentModes  = Object.fromEntries((agentData ?? []).map((r: { agent: string; mode: string }) => [r.agent, r.mode]));

  // ── Route event to agent action ────────────────────────────────────────────

  const actions: Array<{
    agent: string;
    action_type: string;
    proposed_payload: Record<string, unknown>;
    reasoning: string;
  }> = [];

  // job_completed → Reviews agent sends review request
  if (eventType === "job_completed") {
    const reviewsMode = agentModes["reviews"] ?? "approval";
    if (reviewsMode !== "off") {
      const { data: job } = jobId
        ? await sb.from("jobs").select("id, customer_id, customers(first_name, last_name, email, mobile)").eq("id", jobId).single()
        : { data: null };

      if (job) {
        const customer = job.customers as Record<string, unknown> | null;
        const firstName = customer?.first_name as string ?? "there";

        actions.push({
          agent:       "reviews",
          action_type: "send_review_request",
          proposed_payload: {
            to:       customer?.email ?? customer?.mobile ?? null,
            channel:  customer?.email ? "email" : "sms",
            customer_name: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim(),
            message:  `Hi ${firstName}! Hope everything's looking great. We'd love it if you could leave us a quick review — it really helps. Thank you so much 🙏`,
            subject:  "How did we do?",
          },
          reasoning: "Job marked as completed — good time to request a review while experience is fresh.",
        });
      }
    }
  }

  // payment_received → Send receipt / follow-up
  if (eventType === "payment_received") {
    const frontDeskMode = agentModes["front_desk"] ?? "approval";
    if (frontDeskMode !== "off" && payload.customer_id) {
      actions.push({
        agent:       "front_desk",
        action_type: "send_followup",
        proposed_payload: {
          channel: "email",
          message: `Hi! Just to confirm we've received your payment — thank you! See you at the next visit.`,
        },
        reasoning: "Payment received — automated receipt confirmation.",
      });
    }
  }

  // Insert agent_actions for each routed action
  for (const action of actions) {
    const autoApprove = shouldAutoApprove(trustLevel, action.action_type);
    const agentMode   = agentModes[action.agent] ?? "approval";

    // Skip if agent is in manual/off mode for auto-sending
    const status =
      agentMode === "off"        ? null :
      agentMode === "autonomous" || autoApprove ? "auto_sent" :
      "pending_approval";

    if (!status) continue;

    const { data: inserted } = await sb
      .from("agent_actions")
      .insert({
        business_id:      businessId,
        agent:            action.agent,
        action_type:      action.action_type,
        status,
        proposed_payload: action.proposed_payload,
        reasoning:        action.reasoning,
        job_id:           jobId ?? null,
        source_event_id:  eventId ?? null,
        sent_at:          status === "auto_sent" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    // For auto_sent review requests, fire the send edge function immediately
    if (status === "auto_sent" && action.action_type === "send_review_request" && inserted?.id) {
      fetch(`${SUPABASE_URL}/functions/v1/send-review-request`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ action_id: inserted.id }),
      }).catch((err: Error) => console.error("send-review-request invoke failed:", err.message));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, routed: actions.length }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
