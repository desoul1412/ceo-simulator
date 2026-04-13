/**
 * Budget configuration — Team Premium Claude subscription estimates.
 *
 * Team Premium = ~6.25x Pro
 * Weekly token budget ≈ 9.24M tokens/week (rolling 5-hour windows)
 * 1% weekly ≈ 92,400 tokens
 *
 * Cost per 1% weekly usage (70% input / 30% output):
 *   Haiku:  ~$0.14
 *   Sonnet: ~$0.41
 *   Opus:   ~$0.69
 *
 * Estimated weekly caps (100%):
 *   Haiku:  ~$14/week  (~$2.00/day)
 *   Sonnet: ~$41/week  (~$5.86/day)
 *   Opus:   ~$69/week  (~$9.86/day)
 *
 * Using Sonnet as default reference (most used model).
 * Override via VITE_DAILY_BUDGET_CAP / VITE_WEEKLY_BUDGET_CAP env vars.
 */

// Team Premium Sonnet estimates
const DEFAULT_WEEKLY_CAP = 41;  // $41/week for Sonnet-heavy usage
const DEFAULT_DAILY_CAP = 5.86; // $41/7 ≈ $5.86/day

export const WEEKLY_BUDGET_CAP = Number(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WEEKLY_BUDGET_CAP : undefined
) || DEFAULT_WEEKLY_CAP;

export const DAILY_BUDGET_CAP = Number(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DAILY_BUDGET_CAP : undefined
) || DEFAULT_DAILY_CAP;

// Per-model cost estimates (per 1% weekly = ~92,400 tokens)
export const MODEL_COST_PER_PCT: Record<string, number> = {
  haiku: 0.14,
  sonnet: 0.41,
  opus: 0.69,
};

// Weekly token estimates
export const WEEKLY_TOKEN_BUDGET = 9_240_000; // ~9.24M tokens
export const TOKENS_PER_PCT = 92_400;

/**
 * Calculate budget bar color based on usage percentage.
 */
export function budgetColor(pct: number): string {
  if (pct < 50) return '#00ff88';  // green
  if (pct < 80) return '#ff8800';  // orange
  return '#ff2244';                 // red
}

/**
 * Calculate daily + weekly usage percentages from USD spent.
 */
export function calcUsage(spentUsd: number): {
  dailyPct: number;
  weeklyPct: number;
  dailyCap: number;
  weeklyCap: number;
  barColor: string;
} {
  const dailyPct = Math.min(100, Math.round((spentUsd / DAILY_BUDGET_CAP) * 100));
  const weeklyPct = Math.min(100, Math.round((spentUsd / WEEKLY_BUDGET_CAP) * 100));
  return {
    dailyPct,
    weeklyPct,
    dailyCap: DAILY_BUDGET_CAP,
    weeklyCap: WEEKLY_BUDGET_CAP,
    barColor: budgetColor(Math.max(dailyPct, weeklyPct)),
  };
}
