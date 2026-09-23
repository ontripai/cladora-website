import { createClient } from '@/lib/supabase/server';
import type {
  PlatformAuthContext,
  PlatformRole,
  PlatformUser,
  PlatformRoleAssignment,
  PlatformCustomerAssignment,
  ScopeType,
} from '@/types/platform';

export async function getPlatformAuthContext(): Promise<PlatformAuthContext> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      userId: '',
      platformUser: null,
      roles: [],
      assignments: [],
      assuranceLevel: null,
      isAuthorized: false,
    };
  }

  const userId = claimsData.claims.sub;
  const assuranceLevel = claimsData.claims.aal === 'aal2' ? 'aal2' : 'aal1';

  if (assuranceLevel !== 'aal2') {
    return {
      userId,
      platformUser: null,
      roles: [],
      assignments: [],
      assuranceLevel,
      isAuthorized: false,
    };
  }

  const { data, error } = await supabase
    .schema('customer_api')
    .rpc('get_my_platform_auth_context_v1');

  if (error) throw error;

  const payload = data as unknown as {
    platform_user: PlatformUser | null;
    roles: PlatformRoleAssignment[];
    assignments: PlatformCustomerAssignment[];
    is_authorized: boolean;
  };

  const platformUser = payload.platform_user;
  const roles = (payload.roles ?? []).map((assignment) => assignment.role);
  const assignments = payload.assignments ?? [];
  const isAuthorized = payload.is_authorized === true && platformUser !== null && roles.length > 0;

  return {
    userId,
    platformUser,
    roles,
    assignments,
    assuranceLevel,
    isAuthorized,
  };
}

export function hasPlatformAal2(ctx: PlatformAuthContext): boolean {
  return ctx.isAuthorized && ctx.assuranceLevel === 'aal2';
}

export function hasPlatformRole(
  ctx: PlatformAuthContext,
  requiredRole: PlatformRole | PlatformRole[]
): boolean {
  if (!ctx.isAuthorized || !ctx.platformUser) return false;
  const targetRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return targetRoles.some((r) => ctx.roles.includes(r));
}

export function hasWorkspaceAssignment(
  ctx: PlatformAuthContext,
  workspaceId: string,
  requiredScope: ScopeType = 'workspace'
): boolean {
  if (!ctx.isAuthorized || !ctx.platformUser) return false;

  if (ctx.roles.includes('PLATFORM_SUPER_ADMIN')) {
    return true;
  }

  return ctx.assignments.some(
    (a) =>
      a.customer_workspace_id === workspaceId &&
      (a.scope_type === requiredScope || a.scope_type === 'workspace')
  );
}
