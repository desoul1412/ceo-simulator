import { useState } from 'react';
import type { PlanningTab } from '../lib/planningApi';

interface PlanningTabContentProps {
  tab: PlanningTab;
  editedContent: string | undefined;
  onEdit: (content: string) => void;
  onReplan: () => void;
  isGenerating: boolean;
}

export function PlanningTabContent({
  tab, editedContent, onEdit, onReplan, isGenerating,
}: PlanningTabContentProps) {
  const [isEditing, setIsEditing] = useState(false);

  const displayContent = editedContent ?? tab.content;
  const hasEdits = editedContent !== undefined && editedContent !== tab.content;

  if (isGenerating) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: 40, gap: 16,
      }}>
        <div style={{
          fontSize: 'var(--font-md)', color: 'var(--neon-purple)',
          fontFamily: 'var(--font-hud)', letterSpacing: '0.1em',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          GENERATING {tab.title.toUpperCase()}...
        </div>
        <div style={{
          fontSize: 'var(--font-sm)', color: 'var(--hud-text-dim)',
          fontFamily: 'var(--font-pixel)',
        }}>
          CEO is analyzing the codebase and producing structured output
        </div>
        {/* Blinking cursor */}
        <div style={{
          width: 8, height: 16, background: 'var(--neon-cyan)',
          animation: 'pulse 0.8s step-end infinite',
        }} />
      </div>
    );
  }

  if (tab.status === 'skipped') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: 40,
        color: '#2a3a50', fontFamily: 'var(--font-hud)',
        fontSize: 'var(--font-sm)', textTransform: 'uppercase',
      }}>
        Skipped for {tab.tab_key === 'research' ? 'small/medium' : 'small'} projects
      </div>
    );
  }

  if (tab.status === 'pending' && !displayContent) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: 40,
        color: 'var(--hud-text-dim)', fontFamily: 'var(--font-hud)',
        fontSize: 'var(--font-sm)',
      }}>
        Waiting for earlier phases to complete...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', background: '#05080f',
        borderBottom: '1px solid #1b2030', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
            textTransform: 'uppercase',
          }}>
            {tab.title}
          </span>
          {hasEdits && (
            <span style={{
              fontSize: 'var(--font-xs)', color: 'var(--neon-orange)',
              padding: '0 4px', border: '1px solid var(--neon-orange)',
            }}>
              EDITED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasEdits && (
            <button
              onClick={onReplan}
              style={{
                padding: '2px 8px', fontSize: 'var(--font-xs)',
                background: '#1a1200', border: '1px solid var(--neon-orange)',
                color: 'var(--neon-orange)', cursor: 'pointer',
                fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
              }}
            >
              Re-plan from here
            </button>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '2px 8px', fontSize: 'var(--font-xs)',
              background: isEditing ? '#001a1a' : '#0d1117',
              border: `1px solid ${isEditing ? 'var(--neon-cyan)' : '#1b2030'}`,
              color: isEditing ? 'var(--neon-cyan)' : 'var(--hud-text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-hud)',
              textTransform: 'uppercase',
            }}
          >
            {isEditing ? 'View' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {isEditing ? (
          <textarea
            value={displayContent}
            onChange={e => onEdit(e.target.value)}
            style={{
              width: '100%', height: '100%', resize: 'none',
              padding: '16px',
              background: '#05080f', border: 'none', outline: 'none',
              color: '#e0eaf4', fontFamily: 'var(--font-hud)',
              fontSize: 'var(--font-lg)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          />
        ) : (
          <div style={{
            padding: '16px',
            color: '#a0b4c8', fontFamily: 'var(--font-hud)',
            fontSize: 'var(--font-lg)', lineHeight: 1.8,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {displayContent || (
              <span style={{ color: 'var(--hud-text-dim)', fontStyle: 'italic' }}>
                No content generated yet
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
