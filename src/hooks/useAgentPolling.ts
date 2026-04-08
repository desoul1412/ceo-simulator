import { useState, useEffect, useCallback } from 'react';

export type AgentStatus = 'idle' | 'working' | 'meeting' | 'break';
export type AgentRole = 'CEO' | 'Backend Dev' | 'QA';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  col: number;
  row: number;
  status: AgentStatus;
  color: string;
}

// ── Position pools per activity zone ──────────────────────────────────────────

const DESK_POSITIONS: [number, number][] = [
  [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2],
  [2, 5], [4, 5], [6, 5], [8, 5], [10, 5], [12, 5],
  [2, 8], [4, 8], [6, 8], [8, 8], [10, 8], [12, 8],
];

const MEETING_POSITIONS: [number, number][] = [
  [1, 11], [2, 11], [3, 11], [4, 11],
  [1, 12], [2, 12], [3, 12], [4, 12],
  [1, 13], [2, 13], [3, 13], [4, 13],
];

const KITCHEN_POSITIONS: [number, number][] = [
  [10, 11], [11, 11], [12, 11], [13, 11],
  [10, 12], [11, 12], [12, 12], [13, 12],
  [10, 13], [11, 13], [12, 13], [13, 13],
];

const FLOOR_POSITIONS: [number, number][] = [
  [1, 1], [3, 1], [5, 1], [7, 1], [9, 1], [11, 1], [13, 1],
  [1, 3], [3, 3], [5, 3], [7, 3], [9, 3], [11, 3], [13, 3],
  [1, 4], [3, 4], [5, 4], [7, 4], [9, 4], [11, 4], [13, 4],
  [1, 6], [3, 6], [5, 6], [7, 6], [9, 6], [11, 6], [13, 6],
  [1, 7], [3, 7], [5, 7], [7, 7], [9, 7], [11, 7], [13, 7],
  [1, 9], [3, 9], [5, 9], [7, 9], [9, 9], [11, 9], [13, 9],
  [1, 10], [3, 10], [5, 10], [7, 10], [9, 10], [11, 10], [13, 10],
  [5, 11], [6, 11], [7, 11], [8, 11], [9, 11],
  [5, 12], [6, 12], [7, 12], [8, 12], [9, 12],
  [5, 13], [6, 13], [7, 13], [8, 13], [9, 13],
];

const ALL_STATUSES: AgentStatus[] = ['idle', 'working', 'meeting', 'break'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function positionsForStatus(status: AgentStatus): [number, number][] {
  switch (status) {
    case 'working':  return DESK_POSITIONS;
    case 'meeting':  return MEETING_POSITIONS;
    case 'break':    return KITCHEN_POSITIONS;
    default:         return FLOOR_POSITIONS;
  }
}

// ── Initial state ─────────────────────────────────────────────────────────────

export const INITIAL_AGENTS: Agent[] = [
  { id: 'ceo',  name: 'Ada Chen',  role: 'CEO',         col: 2,  row: 2, status: 'working', color: '#00ffff' },
  { id: 'dev',  name: 'Max Ryker', role: 'Backend Dev', col: 6,  row: 5, status: 'working', color: '#00ff88' },
  { id: 'qa',   name: 'Zoe Pulse', role: 'QA',          col: 10, row: 8, status: 'working', color: '#ff8800' },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentPolling(): Agent[] {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);

  const tick = useCallback(() => {
    setAgents(prev =>
      prev.map(agent => {
        const newStatus = pickRandom(ALL_STATUSES);
        const [newCol, newRow] = pickRandom(positionsForStatus(newStatus));
        return { ...agent, status: newStatus, col: newCol, row: newRow };
      })
    );
  }, []);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = 3000 + Math.random() * 2000; // 3–5 s
      timerId = setTimeout(() => {
        tick();
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timerId);
  }, [tick]);

  return agents;
}
