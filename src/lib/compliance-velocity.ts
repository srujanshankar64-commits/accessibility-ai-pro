import { supabase } from "@/integrations/supabase/client";

interface ScoreHistoryPoint {
  date: string;
  score: number;
  violations: number;
}

/**
 * Gets score history for a URL
 */
export async function getScoreHistory(url: string, limit: number = 5): Promise<ScoreHistoryPoint[]> {
  const { data, error } = await supabase
    .from('audits')
    .select('created_at, overall_score, violations')
    .eq('url', url)
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (error) throw error;
  
  return (data || []).map((audit: any) => ({
    date: new Date(audit.created_at).toLocaleDateString(),
    score: audit.overall_score,
    violations: Array.isArray(audit.violations) ? audit.violations.length : 0,
  }));
}

/**
 * Calculates compliance velocity (score improvement rate)
 */
export function calculateVelocity(history: ScoreHistoryPoint[]): number {
  if (history.length < 2) return 0;
  
  const first = history[0];
  const last = history[history.length - 1];
  
  const scoreChange = last.score - first.score;
  const daysDiff = Math.max(1, Math.ceil(
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  return Math.round((scoreChange / daysDiff) * 10) / 10;
}

/**
 * Predicts future score based on velocity
 */
export function predictScore(history: ScoreHistoryPoint[], daysAhead: number = 30): number {
  if (history.length < 2) return history[history.length - 1]?.score || 0;
  
  const velocity = calculateVelocity(history);
  const currentScore = history[history.length - 1].score;
  
  const predictedScore = currentScore + (velocity * daysAhead);
  
  return Math.min(100, Math.max(0, Math.round(predictedScore)));
}
