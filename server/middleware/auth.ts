/**
 * JWT Authentication Middleware.
 *
 * Extracts and verifies Supabase JWT from Authorization header.
 * Attaches user info to req for downstream route handlers.
 * Opt-in: routes that need auth use requireAuth(). Public routes stay open.
 */

import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export interface AuthUser {
  id: string;
  email: string;
  companyIds: string[];
  role: 'owner' | 'admin' | 'viewer';
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Optional auth — attaches user if valid JWT present, continues regardless.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const user = await verifyToken(token);
    if (user) req.user = user;
  } catch {
    // Invalid token — continue unauthenticated
  }
  next();
}

/**
 * Required auth — rejects request if no valid JWT.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Company access guard — ensures user has access to the requested company.
 * Must be used after requireAuth.
 */
export function requireCompanyAccess(paramName = 'companyId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const companyId = req.params[paramName];
    if (!companyId) return next();

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.user.companyIds.includes(companyId)) {
      res.status(403).json({ error: 'Access denied to this company' });
      return;
    }

    next();
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  // Create a client scoped to this user's JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  // Fetch user's company memberships
  const { data: memberships } = await userClient
    .from('user_companies')
    .select('company_id, role')
    .eq('user_id', user.id);

  const companyIds = (memberships ?? []).map((m: any) => m.company_id);
  const role = (memberships?.[0] as any)?.role ?? 'viewer';

  return {
    id: user.id,
    email: user.email ?? '',
    companyIds,
    role,
  };
}
