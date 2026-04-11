import { getClient } from './db';
import type { Ticket } from './types';

const db = () => getClient();

export async function getTicket(id: string) {
  const { data, error } = await db().from('tickets').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Ticket;
}

export async function getTicketsByCompany(companyId: string) {
  const { data, error } = await db().from('tickets')
    .select('*, ticket_comments(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTicketsBySprint(sprintId: string) {
  const { data, error } = await db().from('tickets')
    .select('*, ticket_comments(*)')
    .eq('sprint_id', sprintId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function claimNextTicket(companyId: string) {
  const { data, error } = await db().rpc('claim_next_ticket_v2', { p_company_id: companyId });
  if (error) throw error;
  return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>) {
  const { error } = await db().from('tickets').update(updates).eq('id', id);
  if (error) throw error;
}

export async function createTicket(ticket: Partial<Ticket>) {
  const { data, error } = await db().from('tickets').insert(ticket).select().single();
  if (error) throw error;
  return data as Ticket;
}

export async function createTickets(tickets: Partial<Ticket>[]) {
  const { data, error } = await db().from('tickets').insert(tickets).select();
  if (error) throw error;
  return data ?? [];
}

export async function approveTicket(id: string) {
  const { data, error } = await db().from('tickets')
    .update({ status: 'approved', board_column: 'todo' })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as Ticket;
}

export async function rejectTicket(id: string) {
  const { data, error } = await db().from('tickets')
    .update({ status: 'cancelled', board_column: 'done' })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as Ticket;
}

export async function bulkApprove(companyId: string) {
  const { data, error } = await db().from('tickets')
    .update({ status: 'approved', board_column: 'todo' })
    .eq('company_id', companyId)
    .eq('status', 'awaiting_approval')
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function getCompanyTicketStatus(companyId: string) {
  const { data, error, count } = await db().from('tickets')
    .select('status', { count: 'exact' })
    .eq('company_id', companyId);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getPendingTickets(companyId: string) {
  const { data } = await db().from('tickets')
    .select('id')
    .eq('company_id', companyId)
    .in('status', ['open', 'approved', 'in_progress']);
  return data ?? [];
}

export async function getReadyTickets(companyId: string) {
  const { data } = await db().from('tickets')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'approved');
  return data ?? [];
}

export async function updateBoardColumn(id: string, column: string) {
  const statusMap: Record<string, string> = {
    backlog: 'open',
    todo: 'approved',
    in_progress: 'in_progress',
    review: 'in_progress',
    done: 'completed',
  };
  const { data, error } = await db().from('tickets').update({
    board_column: column,
    status: statusMap[column] ?? 'open',
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function addComment(ticketId: string, author: string, authorType: string, content: string) {
  const { data, error } = await db().from('ticket_comments').insert({
    ticket_id: ticketId,
    author,
    author_type: authorType,
    content,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function checkAgentBusy(agentId: string, excludeTicketId: string) {
  const { data } = await db().from('tickets')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'in_progress')
    .neq('id', excludeTicketId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function getCompletedByCompany(companyId: string) {
  const { data } = await db().from('tickets')
    .select('id, status')
    .eq('company_id', companyId);
  return data ?? [];
}
