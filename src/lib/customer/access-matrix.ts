/**
 * CLADORA Customer Access Matrix & Persona Capabilities
 *
 * Central, authoritative TypeScript definition of the 6 canonical roles,
 * their allowed dashboard sections, capabilities, data boundaries, and
 * read-only restrictions.
 *
 * Note: Authorization decisions are server/database authoritative.
 * This client-side matrix enforces presentation alignment, UI gating,
 * route allowlisting, and automated security testing.
 */

export const EXPLICITLY_UNAVAILABLE_ROUTES = [
  '/app/portfolio',
  '/app/settings',
  '/app/accounting/month-close',
  '/app/migration/shadow-ledger',
] as const;

export const PRE_CONTEXT_ALLOWED_ROUTES = ['/app/onboarding'] as const;

export function isPreContextRoute(pathname: string): boolean {
  return pathname === '/app/onboarding' || pathname.startsWith('/app/onboarding/');
}

export const CANONICAL_ROLES = [
  'association_admin',
  'property_manager',
  'president',
  'censor',
  'owner',
  'tenant_resident',
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

export interface PersonaMatrixDefinition {
  role: CanonicalRole;
  personaTitle: string;
  isReadOnly: boolean;
  allowedSections: readonly string[];
  forbiddenSections: readonly string[];
  allowedCapabilities: readonly string[];
  forbiddenCapabilities: readonly string[];
  forbiddenData: readonly string[];
  allowedNavLinks: readonly string[];
  forbiddenNavLinks: readonly string[];
}

export const PERSONA_ACCESS_MATRIX: Record<CanonicalRole, PersonaMatrixDefinition> = {
  association_admin: {
    role: 'association_admin',
    personaTitle: 'Association Administrator',
    isReadOnly: false,
    allowedSections: ['operations', 'financials', 'audit'],
    forbiddenSections: [
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
      'financial_controls',
    ],
    allowedCapabilities: [
      'can_view_operations',
      'can_view_financials',
      'can_view_audit',
    ],
    forbiddenCapabilities: [
      'can_view_my_residence',
      'can_view_my_consumption',
      'is_read_only',
    ],
    forbiddenData: ['cross_tenant_data'],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/meters',
      '/app/assets',
      '/app/maintenance',
      '/app/procurement',
      '/app/vendors',
      '/app/purchase-orders',
      '/app/vendor-contracts',
      '/app/vendor-sla',
      '/app/governance',
      '/app/meetings',
      '/app/communications',
      '/app/notifications',
      '/app/documents',
      '/app/documents/[id]',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/ownership',
      '/app/leases',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/billing',
      '/app/invoices',
      '/app/receivables',
      '/app/payments',
      '/app/reconciliation',
      '/app/audit',
    ],
    forbiddenNavLinks: [],
  },

  property_manager: {
    role: 'property_manager',
    personaTitle: 'Property Manager',
    isReadOnly: false,
    allowedSections: ['operations', 'financials', 'audit'],
    forbiddenSections: [
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
      'financial_controls',
    ],
    allowedCapabilities: [
      'can_view_operations',
      'can_view_financials',
      'can_view_audit',
    ],
    forbiddenCapabilities: [
      'can_view_my_residence',
      'can_view_my_consumption',
      'is_read_only',
    ],
    forbiddenData: ['cross_tenant_data'],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/meters',
      '/app/assets',
      '/app/maintenance',
      '/app/procurement',
      '/app/vendors',
      '/app/purchase-orders',
      '/app/vendor-contracts',
      '/app/vendor-sla',
      '/app/communications',
      '/app/notifications',
      '/app/documents',
      '/app/documents/[id]',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/ownership',
      '/app/leases',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/billing',
      '/app/invoices',
      '/app/receivables',
      '/app/payments',
      '/app/reconciliation',
      '/app/audit',
    ],
    forbiddenNavLinks: [
      '/app/governance',
      '/app/meetings',
    ],
  },

  president: {
    role: 'president',
    personaTitle: 'Association President',
    isReadOnly: true,
    allowedSections: ['governance', 'financial_summary', 'audit'],
    forbiddenSections: [
      'operations',
      'maintenance',
      'financial_controls',
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
      'security_access',
    ],
    allowedCapabilities: [
      'can_view_governance',
      'can_view_financial_summary',
      'can_view_audit',
      'is_read_only',
    ],
    forbiddenCapabilities: [
      'can_manage_work_orders',
      'can_view_my_residence',
      'can_view_my_consumption',
      'can_view_credentials',
      'can_view_access_logs',
    ],
    forbiddenData: [
      'security_credentials',
      'access_logs',
      'other_units_private_info',
    ],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/governance',
      '/app/meetings',
      '/app/documents',
      '/app/documents/[id]',
      '/app/vendors',
      '/app/vendor-contracts',
      '/app/vendor-sla',
      '/app/communications',
      '/app/notifications',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/billing',
      '/app/invoices',
      '/app/receivables',
      '/app/payments',
      '/app/reconciliation',
      '/app/audit',
    ],
    forbiddenNavLinks: [
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/maintenance',
      '/app/assets',
      '/app/purchase-orders',
      '/app/procurement',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/ownership',
      '/app/leases',
    ],
  },

  censor: {
    role: 'censor',
    personaTitle: 'Financial Censor / Auditor',
    isReadOnly: true,
    allowedSections: ['financial_controls', 'audit'],
    forbiddenSections: [
      'operations',
      'maintenance',
      'governance',
      'my_residence',
      'my_expenses',
      'my_units',
      'my_consumption',
      'service_requests',
      'security_access',
    ],
    allowedCapabilities: [
      'can_view_financial_controls',
      'can_view_audit',
      'is_read_only',
    ],
    forbiddenCapabilities: [
      'can_manage_work_orders',
      'can_mutate_financials',
      'can_approve_requests',
      'can_register_items',
    ],
    forbiddenData: [
      'resident_directory',
      'security_credentials',
      'access_logs',
    ],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/billing',
      '/app/invoices',
      '/app/receivables',
      '/app/payments',
      '/app/reconciliation',
      '/app/documents',
      '/app/documents/[id]',
      '/app/audit',
    ],
    forbiddenNavLinks: [
      '/app/governance',
      '/app/meetings',
      '/app/maintenance',
      '/app/assets',
      '/app/vendors',
      '/app/procurement',
      '/app/purchase-orders',
      '/app/vendor-contracts',
      '/app/vendor-sla',
      '/app/meters',
      '/app/communications',
      '/app/notifications',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/ownership',
      '/app/leases',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
    ],
  },

  owner: {
    role: 'owner',
    personaTitle: 'Property Owner',
    isReadOnly: false,
    allowedSections: ['my_units', 'my_financials'],
    forbiddenSections: [
      'operations',
      'maintenance',
      'audit',
      'financial_controls',
      'financial_summary',
      'credentials',
      'access_logs',
      'residents_directory',
      'all_units',
      'my_residence',
      'my_expenses',
      'my_consumption',
    ],
    allowedCapabilities: [
      'can_view_my_units',
      'can_view_my_financials',
    ],
    forbiddenCapabilities: [
      'can_view_audit',
      'can_view_other_units',
      'can_view_resident_directory',
      'can_view_access_logs',
      'can_view_credentials',
      'can_manage_work_orders',
      'can_view_financial_controls',
    ],
    forbiddenData: [
      'other_units_private_info',
      'resident_directory',
      'credentials',
      'access_logs',
      'general_audit',
    ],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/documents',
      '/app/documents/[id]',
      '/app/governance',
      '/app/meetings',
      '/app/communications',
      '/app/notifications',
      '/app/invoices',
      '/app/payments',
      '/app/ownership',
    ],
    forbiddenNavLinks: [
      '/app/billing',
      '/app/receivables',
      '/app/meters',
      '/app/audit',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/leases',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/reconciliation',
      '/app/assets',
      '/app/maintenance',
      '/app/procurement',
      '/app/vendors',
      '/app/purchase-orders',
      '/app/vendor-contracts',
      '/app/vendor-sla',
    ],
  },

  tenant_resident: {
    role: 'tenant_resident',
    personaTitle: 'Tenant / Resident',
    isReadOnly: false,
    allowedSections: ['my_residence', 'my_expenses', 'my_consumption'],
    forbiddenSections: [
      'operations',
      'maintenance',
      'audit',
      'financial_controls',
      'financial_summary',
      'contracts',
      'governance',
      'ownership',
      'my_units',
      'my_voting',
      'credentials',
      'access_logs',
      'residents_directory',
      'all_units',
    ],
    allowedCapabilities: [
      'can_view_my_residence',
      'can_view_my_expenses',
      'can_view_my_consumption',
    ],
    forbiddenCapabilities: [
      'can_view_audit',
      'can_view_ownership',
      'can_view_owner_equity',
      'can_view_other_units',
      'can_view_resident_directory',
      'can_view_access_logs',
      'can_view_credentials',
      'can_view_governance_votes',
    ],
    forbiddenData: [
      'owner_equity_capital',
      'property_ownership_records',
      'owner_votes',
      'other_units_data',
      'credentials',
      'access_logs',
      'general_audit',
    ],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/documents',
      '/app/documents/[id]',
      '/app/communications',
      '/app/notifications',
      '/app/invoices',
      '/app/payments',
      '/app/meters',
    ],
    forbiddenNavLinks: [
      '/app/billing',
      '/app/receivables',
      '/app/governance',
      '/app/meetings',
      '/app/audit',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/occupancy',
      '/app/occupancy/[id]',
      '/app/residents',
      '/app/ownership',
      '/app/leases',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/reconciliation',
      '/app/assets',
      '/app/maintenance',
      '/app/procurement',
      '/app/vendors',
      '/app/purchase-orders',
      '/app/vendor-contracts',
      '/app/vendor-sla',
    ],
  },
};

