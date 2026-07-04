import { supabase } from "@/integrations/supabase/client";
import { runAudit } from "./ai.functions";

/**
 * Get audits that need to be re-audited based on their frequency
 */
export async function getAuditsForReaudit(): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('audits')
    .select('*')
    .eq('auto_reaudit_enabled', true)
    .lt('last_reaudited_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // 30 days ago
    .order('last_reaudited_at', { ascending: true })
    .limit(10);
  
  if (error) throw error;
  return data || [];
}

/**
 * Re-audit a single website
 */
export async function reauditWebsite(auditId: string): Promise<void> {
  const { data: audit, error: fetchError } = await supabase
    .from('audits')
    .select('url, user_id, overall_score')
    .eq('id', auditId)
    .single();
  
  if (fetchError || !audit) throw new Error('Audit not found');
  
  // Store previous score
  const previousScore = audit.overall_score ?? 0;
  
  // Run new audit
  const result = await runAudit({ data: { url: audit.url } });
  
  if (result.data) {
    const newScore = result.data.overall_score;
    const scoreDrop = previousScore - newScore;
    
    // Update audit with new data
    await supabase
      .from('audits')
      .update({
        overall_score: newScore,
        previous_score: previousScore,
        last_reaudited_at: new Date().toISOString(),
        violations: result.data.violations,
        category_scores: result.data.category_scores,
      } as any)
      .eq('id', auditId);
    
    // Check if score dropped significantly
    if (scoreDrop >= 10) {
      await sendScoreDropAlert(auditId, audit.url, previousScore, newScore, audit.user_id ?? '');
    }
  }
}

/**
 * Send email alert when score drops significantly
 */
async function sendScoreDropAlert(auditId: string, url: string, previousScore: number, newScore: number, userId: string): Promise<void> {
  const { data: userData } = await (supabase as any).from('settings').select('user_id').eq('user_id', userId).single();
  const email = userData?.user_id;
  
  if (!email) return;
  
  // In a real implementation, this would send an actual email
  // For now, we'll log it and could use Supabase's email service
  console.log(`SCORE DROP ALERT: ${url} dropped from ${previousScore} to ${newScore}. User ID: ${email}`);
  
  // TODO: Implement actual email sending using Supabase Auth or a service like Resend
  // await supabase.auth.admin.sendEmail({
  //   to: email,
  //   subject: 'Accessibility Score Drop Alert',
  //   html: `Your website ${url} accessibility score dropped from ${previousScore} to ${newScore}.`
  // });
}

/**
 * Enable auto re-audit for an audit
 */
export async function enableAutoReaudit(auditId: string, frequencyDays: number = 30): Promise<void> {
  const { error } = await supabase
    .from('audits')
    .update({
      auto_reaudit_enabled: true,
      reaudit_frequency_days: frequencyDays,
      last_reaudited_at: new Date().toISOString(),
    } as any)
    .eq('id', auditId);
  
  if (error) throw error;
}

/**
 * Disable auto re-audit for an audit
 */
export async function disableAutoReaudit(auditId: string): Promise<void> {
  const { error } = await supabase
    .from('audits')
    .update({
      auto_reaudit_enabled: false,
    } as any)
    .eq('id', auditId);
  
  if (error) throw error;
}
