import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfficeFloorPlan } from './OfficeFloorPlan';
import { INITIAL_AGENTS } from '../hooks/useAgentPolling';

describe('OfficeFloorPlan', () => {
  it('renders the office grid container', () => {
    render(<OfficeFloorPlan agents={[]} />);
    expect(screen.getByTestId('office-grid')).toBeInTheDocument();
  });

  it('renders exactly 225 cells (15×15)', () => {
    const { container } = render(<OfficeFloorPlan agents={[]} />);
    const cells = container.querySelectorAll('[data-cell-type]');
    expect(cells).toHaveLength(225);
  });

  it('renders wall cells on the border', () => {
    const { container } = render(<OfficeFloorPlan agents={[]} />);
    const walls = container.querySelectorAll('[data-cell-type="wall"]');
    // 4 sides: top row (15) + bottom row (15) + left col sans corners (13) + right col sans corners (13) = 56
    expect(walls.length).toBe(56);
  });

  it('renders desk cells at correct positions', () => {
    const { container } = render(<OfficeFloorPlan agents={[]} />);
    const desks = container.querySelectorAll('[data-cell-type="desk"]');
    // 6 desks per desk row × 3 rows = 18
    expect(desks).toHaveLength(18);
  });

  it('renders meeting room cells', () => {
    const { container } = render(<OfficeFloorPlan agents={[]} />);
    const meeting = container.querySelectorAll('[data-cell-type="meeting"]');
    // 4 cols × 3 rows = 12
    expect(meeting).toHaveLength(12);
  });

  it('renders kitchen cells', () => {
    const { container } = render(<OfficeFloorPlan agents={[]} />);
    const kitchen = container.querySelectorAll('[data-cell-type="kitchen"]');
    // 4 cols × 3 rows = 12
    expect(kitchen).toHaveLength(12);
  });

  it('renders one sprite per agent', () => {
    const { container } = render(<OfficeFloorPlan agents={INITIAL_AGENTS} />);
    const sprites = container.querySelectorAll('[data-agent-id]');
    expect(sprites).toHaveLength(INITIAL_AGENTS.length);
  });

  it('renders agent sprite with correct data-agent-id', () => {
    const { container } = render(<OfficeFloorPlan agents={INITIAL_AGENTS} />);
    expect(container.querySelector('[data-agent-id="ceo"]')).toBeInTheDocument();
    expect(container.querySelector('[data-agent-id="dev"]')).toBeInTheDocument();
    expect(container.querySelector('[data-agent-id="qa"]')).toBeInTheDocument();
  });

  it('renders agents with initial status attribute', () => {
    const { container } = render(<OfficeFloorPlan agents={INITIAL_AGENTS} />);
    const ceo = container.querySelector('[data-agent-id="ceo"]');
    expect(ceo).toHaveAttribute('data-agent-status', 'working');
  });
});
