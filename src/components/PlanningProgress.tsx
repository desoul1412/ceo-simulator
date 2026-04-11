interface PlanningProgressProps {
  currentPhase: number;
  totalPhases: number;
  status: string;
}

const PHASE_NAMES = [
  'Intake',
  'Discovery',
  'Research',
  'Tech Eval',
  'Architecture',
  'Hiring',
  'Implementation',
];

export function PlanningProgress({ currentPhase, totalPhases, status }: PlanningProgressProps) {
  const isGenerating = status === 'generating';
  const isDone = status === 'review' || status === 'approved';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Phase diamonds */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {Array.from({ length: totalPhases }).map((_, i) => {
          const isComplete = i < currentPhase;
          const isCurrent = i === currentPhase && isGenerating;

          return (
            <div
              key={i}
              style={{
                width: 8, height: 8,
                transform: 'rotate(45deg)',
                background: isComplete ? 'var(--neon-cyan)'
                  : isCurrent ? 'var(--neon-purple)'
                  : '#1b2030',
                boxShadow: isCurrent ? '0 0 6px var(--neon-purple)' : 'none',
                animation: isCurrent ? 'pulse 1.5s ease-in-out infinite' : 'none',
                transition: 'background 0.3s',
              }}
            />
          );
        })}
      </div>

      {/* Phase label */}
      <span style={{
        fontFamily: 'var(--font-hud)',
        fontSize: 'var(--font-xs)',
        color: isGenerating ? 'var(--neon-purple)' : isDone ? 'var(--neon-green)' : 'var(--hud-text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {isDone
          ? `${totalPhases}/${totalPhases} Complete`
          : isGenerating
            ? `${currentPhase + 1}/${totalPhases}: ${PHASE_NAMES[currentPhase] ?? 'Processing'}`
            : 'Ready'
        }
      </span>
    </div>
  );
}
