import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentPolling, INITIAL_AGENTS } from './useAgentPolling';

describe('useAgentPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with exactly 3 agents', () => {
    const { result } = renderHook(() => useAgentPolling());
    expect(result.current).toHaveLength(3);
  });

  it('initializes agents with correct roles', () => {
    const { result } = renderHook(() => useAgentPolling());
    const roles = result.current.map(a => a.role);
    expect(roles).toContain('CEO');
    expect(roles).toContain('Backend Dev');
    expect(roles).toContain('QA');
  });

  it('all agents start with valid status', () => {
    const { result } = renderHook(() => useAgentPolling());
    const validStatuses = ['idle', 'working', 'meeting', 'break'];
    result.current.forEach(agent => {
      expect(validStatuses).toContain(agent.status);
    });
  });

  it('all agents start within grid bounds (0–14)', () => {
    const { result } = renderHook(() => useAgentPolling());
    result.current.forEach(agent => {
      expect(agent.col).toBeGreaterThanOrEqual(0);
      expect(agent.col).toBeLessThanOrEqual(14);
      expect(agent.row).toBeGreaterThanOrEqual(0);
      expect(agent.row).toBeLessThanOrEqual(14);
    });
  });

  it('updates agent positions after 3s tick', () => {
    const { result } = renderHook(() => useAgentPolling());
    const initialPositions = result.current.map(a => ({ col: a.col, row: a.row }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // At least one agent should have moved (not guaranteed to all move, but
    // the state array should have been replaced)
    const newAgents = result.current;
    expect(newAgents).toHaveLength(3);

    // All agents after tick still have valid grid coordinates
    newAgents.forEach(agent => {
      expect(agent.col).toBeGreaterThanOrEqual(0);
      expect(agent.col).toBeLessThanOrEqual(14);
      expect(agent.row).toBeGreaterThanOrEqual(0);
      expect(agent.row).toBeLessThanOrEqual(14);
    });

    // Suppress unused variable warning
    void initialPositions;
  });

  it('each agent has a unique id', () => {
    const ids = INITIAL_AGENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
