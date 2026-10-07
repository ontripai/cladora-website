// This mapping describes the intended primary role. Availability is controlled
// separately so a newly seeded role cannot accidentally activate a workspace.
export const PRIMARY_WORKSPACE_ROLES = {
  ASSOCIATION: 'association_admin',
  PROPERTY_MANAGER: 'property_manager',
  OWNER_PORTFOLIO: 'owner_portfolio_admin',
  HYBRID: 'hybrid_workspace_admin',
} as const;

export function primaryWorkspaceRole(workspaceType: string): string | null {
  return PRIMARY_WORKSPACE_ROLES[workspaceType as keyof typeof PRIMARY_WORKSPACE_ROLES] ?? null;
}

export function isPrimaryWorkspaceRoleAvailable(workspaceType: string): boolean {
  return workspaceType === 'ASSOCIATION' || workspaceType === 'PROPERTY_MANAGER';
}
