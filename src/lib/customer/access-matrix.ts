/**
 * CLADORA Customer Access Matrix & Persona Capabilities
 *
 * Central, authoritative TypeScript definition of the 6 canonical roles,
 * their allowed dashboard sections, capabilities, data boundaries, and
 * read-only restrictions.
 *
 * Note: Authorization decisions are server/database authoritative.
 * This client-side matrix enforces presentation alignment, UI gating,
 * and automated security testing.
 */

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
    allowedSections: [
      'operations',
      'financials',
      'maintenance',
      'communications',
      'documents',
      'modules',
      'audit',
    ],
    forbiddenSections: [
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
    ],
    allowedCapabilities: [
      'can_view_operations',
      'can_view_financials',
      'can_view_accounting',
      'can_view_maintenance',
      'can_manage_work_orders',
      'can_view_communications',
      'can_view_documents',
      'can_view_audit',
    ],
    forbiddenCapabilities: [
      'can_view_my_residence',
      'can_view_my_consumption',
    ],
    forbiddenData: [],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/meters',
      '/app/assets',
      '/app/maintenance',
      '/app/vendors',
      '/app/governance',
      '/app/meetings',
      '/app/communications',
      '/app/notifications',
      '/app/documents',
      '/app/occupancy',
      '/app/ownership',
      '/app/security-access',
      '/app/billing',
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
    allowedSections: [
      'operations',
      'financials',
      'maintenance',
      'communications',
      'documents',
      'modules',
      'audit',
    ],
    forbiddenSections: [
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
    ],
    allowedCapabilities: [
      'can_view_operations',
      'can_view_financials',
      'can_view_accounting',
      'can_view_maintenance',
      'can_manage_work_orders',
      'can_view_communications',
      'can_view_documents',
      'can_view_audit',
    ],
    forbiddenCapabilities: [
      'can_view_my_residence',
      'can_view_my_consumption',
    ],
    forbiddenData: [],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/meters',
      '/app/assets',
      '/app/maintenance',
      '/app/vendors',
      '/app/governance',
      '/app/meetings',
      '/app/communications',
      '/app/notifications',
      '/app/documents',
      '/app/occupancy',
      '/app/ownership',
      '/app/security-access',
      '/app/billing',
      '/app/payments',
      '/app/reconciliation',
      '/app/audit',
    ],
    forbiddenNavLinks: [],
  },

  president: {
    role: 'president',
    personaTitle: 'Association President',
    isReadOnly: true,
    allowedSections: [
      'governance',
      'financial_summary',
      'contracts',
      'operations_summary',
      'audit',
    ],
    forbiddenSections: [
      'operations',
      'my_residence',
      'my_expenses',
      'my_consumption',
      'my_tickets',
      'my_voting',
      'my_units',
    ],
    allowedCapabilities: [
      'can_view_governance',
      'can_view_financial_summary',
      'can_view_contracts',
      'can_view_operations_summary',
      'can_view_audit',
      'is_read_only',
    ],
    forbiddenCapabilities: [
      'can_manage_work_orders',
      'can_view_my_residence',
      'can_view_my_consumption',
    ],
    forbiddenData: [],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/governance',
      '/app/meetings',
      '/app/documents',
      '/app/vendors',
      '/app/audit',
      '/app/communications',
      '/app/notifications',
    ],
    forbiddenNavLinks: [],
  },

  censor: {
    role: 'censor',
    personaTitle: 'Financial Censor / Auditor',
    isReadOnly: true,
    allowedSections: [
      'financial_controls',
      'control_documents',
      'discrepancies',
      'audit_trail',
    ],
    forbiddenSections: [
      'operations',
      'maintenance',
      'my_residence',
      'my_expenses',
      'my_units',
      'service_requests',
    ],
    allowedCapabilities: [
      'can_view_financial_controls',
      'can_view_documents',
      'can_view_audit',
      'is_read_only',
    ],
    forbiddenCapabilities: [
      'can_manage_work_orders',
      'can_mutate_financials',
      'can_approve_requests',
      'can_register_items',
    ],
    forbiddenData: [],
    allowedNavLinks: [
      '/app/dashboard',
      '/app/accounting',
      '/app/accounting/allocations',
      '/app/documents',
      '/app/audit',
    ],
    forbiddenNavLinks: [],
  },

  owner: {
    role: 'owner',
    personaTitle: 'Property Owner',
    isReadOnly: false,
    allowedSections: [
      'my_units',
      'my_financials',
      'my_documents',
      'my_voting',
      'service_requests',
    ],
    forbiddenSections: [
      'operations',
      'maintenance',
      'audit',
      'audit_trail',
      'financial_controls',
      'contracts',
      'credentials',
      'access_logs',
      'residents_directory',
      'all_units',
      'my_residence',
      'my_consumption',
    ],
    allowedCapabilities: [
      'can_view_my_units',
      'can_view_my_financials',
      'can_view_my_documents',
      'can_view_my_voting',
      'can_view_service_requests',
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
      '/app/governance',
      '/app/communications',
      '/app/notifications',
      '/app/billing',
      '/app/payments',
    ],
    forbiddenNavLinks: [
      '/app/audit',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
    ],
  },

  tenant_resident: {
    role: 'tenant_resident',
    personaTitle: 'Tenant / Resident',
    isReadOnly: false,
    allowedSections: [
      'my_residence',
      'my_expenses',
      'my_payments',
      'my_consumption',
      'my_tickets',
      'resident_notices',
    ],
    forbiddenSections: [
      'operations',
      'maintenance',
      'audit',
      'audit_trail',
      'financial_controls',
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
      'can_view_my_payments',
      'can_view_my_consumption',
      'can_view_my_tickets',
      'can_view_resident_notices',
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
      '/app/meters',
      '/app/communications',
      '/app/notifications',
      '/app/documents',
      '/app/billing',
      '/app/payments',
    ],
    forbiddenNavLinks: [
      '/app/audit',
      '/app/ownership',
      '/app/security-access',
      '/app/access-logs',
      '/app/credentials',
      '/app/visitors',
      '/app/governance',
    ],
  },
};

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
