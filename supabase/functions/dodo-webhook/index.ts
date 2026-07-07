// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PLAN_LIMITS: Record<string, number> = {
  starter: 20,
  agency: 999999,
  business: 999999,
  free: 3,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);
    console.log("Dodo webhook:", event.type, JSON.stringify(event).slice(0, 300));

    const eventType = event.type || event.event_type || "";
    const data = event.data || event.payload || event;
    const metadata = data.metadata || data.payment?.metadata || {};

    const userId = metadata.user_id || metadata.userId || null;
    const userEmail = data.customer?.email || data.email || null;
    const tier = (metadata.tier || "starter").toLowerCase();

    let resolvedUserId = userId;
    if (!resolvedUserId && userEmail) {
      const { data: userData } = await admin.auth.admin.listUsers();
      const matchedUser = userData?.users?.find((u: any) => u.email === userEmail);
      if (matchedUser) resolvedUserId = matchedUser.id;
    }

    if (!resolvedUserId) {
      console.error("Could not resolve user_id");
      return new Response(JSON.stringify({ received: true, warning: "user_id not found" }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    if (
      eventType.includes("payment.succeeded") ||
      eventType.includes("subscription.activated") ||
      eventType.includes("subscription.created") ||
      eventType.includes("payment.completed")
    ) {
      await admin.from("settings").update({
        plan: tier,
        audits_used: 0,
        audits_limit: PLAN_LIMITS[tier] ?? 20,
      }).eq("user_id", resolvedUserId);
      console.log(`Upgraded ${resolvedUserId} to ${tier}`);
    }

    if (
      eventType.includes("subscription.cancelled") ||
      eventType.includes("subscription.expired") ||
      eventType.includes("subscription.deleted")
    ) {
      await admin.from("settings").update({
        plan: "free",
        audits_limit: 3
      }).eq("user_id", resolvedUserId);
      console.log(`Downgraded ${resolvedUserId} to free`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
