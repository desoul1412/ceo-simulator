/**
 * Shared server utilities — single source of truth.
 */

import path from 'path';
import type { LLMModel } from './llm/types';

/** Slugify text: lowercase, replace non-alphanumeric with hyphens, trim edges */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Root path for the brain directory */
export const BRAIN_ROOT = path.join(process.cwd(), 'brain');

/** Calculate LLM cost from token counts and model pricing */
export function calculateLLMCost(model: LLMModel, inputTokens: number, outputTokens: number): number {
  const costIn = inputTokens * (model.cost_per_1k_input ?? 0.003) / 1000;
  const costOut = outputTokens * (model.cost_per_1k_output ?? 0.015) / 1000;
  return costIn + costOut;
}

/** Escape LIKE/ILIKE special characters to prevent injection */
export function escapeLike(query: string): string {
  return query.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Format an API error message, truncated */
export function formatApiError(label: string, status: number, body: string): string {
  return `${label} ${status}: ${body.slice(0, 200)}`;
}
