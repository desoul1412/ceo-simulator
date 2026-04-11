/**
 * server/supabaseAdmin.ts
 * Server-side Supabase client (service-role key — bypasses RLS).
 * All env vars sourced from the validated config object.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './config/env.js';

// Server-side client with service role key — bypasses RLS
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
