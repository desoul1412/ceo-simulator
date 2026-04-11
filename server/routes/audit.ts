/**
 * Audit trail routes — query tool call logs, verify proof chain.
 */

import { Router } from 'express';
import { getAuditLog, getAuditSummary, verifyProofChain } from '../audit/toolAuditor';

const router = Router();

/**
 * GET /company/:companyId/audit — list audit entries.
 */
router.get('/company/:companyId/audit', async (req, res) => {
  const { companyId } = req.params;
  const { agentId, toolName, blocked, limit, offset } = req.query;

  const result = await getAuditLog(companyId, {
    agentId: agentId as string,
    toolName: toolName as string,
    blocked: blocked === 'true' ? true : blocked === 'false' ? false : undefined,
    limit: limit ? parseInt(limit as string) : 50,
    offset: offset ? parseInt(offset as string) : 0,
  });

  res.json(result);
});

/**
 * GET /company/:companyId/audit/summary — audit statistics.
 */
router.get('/company/:companyId/audit/summary', async (req, res) => {
  const summary = await getAuditSummary(req.params.companyId);
  res.json(summary);
});

/**
 * GET /company/:companyId/audit/verify — verify HMAC proof chain integrity.
 */
router.get('/company/:companyId/audit/verify', async (req, res) => {
  const result = await verifyProofChain(req.params.companyId);
  res.json(result);
});

export default router;
