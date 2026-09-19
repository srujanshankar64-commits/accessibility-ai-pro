import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a referral code from user email
 */
export function generateReferralCode(email: string): string {
  let hash = 5381;
  for (const char of email.trim().toLowerCase()) {
    hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  }

  return Math.abs(hash).toString(36).slice(0, 8).toUpperCase().padEnd(8, "0");
}

/**
 * Get or create referral record for a user
 */
export async function getOrCreateReferral(userId: string, email: string): Promise<any> {
  const referralCode = generateReferralCode(email);
  
  // Try to get existing referral
  const { data: existingReferral } = await (supabase as any)
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .single();
  
  if (existingReferral) {
    return existingReferral;
  }
  
  // Create new referral record
  const { data: newReferral, error } = await (supabase as any)
    .from('referrals')
    .insert({
      referrer_id: userId,
      referral_code: referralCode,
      total_clicks: 0,
      total_signups: 0,
      total_earned_months: 0,
    })
    .select()
    .single();
  
  if (error) throw error;
  return newReferral;
}

/**
 * Track a referral click
 */
export async function trackReferralClick(referralCode: string, ipAddress?: string, userAgent?: string): Promise<void> {
  // Get referral by code
  const { data: referral } = await (supabase as any)
    .from('referrals')
    .select('*')
    .eq('referral_code', referralCode)
    .single();
  
  if (!referral) return;
  
  // Record the click
  await (supabase as any)
    .from('referral_clicks')
    .insert({
      referral_id: referral.id,
      clicked_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  
  // Update total clicks
  await (supabase as any)
    .from('referrals')
    .update({
      total_clicks: referral.total_clicks + 1,
    })
    .eq('id', referral.id);
}

/**
 * Track a referral signup
 */
export async function trackReferralSignup(referralCode: string, referredUserId: string): Promise<void> {
  // Get referral by code
  const { data: referral } = await (supabase as any)
    .from('referrals')
    .select('*')
    .eq('referral_code', referralCode)
    .single();
  
  if (!referral) return;
  
  // Record the signup
  await (supabase as any)
    .from('referral_signups')
    .insert({
      referral_id: referral.id,
      referred_user_id: referredUserId,
      created_at: new Date().toISOString(),
    });
  
  // Update total signups
  await (supabase as any)
    .from('referrals')
    .update({
      total_signups: referral.total_signups + 1,
    })
    .eq('id', referral.id);
}

/**
 * Track when a referred user upgrades to a paid plan
 */
export async function trackReferralUpgrade(referredUserId: string): Promise<void> {
  // Get the referral signup record
  const { data: referralSignup } = await (supabase as any)
    .from('referral_signups')
    .select('*, referrals(*)')
    .eq('referred_user_id', referredUserId)
    .is('upgraded_at', null)
    .single();
  
  if (!referralSignup) return;
  
  // Mark as upgraded
  await (supabase as any)
    .from('referral_signups')
    .update({
      upgraded_at: new Date().toISOString(),
    })
    .eq('id', referralSignup.id);
  
  // Update referral stats
  const referral = referralSignup.referrals;
  if (referral) {
    await (supabase as any)
      .from('referrals')
      .update({
        total_earned_months: referral.total_earned_months + 1,
      })
      .eq('id', referral.id);
    
    // Grant the referrer a free month (extend their subscription)
    await grantReferrerFreeMonth(referral.referrer_id);
  }
}

/**
 * Grant a free month to a referrer
 */
async function grantReferrerFreeMonth(referrerId: string): Promise<void> {
  // Get the referrer's subscription
  const { data: subscription } = await (supabase as any)
    .from('subscriptions')
    .select('*')
    .eq('user_id', referrerId)
    .eq('status', 'active')
    .single();
  
  if (subscription) {
    // Extend the subscription by 30 days
    const newEndDate = new Date(subscription.current_period_end);
    newEndDate.setDate(newEndDate.getDate() + 30);
    
    await (supabase as any)
      .from('subscriptions')
      .update({
        current_period_end: newEndDate.toISOString(),
      })
      .eq('id', subscription.id);
  }
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(userId: string): Promise<{ clicks: number; signups: number; earned: number }> {
  const { data: referral, error } = await (supabase as any)
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .maybeSingle();
  
  if (error || !referral) {
    return { clicks: 0, signups: 0, earned: 0 };
  }
  
  return {
    clicks: referral.total_clicks || 0,
    signups: referral.total_signups || 0,
    earned: referral.total_earned_months || 0,
  };
}
