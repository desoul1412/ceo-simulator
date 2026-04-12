import { useEffect, useState } from 'react';
import { usePresetStore, type DeptRoleWithCount } from '../store/presetStore';

interface DeptRoleBrowserProps {
  onSelect?: (deptRole: DeptRoleWithCount) => void;
  selectedId?: string | null;
}

export function DeptRoleBrowser({ onSelect, selectedId }: DeptRoleBrowserProps) {
  const { deptRoles, loading, loadDeptRoles, selectDept, deptSkills, loadingSkills } = usePresetStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (deptRoles.length === 0) loadDeptRoles();
  }, []);

  const handleCardClick = (dept: DeptRoleWithCount) => {
    if (expandedId === dept.id) {
      setExpandedId(null);
    } else {
      setExpandedId(dept.id);
      selectDept(dept.id);
    }
    onSelect?.(dept);
  };

  if (loading) {
    return <div style={{ padding: 20, color: '#4a5568', fontFamily: 'var(--font-hud)' }}>Loading departments...</div>;
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 8,
      }}>
        {deptRoles.map(dept => {
          const isSelected = selectedId === dept.id || expandedId === dept.id;
          return (
            <div key={dept.id}>
              <button
                onClick={() => handleCardClick(dept)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 12px',
                  background: isSelected ? `${dept.color}15` : '#090d14',
                  border: `1px solid ${isSelected ? dept.color + '60' : '#1b2030'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-hud)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: dept.color, display: 'inline-block',
                  }} />
                  <span style={{
                    fontSize: 'var(--font-sm)', color: isSelected ? dept.color : 'var(--hud-text-h)',
                    fontWeight: 600,
                  }}>
                    {dept.short_name}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 'var(--font-xs)', color: '#4a5568',
                  }}>
                    {dept.skill_count} skills
                  </span>
                </div>
                <div style={{
                  fontSize: 'var(--font-xs)', color: '#4a5568',
                  lineHeight: 1.4, display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {dept.description}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '1px 6px', fontSize: 10,
                    background: '#1b2030', color: '#6a7a90',
                    border: '1px solid #1b2030',
                  }}>
                    {dept.model_tier}
                  </span>
                  <span style={{
                    padding: '1px 6px', fontSize: 10,
                    background: '#1b2030', color: '#6a7a90',
                    border: '1px solid #1b2030',
                  }}>
                    ${dept.default_budget}
                  </span>
                  <span style={{
                    padding: '1px 6px', fontSize: 10,
                    background: '#1b2030', color: '#6a7a90',
                    border: '1px solid #1b2030',
                  }}>
                    {dept.tool_access}
                  </span>
                </div>
              </button>

              {/* Expanded skill list */}
              {expandedId === dept.id && (
                <div style={{
                  padding: '8px 12px',
                  background: '#0a0e15',
                  border: `1px solid ${dept.color}30`,
                  borderTop: 'none',
                  maxHeight: 200, overflow: 'auto',
                }}>
                  {loadingSkills ? (
                    <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>Loading skills...</div>
                  ) : deptSkills.length === 0 ? (
                    <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>No skills found</div>
                  ) : (
                    deptSkills.map(skill => (
                      <div key={skill.id} style={{
                        padding: '4px 0',
                        borderBottom: '1px solid #1b203050',
                        fontSize: 'var(--font-xs)',
                      }}>
                        <div style={{ color: '#8899aa', fontWeight: 500 }}>{skill.name}</div>
                        <div style={{ color: '#4a5568', display: 'flex', gap: 8 }}>
                          <span>{skill.seniority}</span>
                          <span>{skill.company_type}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
