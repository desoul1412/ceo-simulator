/**
 * Supabase client for the separate "brain" project.
 * Returns null if brain project is not configured (graceful degradation).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const brainUrl = process.env.BRAIN_SUPABASE_URL;
const brainKey = process.env.BRAIN_SUPABASE_KEY;

let brainClient: SupabaseClient | null = null;

if (brainUrl && brainKey) {
  brainClient = createClient(brainUrl, brainKey);
  console.log('[brain-supabase] Connected to brain project');
} else {
  console.log('[brain-supabase] Brain project not configured (BRAIN_SUPABASE_URL/KEY missing). Brain sync disabled.');
}

export const brainSupabase = brainClient;
export function isBrainConfigured(): boolean { return brainClient !== null; }
