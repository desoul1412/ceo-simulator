/**
 * CEO Chat routes — streaming SSE endpoint for real-time CEO conversation.
 */

import { Router } from 'express';
import { supabase } from '../supabaseAdmin';

const router = Router();

/**
 * GET /company/:companyId/chat/messages — list chat messages.
 */
router.get('/company/:companyId/chat/messages', async (req, res) => {
  const { companyId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { data, error } = await supabase.from('ceo_chat_messages')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});

/**
 * POST /company/:companyId/chat — send a message and get SSE-streamed response.
 */
router.post('/company/:companyId/chat', async (req, res) => {
  const { companyId } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message required' });
    return;
  }

  // Store user message
  await supabase.from('ceo_chat_messages').insert({
    company_id: companyId,
    role: 'user',
    content: message,
  });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Fetch company context for the CEO
  const { data: company } = await supabase.from('companies')
    .select('name, ceo_goal, budget, budget_spent')
    .eq('id', companyId)
    .single();

  const { data: agents } = await supabase.from('agents')
    .select('name, role, status, assigned_task')
    .eq('company_id', companyId)
    .eq('terminated', false);

  const { data: recentTickets } = await supabase.from('tickets')
    .select('title, status, board_column')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Build context summary
  const context = [
    `Company: ${company?.name ?? 'Unknown'}`,
    `CEO Goal: ${company?.ceo_goal ?? 'None set'}`,
    `Budget: $${company?.budget ?? 0} (spent: $${company?.budget_spent ?? 0})`,
    `Team: ${(agents ?? []).map((a: any) => `${a.name} (${a.role}, ${a.status})`).join(', ') || 'None'}`,
    `Recent tickets: ${(recentTickets ?? []).map((t: any) => `${t.title} [${t.status}]`).join(', ') || 'None'}`,
  ].join('\n');

  // Generate a CEO-style response (non-streaming for now, can upgrade to Claude streaming later)
  const ceoResponse = generateCeoResponse(message, context);

  // Stream response chunks
  const chunks = splitIntoChunks(ceoResponse, 20);
  for (let i = 0; i < chunks.length; i++) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunks[i] })}\n\n`);
    // Small delay for streaming effect
    await new Promise(r => setTimeout(r, 30));
  }

  // Store assistant message
  await supabase.from('ceo_chat_messages').insert({
    company_id: companyId,
    role: 'assistant',
    content: ceoResponse,
  });

  res.write(`data: ${JSON.stringify({ type: 'done', content: ceoResponse })}\n\n`);
  res.end();
});

/**
 * DELETE /company/:companyId/chat — clear chat history.
 */
router.delete('/company/:companyId/chat', async (req, res) => {
  const { companyId } = req.params;
  await supabase.from('ceo_chat_messages').delete().eq('company_id', companyId);
  res.json({ ok: true });
});

export default router;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCeoResponse(userMessage: string, context: string): string {
  // Template-based CEO response (will be replaced with Claude streaming in integration)
  const msg = userMessage.toLowerCase();

  if (msg.includes('status') || msg.includes('how')) {
    return `Based on current operations:\n\n${context}\n\nAll systems are operational. The team is executing on the current sprint objectives.`;
  }

  if (msg.includes('budget') || msg.includes('cost') || msg.includes('money')) {
    return `Let me check the financials.\n\n${context.split('\n').filter(l => l.includes('Budget')).join('\n')}\n\nI recommend monitoring token costs closely and prioritizing high-SP tickets for maximum ROI.`;
  }

  if (msg.includes('team') || msg.includes('agent') || msg.includes('hire')) {
    return `Here's the current team status:\n\n${context.split('\n').filter(l => l.includes('Team')).join('\n')}\n\nI can recommend role adjustments based on the current workload if needed.`;
  }

  return `Acknowledged. I'm monitoring the situation.\n\nCurrent context:\n${context}\n\nWhat specific aspect would you like me to focus on?`;
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks.length > 0 ? chunks : [text];
}