/**
 * Validates whether a route pattern matches a clean URL path.
 * Supports exact paths (e.g. '/app/documents') and dynamic parameters
 * (e.g. '/app/documents/[id]' matching '/app/documents/123').
 * Strictly prevents prefix matching bugs (e.g. '/app/audit-malicious').
 */
export function matchesRoutePattern(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  if (pattern.endsWith('/[id]')) {
    const base = pattern.slice(0, -5);
    if (path.startsWith(`${base}/`)) {
      const rest = path.slice(base.length + 1);
      return rest.length > 0 && !rest.includes('/');
    }
  }
  return false;
}

/**
 * Validates whether a role code is one of the 6 canonical roles.
 */
export function isCanonicalRole(role: string | null | undefined): role is CanonicalRole {
  if (!role) return false;
  return (CANONICAL_ROLES as readonly string[]).includes(role.toLowerCase());
}

/**
 * Retrieves the Persona Access Matrix for a given role code.
 * Returns null if the role is unknown or invalid (Fail-Closed).
 */
export function getPersonaMatrix(role: string | null | undefined): PersonaMatrixDefinition | null {
  if (!role || !isCanonicalRole(role)) return null;
  return PERSONA_ACCESS_MATRIX[role.toLowerCase() as CanonicalRole] ?? null;
}

