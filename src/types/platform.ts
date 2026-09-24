export type PlatformRole =
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_OPERATIONS'
  | 'PLATFORM_FINANCE'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_AUDITOR';

export type WorkspaceType =
  | 'ASSOCIATION'
  | 'PROPERTY_MANAGER'
  | 'OWNER_PORTFOLIO'
  | 'HYBRID';

export type WorkspaceLifecycleStatus =
  | 'LEAD'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CONTRACT_PENDING'
  | 'PAYMENT_PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'ARCHIVED';

export type WorkspaceEnvironment = 'PILOT' | 'PRODUCTION';

export type ScopeType =
  | 'workspace'
  | 'commercial'
  | 'technical'
  | 'support'
  | 'audit';

export interface PlatformUser {
  id: string;
  auth_user_id: string;
  employee_ref: string;
  display_name: string;
  status: 'active' | 'suspended' | 'deactivated';
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
}

export interface PlatformRoleAssignment {
  id: string;
  platform_user_id: string;
  role: PlatformRole;
  valid_from: string;
  valid_until: string | null;
  status: 'active' | 'revoked' | 'expired';
  granted_by: string | null;
  grant_reason: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
}

export interface CustomerWorkspace {
  id: string;
  tenant_id: string;
  tenant_legal_name?: string;
  workspace_type: WorkspaceType;
  lifecycle_status: WorkspaceLifecycleStatus;
  commercial_owner: string;
  environment: WorkspaceEnvironment;
  version: number;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  suspended_at: string | null;
  terminated_at: string | null;
  archived_at: string | null;
}

export interface PlatformCustomerAssignment {
  id: string;
  platform_user_id: string;
  customer_workspace_id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: 'active' | 'revoked' | 'expired';
  assigned_by: string | null;
  assignment_reason: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  plan_code: string;
  version: number;
  display_name: string;
  status: 'draft' | 'active' | 'deprecated' | 'retired';
  feature_catalogue: string[];
  limit_schema: Record<string, number | string | boolean>;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
}

export interface WorkspaceContract {
  id: string;
  customer_workspace_id: string;
  plan_id: string | null;
  contract_ref: string;
  version: number;
  currency: 'EUR' | 'RON' | 'USD';
  status: 'draft' | 'pending_signature' | 'signed' | 'active' | 'expired' | 'terminated' | 'superseded';
  start_date: string;
  end_date: string | null;
  signed_at: string | null;
  activated_at: string | null;
  commercial_terms: Record<string, unknown>;
  created_at: string;
}

export interface WorkspaceEntitlement {
  id: string;
  customer_workspace_id: string;
  contract_id: string | null;
  entitlement_key: string;
  value_type: 'numeric' | 'boolean' | 'string' | 'array' | 'json';
  numeric_value: number | null;
  boolean_value: boolean | null;
  text_value: string | null;
  json_value: unknown;
  valid_from: string;
  valid_until: string | null;
  override_value_json: unknown | null;
  override_reason: string | null;
  override_expires_at: string | null;
  override_approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProvisioningRun {
  id: string;
  customer_workspace_id: string;
  idempotency_key: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  initiated_by: string | null;
  started_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  evidence_json: Record<string, unknown>;
  created_at: string;
}

export interface ProvisioningTask {
  id: string;
  run_id: string;
  task_order: number;
  task_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  result_evidence: Record<string, unknown>;
  created_at: string;
}

export interface SupportAccessRequest {
  id: string;
  customer_workspace_id: string;
  ticket_ref: string;
  purpose: string;
  requested_scope: string;
  sensitivity_level: 'standard' | 'sensitive' | 'critical';
  requester_id: string;
  status: 'requested' | 'approved' | 'rejected' | 'expired' | 'revoked';
  created_at: string;
}

export interface SupportAccessGrant {
  id: string;
  request_id: string;
  customer_workspace_id: string;
  approver_id: string;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  activation_evidence: Record<string, unknown>;
  created_at: string;
}

export interface PlatformAuthContext {
  userId: string;
  platformUser: PlatformUser | null;
  roles: PlatformRole[];
  assignments: PlatformCustomerAssignment[];
  assuranceLevel: 'aal1' | 'aal2' | null;
  isAuthorized: boolean;
}
