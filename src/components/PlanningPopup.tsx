import { useState } from 'react';
import { usePlanningStore } from '../store/planningStore';
import { PlanningTabContent } from './PlanningTabContent';
import { PlanningProgress } from './PlanningProgress';

const TAB_STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '○', color: 'var(--hud-text-dim)' },
  generating: { icon: '◆', color: 'var(--neon-purple)' },
  draft: { icon: '◇', color: 'var(--neon-cyan)' },
  edited: { icon: '◈', color: 'var(--neon-orange)' },
  approved: { icon: '✓', color: 'var(--neon-green)' },
  skipped: { icon: '—', color: '#2a3a50' },
};

export function PlanningPopup() {
  const {
    isOpen, status, tabs, activeTabKey, currentPhase, totalPhases,
    costUsd, directive, projectSize, editedTabs, error, approvalResult,
    setActiveTab, editTab, replanTab, approveAndExecute, close,
  } = usePlanningStore();

  const [approving, setApproving] = useState(false);

  if (!isOpen) return null;

  const activeTab = tabs.find(t => t.tab_key === activeTabKey);
  const editedContent = editedTabs[activeTabKey];
  const isEdited = editedContent !== undefined;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approveAndExecute();
    } catch (err) {
      console.warn('[PlanningPopup] Approve failed:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleReplan = async (tabKey?: string) => {
    try {
      await replanTab(tabKey);
    } catch (err) {
      console.warn('[PlanningPopup] Replan failed:', err);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.02) 2px, rgba(0,255,255,0.02) 4px)',
      }} aria-hidden="true" />

      {/* Modal */}
      <div role="dialog" aria-label="Planning session" className="modal-content" style={{
        width: '95vw', maxWidth: 1000, maxHeight: '85vh', height: '85vh',
        background: '#0d1117', border: '1px solid #1b2030',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 0 40px rgba(0,255,255,0.08)',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: '#090d14',
          borderBottom: '1px solid #1b2030', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)',
              color: 'var(--neon-cyan)', letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              CEO Planning Terminal
            </span>
            <span style={{
              fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
              padding: '1px 6px', border: '1px solid #1b2030', background: '#05080f',
              textTransform: 'uppercase',
            }}>
              {projectSize}
            </span>
            {status === 'generating' && (
              <span style={{
                fontSize: 'var(--font-xs)', color: 'var(--neon-purple)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                GENERATING...
              </span>
            )}
            {status === 'approved' && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-green)' }}>
                APPROVED
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)' }}>
              ${costUsd.toFixed(4)}
            </span>
            <button
              onClick={close}
              aria-label="Close planning popup"
              style={{
                background: 'none', border: '1px solid #1b2030',
                color: 'var(--hud-text-muted)', cursor: 'pointer',
                padding: '2px 8px', fontFamily: 'var(--font-hud)',
                fontSize: 'var(--font-sm)',
              }}
            >
              X
            </button>
          </div>
        </div>

        {/* ── Directive preview ── */}
        <div style={{
          padding: '6px 16px', background: '#05080f',
          borderBottom: '1px solid #1b2030', flexShrink: 0,
          fontSize: 'var(--font-xs)', color: 'var(--hud-text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--neon-orange)', marginRight: 8 }}>DIRECTIVE</span>
          {directive}
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          display: 'flex', gap: 0, background: '#090d14',
          borderBottom: '1px solid #1b2030', flexShrink: 0,
          overflowX: 'auto',
        }}>
          {tabs.map(tab => {
            const isActive = tab.tab_key === activeTabKey;
            const isSkipped = tab.status === 'skipped';
            const statusInfo = TAB_STATUS_ICONS[
              editedTabs[tab.tab_key] !== undefined ? 'edited' : tab.status
            ] ?? TAB_STATUS_ICONS.pending;

            return (
              <button
                key={tab.tab_key}
                onClick={() => !isSkipped && setActiveTab(tab.tab_key)}
                disabled={isSkipped}
                style={{
                  padding: '8px 14px',
                  background: isActive ? '#0d1117' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                  color: isSkipped ? '#2a3a50' : isActive ? '#e0eaf4' : 'var(--hud-text-muted)',
                  fontFamily: 'var(--font-hud)',
                  fontSize: 'var(--font-xs)',
                  cursor: isSkipped ? 'default' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: 5,
                  whiteSpace: 'nowrap',
                  opacity: isSkipped ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ color: statusInfo.color, fontSize: 10 }}>{statusInfo.icon}</span>
                {tab.title}
              </button>
            );
          })}
        </div>

        {/* ── Content Area ── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {activeTab ? (
            <PlanningTabContent
              tab={activeTab}
              editedContent={editedContent}
              onEdit={(content) => editTab(activeTabKey, content)}
              onReplan={() => handleReplan(activeTabKey)}
              isGenerating={status === 'generating' && activeTab.status === 'generating'}
            />
          ) : (
            <div style={{ padding: 24, color: 'var(--hud-text-dim)', textAlign: 'center' }}>
              Select a tab to view content
            </div>
          )}
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div role="alert" style={{
            padding: '8px 16px', background: '#1a0a0a',
            borderTop: '1px solid var(--neon-red)',
            color: 'var(--neon-red)', fontSize: 'var(--font-xs)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>ERROR: {error}</span>
            <button
              onClick={() => usePlanningStore.setState({ error: null })}
              aria-label="Dismiss error"
              style={{
                background: 'none', border: 'none', color: 'var(--neon-red)',
                cursor: 'pointer', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                padding: '0 4px',
              }}
            >
              X
            </button>
          </div>
        )}

        {/* ── Approval Result Banner ── */}
        {approvalResult && (
          <div style={{
            padding: '8px 16px', background: '#0a1a0f',
            borderTop: '1px solid var(--neon-green)',
            color: 'var(--neon-green)', fontSize: 'var(--font-xs)',
          }}>
            Plan approved! Hired {approvalResult.hired.length} agent(s): {approvalResult.hired.join(', ') || 'none'}.
            Created {approvalResult.ticketsCreated} ticket(s) with dependencies.
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: '#090d14',
          borderTop: '1px solid #1b2030', flexShrink: 0,
        }}>
          {/* Left: Progress */}
          <PlanningProgress
            currentPhase={currentPhase}
            totalPhases={totalPhases}
            status={status}
          />

          {/* Right: Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {status === 'review' && (
              <>
                <button
                  onClick={() => handleReplan()}
                  style={{
                    padding: '6px 14px',
                    background: '#1a1200', border: '1px solid var(--neon-orange)',
                    color: 'var(--neon-orange)',
                    fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                    cursor: 'pointer', textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Re-plan {isEdited ? 'from here' : 'all'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  style={{
                    padding: '6px 14px',
                    background: '#001a0f', border: '1px solid var(--neon-green)',
                    color: 'var(--neon-green)',
                    fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                    cursor: approving ? 'wait' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    opacity: approving ? 0.5 : 1,
                  }}
                >
                  {approving ? 'Executing...' : 'Approve & Execute'}
                </button>
              </>
            )}
            {status === 'approved' && (
              <button
                onClick={close}
                style={{
                  padding: '6px 14px',
                  background: '#001a0f', border: '1px solid var(--neon-green)',
                  color: 'var(--neon-green)',
                  fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
