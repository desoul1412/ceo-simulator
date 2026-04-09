import { useEffect, useState } from 'react';
import { fetchTickets, approveTicket, rejectTicket, approveAllTickets } from '../lib/orchestratorApi';
import { useDashboardStore } from '../store/dashboardStore';
import type { Company } from '../store/dashboardStore';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  agent_id: string;
  goal_ancestry: string[];
  created_at: string;
  ticket_comments?: { id: string; author_type: string; content: string; created_at: string }[];
}

interface ApprovalPanelProps {
  company: Company;
}

export function ApprovalPanel({ company }: ApprovalPanelProps) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  const pendingTickets = tickets.filter(t => t.status === 'awaiting_approval');
  const activeTickets = tickets.filter(t => t.status === 'in_progress' || t.status === 'approved');
  const completedTickets = tickets.filter(t => t.status === 'completed');

  const loadTickets = async () => {
    if (!orchestratorConnected) return;
    const data = await fetchTickets(company.id);
    setTickets(data);
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 10_000);
    return () => clearInterval(interval);
  }, [company.id, orchestratorConnected]);

  const handleApprove = async (ticketId: string) => {
    setLoading(true);
    await approveTicket(ticketId);
    await loadTickets();
    setLoading(false);
  };

  const handleReject = async (ticketId: string) => {
    setLoading(true);
    await rejectTicket(ticketId, 'Rejected by CEO');
    await loadTickets();
    setLoading(false);
  };

  const handleApproveAll = async () => {
    setLoading(true);
    await approveAllTickets(company.id);
    await loadTickets();
    setLoading(false);
  };

  if (!orchestratorConnected) return null;
  if (tickets.length === 0) return null;

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid var(--hud-border)',
      fontFamily: 'var(--font-hud)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid var(--hud-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Tickets {pendingTickets.length > 0 && (
            <span style={{ color: '#ff8800' }}>({pendingTickets.length} pending)</span>
          )}
        </span>
        {pendingTickets.length > 1 && (
          <button
            onClick={handleApproveAll}
            disabled={loading}
            style={{
              padding: '2px 8px', fontSize: 'var(--font-xs)',
              background: '#00ff8818', border: '1px solid #00ff8840',
              color: '#00ff88', cursor: 'pointer', fontFamily: 'var(--font-hud)',
              textTransform: 'uppercase',
            }}
          >
            Approve All
          </button>
        )}
      </div>

      <div style={{ maxHeight: 200, overflow: 'auto', padding: '4px 8px' }}>
        {/* Pending approvals */}
        {pendingTickets.map(ticket => {
          const agent = company.employees.find(e => e.id === ticket.agent_id);
          return (
            <div key={ticket.id} style={{
              padding: '6px 0', borderBottom: '1px solid #0a0e14',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{
                  width: 5, height: 5,
                  background: '#ff8800', boxShadow: '0 0 4px #ff8800',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 'var(--font-xs)', color: '#ff8800', textTransform: 'uppercase' }}>
                  {agent?.role ?? '?'}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginLeft: 'auto' }}>
                  AWAITING APPROVAL
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: '#8090a8', marginBottom: 4, lineHeight: 1.3 }}>
                {ticket.title}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => handleApprove(ticket.id)}
                  disabled={loading}
                  style={{
                    padding: '2px 10px', fontSize: 'var(--font-xs)',
                    background: '#00ff8818', border: '1px solid #00ff8840',
                    color: '#00ff88', cursor: 'pointer', fontFamily: 'var(--font-hud)',
                  }}
                >
                  ✓ APPROVE
                </button>
                <button
                  onClick={() => handleReject(ticket.id)}
                  disabled={loading}
                  style={{
                    padding: '2px 10px', fontSize: 'var(--font-xs)',
                    background: '#ff224418', border: '1px solid #ff224440',
                    color: '#ff2244', cursor: 'pointer', fontFamily: 'var(--font-hud)',
                  }}
                >
                  × REJECT
                </button>
              </div>
            </div>
          );
        })}

        {/* Active tickets */}
        {activeTickets.map(ticket => {
          const agent = company.employees.find(e => e.id === ticket.agent_id);
          return (
            <div key={ticket.id} style={{
              padding: '4px 0', borderBottom: '1px solid #0a0e14',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 5, height: 5,
                background: ticket.status === 'in_progress' ? '#00ff88' : '#c084fc',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 'var(--font-xs)', color: agent?.color ?? '#4a5568' }}>{agent?.role}</span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ticket.title}
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', textTransform: 'uppercase' }}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
          );
        })}

        {/* Completed (last 3) */}
        {completedTickets.slice(0, 3).map(ticket => (
          <div key={ticket.id} style={{
            padding: '3px 0', borderBottom: '1px solid #0a0e14',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: 0.5,
          }}>
            <span style={{ width: 5, height: 5, background: '#4a5568', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
              {ticket.title}
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50' }}>done</span>
          </div>
        ))}
      </div>
    </div>
  );
}
