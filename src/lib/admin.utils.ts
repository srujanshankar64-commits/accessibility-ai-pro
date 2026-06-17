/**
 * Centralized admin utility functions
 * Ensures consistent admin checks across the application
 */

import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "srujanshankar64@gmail.com";

/**
 * Check if a user is an admin
 * @param email - User email to check
 * @returns true if the user is an admin
 */
export function isAdmin(email?: string | null): boolean {
  // Dev-tool override for testing
  if (email === ADMIN_EMAIL) return true;
  
  // In production, this would query a database table like 'admin_users'
  // For now, we only have the dev-tool override
  return false;
}

/**
 * Check if a user is an admin by querying the database
 * This is the production-ready version that should be used in server-side code
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @returns true if the user is an admin
 */
export async function isAdminByUserId(supabase: any, userId: string): Promise<boolean> {
  // Dev-tool override for testing
  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.email === ADMIN_EMAIL) return true;
  
  // In production, query an 'admin_users' table
  const { data } = await supabase
    .from("admin_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  
  return !!data;
}