/**
 * Authoritative client-side route allowlist check for a persona.
 * Enforces:
 * 1. Role must be canonical.
 * 2. Route must be in the persona's allowedNavLinks allowlist.
 * 3. Route must not be an unreleased/mock route.
 * 4. Route must not be in the persona's forbiddenNavLinks.
 * 5. Prefix/fake routes are rejected.
 */
export function isRouteAllowedForPersona(
  role: string | null | undefined,
  path: string
): boolean {
  if (!role || !isCanonicalRole(role)) return false;
  const matrix = getPersonaMatrix(role);
  if (!matrix) return false;

  // Clean path (strip language prefix if present, strip trailing slash)
  const normalized = path.replace(/^\/(?:ro|en|fa)/, '');
  const cleanPath = normalized === '/' ? normalized : normalized.replace(/\/$/, '');

  // 1. Explicitly unavailable routes are always denied
  if (
    EXPLICITLY_UNAVAILABLE_ROUTES.some((mock) =>
      matchesRoutePattern(mock, cleanPath)
    )
  ) {
    return false;
  }

  // 2. Extra defense-in-depth: check forbidden list
  if (
    matrix.forbiddenNavLinks.some((forbidden) =>
      matchesRoutePattern(forbidden, cleanPath)
    )
  ) {
    return false;
  }

  // 3. Must be explicitly contained in allowedNavLinks
  return matrix.allowedNavLinks.some((allowed) =>
    matchesRoutePattern(allowed, cleanPath)
  );
}

/**
 * Checks whether a specific section is allowed for a given persona.
 * Defaults to false (Fail-Closed) if the role is unknown.
 */
export function isSectionAllowed(role: string | null | undefined, section: string): boolean {
  const matrix = getPersonaMatrix(role);
  if (!matrix) return false;
  return matrix.allowedSections.includes(section);
}

/**
 * Checks whether a specific capability is allowed for a given persona.
 * Defaults to false (Fail-Closed) if the role is unknown.
 */
export function isCapabilityAllowed(role: string | null | undefined, capability: string): boolean {
  const matrix = getPersonaMatrix(role);
  if (!matrix) return false;
  return matrix.allowedCapabilities.includes(capability);
}

/**
 * Returns true if the role must strictly operate in Read-Only mode (e.g. censor).
 */
export function isPersonaReadOnly(role: string | null | undefined): boolean {
  const matrix = getPersonaMatrix(role);
  return matrix?.isReadOnly ?? true;
}
