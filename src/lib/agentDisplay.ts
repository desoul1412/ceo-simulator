/**
 * Convert agent names to role-based display.
 * If multiple agents share a role, add number suffix: Frontend, Frontend 2, Frontend 3
 */
export function getRoleDisplayName(role: string, agentId: string, allAgents: { id: string; role: string }[]): string {
  const sameRole = allAgents.filter(a => a.role === role);
  if (sameRole.length <= 1) return role;
  const idx = sameRole.findIndex(a => a.id === agentId);
  return idx === 0 ? role : `${role} ${idx + 1}`;
}
