import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data from all tables
    await supabase.from("settings").delete().eq("user_id", userId);
    await supabase.from("audits").delete().eq("user_id", userId);
    await supabase.from("proposals").delete().eq("user_id", userId);
    await supabase.from("referrals").delete().eq("referrer_id", userId);
    await supabase.from("referrals").delete().eq("referred_user_id", userId);

    // Delete the user from auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete user from auth" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in delete-account function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
