/**
 * supabase/functions/ai-coach-tasks/index.ts
 * Cadi — AI coaching tasks for the Dashboard
 *
 * Takes a snapshot of the user's dashboard state and returns 3–4 concrete,
 * actionable tasks via Claude. Replaces the deterministic rules in the old
 * AiBoostPanel so the "Cadi AI" label is actually backed by a model.
 *
 * POST body:
 *   {
 *     snapshot: {
 *       score: { total, revScore, opsScore, invoicingScore, complianceScore, growthScore },
 *       accounts: { ytdIncome, annualTarget, taxReserve, taxReserveTarget, ... },
 *       weekJobs:  [{ day, date, revenue, jobs, done, isToday }, ...],
 *       invoices:  [{ customer, amount, status, daysOverdue }, ...],
 *       jobsToday: [{ customer, status, price }, ...],
 *       profile:   { cleaner_type, biz_structure, team_structure }
 *     }
 *   }
 *
 * Response:
 *   {
 *     tasks: [
 *       { emoji, title, body, tab, priority, impact }, ...
 *     ]
 *   }
 *
 * Secrets required: ANTHROPIC_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.88.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function requireUser(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) throw new Error("Missing Authorization header");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Not authenticated");
  return user;
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are a coaching AI for UK cleaning business owners using Cadi, a business management app. Given a snapshot of a user's business dashboard (health score broken into 5 dimensions, revenue, jobs, invoices), suggest 3–4 concrete, specific tasks that will most directly raise their health score and business outcomes over the next 7 days.

Rules:
- Each task must reference their actual data (numbers, customer names, amounts when given).
- Each task must deep-link to a relevant tab: "dashboard", "scheduler", "customers", "invoices", "money", "inventory", "calculator", "review", or "settings".
- Priority: "urgent" for overdue money or same-day blockers, "high" for ops/revenue fixes, "medium" for nice-to-have growth moves.
- Impact is your estimated health-score gain in points (1–20) if they complete the task in the next 7 days.
- Emojis from this set: 💰 ⚡ 📅 🧹 👥 📊 🏃 🛡️ 💷 🚨.
- Keep titles under ~60 chars and bodies under ~140 chars. Sound like a coach, not a textbook.
- If everything looks healthy (all dimensions at or near max), celebrate and suggest one growth move.`;

// NOTE: Anthropic's json_schema output mode rejects these constraints:
//   - array minItems / maxItems (other than 0/1)
//   - number minimum / maximum / multipleOf
//   - string minLength / maxLength
// So task-count range (3–4) and impact range (1–20) are enforced in the
// prompt, not in the schema.
const TASK_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          emoji: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          tab: {
            type: "string",
            enum: [
              "dashboard",
              "scheduler",
              "customers",
              "invoices",
              "money",
              "inventory",
              "calculator",
              "review",
              "settings",
            ],
          },
          priority: { type: "string", enum: ["urgent", "high", "medium"] },
          impact: { type: "integer" },
        },
        required: ["emoji", "title", "body", "tab", "priority", "impact"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireUser(req);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY secret not set" }, 500);

    const { snapshot } = await req.json();
    if (!snapshot) return json({ error: "Missing snapshot in body" }, 400);

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the user's current dashboard snapshot. Generate their personalised task list now.\n\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: TASK_SCHEMA,
        },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return json({ error: "No text response from model" }, 502);
    }

    const parsed = JSON.parse(textBlock.text);
    return json(parsed);
  } catch (err) {
    console.error("ai-coach-tasks error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const status = /authenticat|Authorization/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});
