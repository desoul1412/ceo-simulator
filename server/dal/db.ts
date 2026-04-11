/**
 * Database client wrapper.
 * - Default: returns service-role client (admin, bypasses RLS).
 * - With AuthContext + JWT: returns user-scoped client (respects RLS).
 * - Phase 5: will support raw pg pool via DATABASE_MODE env var.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseAdmin';

export interface AuthContext {
  userId?: string;
  companyIds?: string[];
  role?: 'owner' | 'admin' | 'viewer';
  jwt?: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Get the database client.
 * If context has a JWT, returns a user-scoped client that respects RLS.
 * Otherwise returns the service-role client.
 */
export function getClient(context?: AuthContext): SupabaseClient {
  if (context?.jwt && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${context.jwt}` } },
    });
  }
  return supabase;
}

/** Re-export for convenience */
export { supabase };
