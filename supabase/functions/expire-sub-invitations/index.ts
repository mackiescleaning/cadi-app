/**
 * supabase/functions/expire-sub-invitations/index.ts
 *
 * Cron-driven cleanup — flips sub_invitations rows from `pending` to `expired`
 * once they pass `expires_at`. Runs daily.
 *
 * Auth: caller must send the X-Cron-Secret header matching CRON_SECRET env.
 * (Service role is also fine if called directly from another edge function.)
 *
 * Returns: { expired: N, scanned_at: ISO8601 }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqualStr } from "../_shared/timingSafeEqual.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Auth: require either the cron secret OR a service-role token
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const isCron = Boolean(cronSecret) && timingSafeEqualStr(headerSecret, cronSecret);
  const isService = Boolean(serviceKey) && timingSafeEqualStr(auth, serviceKey);
  if (!isCron && !isService) return json({ error: "Unauthorised" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("sub_invitations")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", nowIso)
      .select("id");

    if (error) return json({ error: error.message }, 500);

    return json({ expired: data?.length ?? 0, scanned_at: nowIso });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
