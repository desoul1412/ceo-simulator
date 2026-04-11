// ── Data Access Layer — barrel export ─────────────────────────────────────────

export { getClient, supabase } from './db';
export type { AuthContext } from './db';

export * from './types';

export * as companyRepo from './companyRepo';
export * as agentRepo from './agentRepo';
export * as ticketRepo from './ticketRepo';
export * as sprintRepo from './sprintRepo';
export * as planRepo from './planRepo';
export * as mergeRequestRepo from './mergeRequestRepo';
export * as notificationRepo from './notificationRepo';
export * as configRepo from './configRepo';
export * as auditRepo from './auditRepo';
