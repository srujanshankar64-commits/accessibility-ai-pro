import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin.utils";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Server admin client is not configured");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const setDevPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetPlan: z.enum(["free", "starter", "agency", "business"]),
    }),
  )
  .handler(async ({ data, context }) => {
    // Server-side admin check using the actual user email from auth
    const { data: { user } } = await context.supabase.auth.getUser();
    if (!user?.email || !isAdmin(user.email)) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { targetPlan } = data;

    // Use service role client to bypass RLS and update plan
    const { error } = await createAdminClient()
      .from("settings")
      .upsert({
        user_id: context.userId,
        plan: targetPlan,
        audits_used: 0,
      });

    if (error) {
      throw new Error(`Failed to set plan: ${error.message}`);
    }

    return { success: true, plan: targetPlan };
  });
