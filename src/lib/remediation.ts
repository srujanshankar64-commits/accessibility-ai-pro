import { supabase } from "@/integrations/supabase/client";

interface Violation {
  id: string;
  name: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcag_criterion: string;
  description: string;
  fix_instructions?: string;
  code_fix?: string;
}

interface RemediationStep {
  step: number;
  title: string;
  description: string;
  violations: string[];
  estimatedHours: number;
}

interface RemediationRoadmap {
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  estimatedTotalHours: number;
  steps: RemediationStep[];
}

/**
 * Calculates impact score for a violation based on severity and WCAG level
 */
function calculateImpactScore(violation: Violation): number {
  const severityScores = {
    critical: 100,
    serious: 75,
    moderate: 50,
    minor: 25,
  };
  
  const wcagLevelBonus = violation.wcag_criterion.includes('A') ? 0 : 
                         violation.wcag_criterion.includes('AA') ? 10 : 20;
  
  return severityScores[violation.severity] + wcagLevelBonus;
}

/**
 * Groups violations by category for remediation
 */
function groupViolationsByCategory(violations: Violation[]): Map<string, Violation[]> {
  const categories = new Map<string, Violation[]>();
  
  violations.forEach(v => {
    // Extract category from WCAG criterion (e.g., "1.1.1" -> "Perceivable")
    const category = getCategoryFromWCAG(v.wcag_criterion);
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(v);
  });
  
  return categories;
}

/**
 * Maps WCAG criterion to category
 */
function getCategoryFromWCAG(criterion: string): string {
  const num = criterion.match(/(\d+\.\d+)/)?.[0] || '';
  if (num.startsWith('1.')) return 'Perceivable';
  if (num.startsWith('2.')) return 'Operable';
  if (num.startsWith('3.')) return 'Understandable';
  if (num.startsWith('4.')) return 'Robust';
  return 'General';
}

/**
 * Estimates hours for a violation based on severity
 */
function estimateHours(violation: Violation): number {
  const hours = {
    critical: 4,
    serious: 2,
    moderate: 1,
    minor: 0.5,
  };
  return hours[violation.severity];
}

/**
 * Generates AI-powered remediation roadmap
 */
export async function generateRemediationRoadmap(violations: Violation[]): Promise<RemediationRoadmap> {
  // Sort violations by impact score
  const sortedViolations = [...violations].sort((a, b) => 
    calculateImpactScore(b) - calculateImpactScore(a)
  );
  
  // Group by category
  const grouped = groupViolationsByCategory(sortedViolations);
  
  // Calculate totals
  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const seriousCount = violations.filter(v => v.severity === 'serious').length;
  const estimatedTotalHours = violations.reduce((sum, v) => sum + estimateHours(v), 0);
  
  // Generate steps based on priority
  const steps: RemediationStep[] = [];
  let stepNumber = 1;
  
  // Step 1: Critical issues (highest priority)
  const criticalViolations = sortedViolations.filter(v => v.severity === 'critical');
  if (criticalViolations.length > 0) {
    steps.push({
      step: stepNumber++,
      title: 'Fix Critical Accessibility Barriers',
      description: 'Address critical violations that prevent users with disabilities from accessing core functionality. These issues must be resolved immediately to achieve basic compliance.',
      violations: criticalViolations.map(v => v.name),
      estimatedHours: criticalViolations.reduce((sum, v) => sum + estimateHours(v), 0),
    });
  }
  
  // Step 2: Serious issues
  const seriousViolations = sortedViolations.filter(v => v.severity === 'serious');
  if (seriousViolations.length > 0) {
    steps.push({
      step: stepNumber++,
      title: 'Resolve Serious Compliance Gaps',
      description: 'Fix serious violations that significantly impact user experience. These issues are commonly targeted in accessibility lawsuits and should be addressed promptly.',
      violations: seriousViolations.map(v => v.name),
      estimatedHours: seriousViolations.reduce((sum, v) => sum + estimateHours(v), 0),
    });
  }
  
  // Step 3: Perceivable issues (images, media)
  const perceivable = grouped.get('Perceivable') || [];
  if (perceivable.length > 0) {
    steps.push({
      step: stepNumber++,
      title: 'Enhance Perceivable Content',
      description: 'Ensure all content is perceivable by users with different sensory abilities. Focus on alt text, captions, and media alternatives.',
      violations: perceivable.map(v => v.name),
      estimatedHours: perceivable.reduce((sum, v) => sum + estimateHours(v), 0),
    });
  }
  
  // Step 4: Operable issues (navigation, keyboard)
  const operable = grouped.get('Operable') || [];
  if (operable.length > 0) {
    steps.push({
      step: stepNumber++,
      title: 'Improve Operable Interface',
      description: 'Make all functionality available via keyboard and ensure users can navigate and operate the interface effectively.',
      violations: operable.map(v => v.name),
      estimatedHours: operable.reduce((sum, v) => sum + estimateHours(v), 0),
    });
  }
  
  // Step 5: Understandable and Robust issues
  const remaining = [...(grouped.get('Understandable') || []), ...(grouped.get('Robust') || [])];
  if (remaining.length > 0) {
    steps.push({
      step: stepNumber++,
      title: 'Ensure Understandable and Robust Content',
      description: 'Make content understandable and robust enough to be interpreted reliably by assistive technologies.',
      violations: remaining.map(v => v.name),
      estimatedHours: remaining.reduce((sum, v) => sum + estimateHours(v), 0),
    });
  }
  
  return {
    totalViolations: violations.length,
    criticalCount,
    seriousCount,
    estimatedTotalHours,
    steps,
  };
}

/**
 * Saves remediation roadmap to database
 */
export async function saveRemediationRoadmap(auditId: string, roadmap: RemediationRoadmap): Promise<void> {
  try {
    const { error } = await supabase
      .from('audits')
      .update({ remediation_roadmap: roadmap } as any)
      .eq('id', auditId);
    
    if (error) throw error;
  } catch (err) {
    console.error("Failed to save remediation roadmap:", err);
    throw err;
  }
}
