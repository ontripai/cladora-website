export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      get_control_plane_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      create_customer_workspace: {
        Args: {
          p_tenant_id: string;
          p_workspace_type: string;
          p_commercial_owner: string;
          p_environment?: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      update_workspace_metadata: {
        Args: {
          p_workspace_id: string;
          p_commercial_owner: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      transition_workspace_lifecycle: {
        Args: {
          p_workspace_id: string;
          p_target_status: string;
          p_expected_version: number;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      create_provisioning_run: {
        Args: {
          p_workspace_id: string;
          p_idempotency_key: string;
          p_task_types: string[];
        };
        Returns: Database['platform']['Tables']['provisioning_runs']['Row'];
      };
      grant_customer_assignment: {
        Args: {
          p_platform_user_id: string;
          p_customer_workspace_id: string;
          p_scope_type?: string;
          p_scope_id?: string | null;
          p_valid_from?: string;
          p_valid_until?: string | null;
          p_reason?: string;
        };
        Returns: Database['platform']['Tables']['platform_customer_assignments']['Row'];
      };
      revoke_customer_assignment: {
        Args: {
          p_assignment_id: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['platform_customer_assignments']['Row'];
      };
      create_workspace_contract: {
        Args: {
          p_workspace_id: string;
          p_contract_ref: string;
          p_plan_id?: string | null;
          p_currency?: string;
          p_start_date?: string;
          p_end_date?: string | null;
          p_commercial_terms?: Json;
        };
        Returns: Database['platform']['Tables']['workspace_contracts']['Row'];
      };
      activate_workspace_contract: {
        Args: {
          p_contract_id: string;
          p_reason?: string;
        };
        Returns: Database['platform']['Tables']['workspace_contracts']['Row'];
      };
      set_workspace_entitlement: {
        Args: {
          p_workspace_id: string;
          p_entitlement_key: string;
          p_value_type: string;
          p_numeric_value?: number | null;
          p_boolean_value?: boolean | null;
          p_text_value?: string | null;
          p_json_value?: Json | null;
          p_override_value_json?: Json | null;
          p_override_reason?: string | null;
          p_override_expires_at?: string | null;
        };
        Returns: Database['platform']['Tables']['workspace_entitlements']['Row'];
      };
      request_support_access: {
        Args: {
          p_workspace_id: string;
          p_ticket_ref: string;
          p_purpose: string;
          p_requested_scope: string;
          p_sensitivity_level: string;
          p_duration_minutes: number;
          p_evidence: Json;
        };
        Returns: Database['platform']['Tables']['support_access_requests']['Row'];
      };
      approve_support_access: {
        Args: {
          p_request_id: string;
          p_evidence: Json;
        };
        Returns: Database['platform']['Tables']['support_access_grants']['Row'];
      };
      revoke_support_access: {
        Args: {
          p_grant_id: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['support_access_grants']['Row'];
      };
      list_support_access: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string | null; p_status?: string | null; p_workspace_id?: string | null };
        Returns: Array<Record<string, Json> & { total_count: number }>;
      };
      list_support_workspaces: {
        Args: Record<string, never>;
        Returns: Array<{ workspace_id: string; workspace_label: string }>;
      };
      cancel_support_access_request: {
        Args: { p_request_id: string; p_reason: string };
        Returns: Database['platform']['Tables']['support_access_requests']['Row'];
      };
      enforce_entitlement_quota: {
        Args: {
          p_workspace_id: string;
          p_entitlement_key: string;
          p_requested_quantity: number;
          p_idempotency_key?: string;
          p_reason?: string;
        };
        Returns: boolean;
      };
      create_workspace_invitation: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role_id: string;
          p_scope_type?: string;
          p_expires_in?: string;
          p_reason?: string | null;
        };
        Returns: Array<{
          invitation_id: string;
          invitation_token: string;
          invitation_expires_at: string;
        }>;
      };
      validate_workspace_invitation: {
        Args: { p_token: string };
        Returns: Array<{
          invitation_id: string;
          customer_workspace_id: string;
          invitation_status: string;
          invitation_expires_at: string;
        }>;
      };
      revoke_workspace_invitation: {
        Args: { p_invitation_id: string; p_reason: string };
        Returns: Record<string, unknown>;
      };
      accept_primary_admin_invitation: {
        Args: {
          p_token: string;
          p_display_name: string;
          p_locale?: string;
          p_timezone?: string;
        };
        Returns: Array<{
          customer_workspace_id: string;
          membership_id: string;
          onboarding_required: boolean;
        }>;
      };
      list_my_claimable_workspace_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          invitation_id: string;
          workspace_label: string;
          workspace_type: string;
          workspace_environment: string;
          access_label: string;
          invitation_expires_at: string;
        }>;
      };
      claim_workspace_invitation: {
        Args: {
          p_invitation_id: string;
          p_display_name: string;
          p_locale?: string;
          p_timezone?: string;
        };
        Returns: Array<{
          claim_status: 'claimed' | 'already_claimed_by_you';
          customer_workspace_id: string;
          membership_id: string;
          onboarding_required: boolean;
        }>;
      };
      complete_primary_admin_onboarding: {
        Args: { p_workspace_id: string; p_expected_version: number; p_reason: string };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      get_my_primary_admin_onboarding: {
        Args: { p_workspace_id: string };
        Returns: Array<{ customer_workspace_id: string; workspace_version: number; onboarding_completed: boolean }>;
      };
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: unknown;
    };
  };
  platform: {
    Tables: {
      platform_users: {
        Row: {
          id: string;
          auth_user_id: string;
          employee_ref: string;
          display_name: string;
          status: string;
          created_at: string;
          updated_at: string;
          deactivated_at: string | null;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          employee_ref: string;
          display_name: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          employee_ref?: string;
          display_name?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
        };
        Relationships: [];
      };
      platform_role_assignments: {
        Row: {
          id: string;
          platform_user_id: string;
          role: string;
          valid_from: string;
          valid_until: string | null;
          status: string;
          granted_by: string | null;
          grant_reason: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform_user_id: string;
          role: string;
          valid_from?: string;
          valid_until?: string | null;
          status?: string;
          granted_by?: string | null;
          grant_reason: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform_user_id?: string;
          role?: string;
          valid_from?: string;
          valid_until?: string | null;
          status?: string;
          granted_by?: string | null;
          grant_reason?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_workspaces: {
        Row: {
          id: string;
          tenant_id: string;
          workspace_type: string;
          lifecycle_status: string;
          commercial_owner: string;
          environment: string;
          version: number;
          created_at: string;
          updated_at: string;
          activated_at: string | null;
          suspended_at: string | null;
          terminated_at: string | null;
          archived_at: string | null;
          primary_admin_user_id: string | null;
          primary_admin_membership_id: string | null;
          primary_admin_accepted_at: string | null;
          onboarding_completed_at: string | null;
          onboarding_completed_by: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          workspace_type: string;
          lifecycle_status?: string;
          commercial_owner: string;
          environment?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          terminated_at?: string | null;
          archived_at?: string | null;
          primary_admin_user_id?: string | null;
          primary_admin_membership_id?: string | null;
          primary_admin_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_completed_by?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          workspace_type?: string;
          lifecycle_status?: string;
          commercial_owner?: string;
          environment?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          terminated_at?: string | null;
          archived_at?: string | null;
          primary_admin_user_id?: string | null;
          primary_admin_membership_id?: string | null;
          primary_admin_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_completed_by?: string | null;
        };
        Relationships: [];
      };
      platform_customer_assignments: {
        Row: {
          id: string;
          platform_user_id: string;
          customer_workspace_id: string;
          scope_type: string;
          scope_id: string | null;
          valid_from: string;
          valid_until: string | null;
          status: string;
          assigned_by: string | null;
          assignment_reason: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform_user_id: string;
          customer_workspace_id: string;
          scope_type?: string;
          scope_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          status?: string;
          assigned_by?: string | null;
          assignment_reason: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform_user_id?: string;
          customer_workspace_id?: string;
          scope_type?: string;
          scope_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          status?: string;
          assigned_by?: string | null;
          assignment_reason?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          plan_code: string;
          version: number;
          display_name: string;
          status: string;
          feature_catalogue: Json;
          limit_schema: Json;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_code: string;
          version?: number;
          display_name: string;
          status?: string;
          feature_catalogue?: Json;
          limit_schema?: Json;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_code?: string;
          version?: number;
          display_name?: string;
          status?: string;
          feature_catalogue?: Json;
          limit_schema?: Json;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_contracts: {
        Row: {
          id: string;
          customer_workspace_id: string;
          plan_id: string | null;
          contract_ref: string;
          version: number;
          currency: string;
          status: string;
          start_date: string;
          end_date: string | null;
          signed_at: string | null;
          activated_at: string | null;
          commercial_terms: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_workspace_id: string;
          plan_id?: string | null;
          contract_ref: string;
          version?: number;
          currency?: string;
          status?: string;
          start_date: string;
          end_date?: string | null;
          signed_at?: string | null;
          activated_at?: string | null;
          commercial_terms?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_workspace_id?: string;
          plan_id?: string | null;
          contract_ref?: string;
          version?: number;
          currency?: string;
          status?: string;
          start_date?: string;
          end_date?: string | null;
          signed_at?: string | null;
          activated_at?: string | null;
          commercial_terms?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_entitlements: {
        Row: {
          id: string;
          customer_workspace_id: string;
          contract_id: string | null;
          entitlement_key: string;
          value_type: string;
          numeric_value: number | null;
          boolean_value: boolean | null;
          text_value: string | null;
          json_value: Json | null;
          valid_from: string;
          valid_until: string | null;
          override_value_json: Json | null;
          override_reason: string | null;
          override_expires_at: string | null;
          override_approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_workspace_id: string;
          contract_id?: string | null;
          entitlement_key: string;
          value_type: string;
          numeric_value?: number | null;
          boolean_value?: boolean | null;
          text_value?: string | null;
          json_value?: Json | null;
          valid_from?: string;
          valid_until?: string | null;
          override_value_json?: Json | null;
          override_reason?: string | null;
          override_expires_at?: string | null;
          override_approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_workspace_id?: string;
          contract_id?: string | null;
          entitlement_key?: string;
          value_type?: string;
          numeric_value?: number | null;
          boolean_value?: boolean | null;
          text_value?: string | null;
          json_value?: Json | null;
          valid_from?: string;
          valid_until?: string | null;
          override_value_json?: Json | null;
          override_reason?: string | null;
          override_expires_at?: string | null;
          override_approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entitlement_usage_ledger: {
        Row: {
          id: string;
          customer_workspace_id: string;
          entitlement_key: string;
          delta: number;
          idempotency_key: string | null;
          reason: string;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          customer_workspace_id: string;
          entitlement_key: string;
          delta: number;
          idempotency_key?: string | null;
          reason: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          customer_workspace_id?: string;
          entitlement_key?: string;
          delta?: number;
          idempotency_key?: string | null;
          reason?: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Relationships: [];
      };
      provisioning_runs: {
        Row: {
          id: string;
          customer_workspace_id: string;
          idempotency_key: string;
          status: string;
          initiated_by: string | null;
          started_at: string;
          completed_at: string | null;
          failure_reason: string | null;
          evidence_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_workspace_id: string;
          idempotency_key: string;
          status?: string;
          initiated_by?: string | null;
          started_at?: string;
          completed_at?: string | null;
          failure_reason?: string | null;
          evidence_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_workspace_id?: string;
          idempotency_key?: string;
          status?: string;
          initiated_by?: string | null;
          started_at?: string;
          completed_at?: string | null;
          failure_reason?: string | null;
          evidence_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      provisioning_tasks: {
        Row: {
          id: string;
          run_id: string;
          task_order: number;
          task_type: string;
          status: string;
          attempt_count: number;
          started_at: string | null;
          completed_at: string | null;
          failure_reason: string | null;
          result_evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          task_order: number;
          task_type: string;
          status?: string;
          attempt_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          failure_reason?: string | null;
          result_evidence?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          task_order?: number;
          task_type?: string;
          status?: string;
          attempt_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          failure_reason?: string | null;
          result_evidence?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      support_access_requests: {
        Row: {
          id: string;
          customer_workspace_id: string;
          ticket_ref: string;
          purpose: string;
          requested_scope: string;
          sensitivity_level: string;
          requester_id: string;
          status: string;
          created_at: string;
          requested_duration_minutes: number;
          request_evidence: Json;
        };
        Insert: {
          id?: string;
          customer_workspace_id: string;
          ticket_ref: string;
          purpose: string;
          requested_scope?: string;
          sensitivity_level?: string;
          requester_id: string;
          status?: string;
          created_at?: string;
          requested_duration_minutes: number;
          request_evidence?: Json;
        };
        Update: {
          id?: string;
          customer_workspace_id?: string;
          ticket_ref?: string;
          purpose?: string;
          requested_scope?: string;
          sensitivity_level?: string;
          requester_id?: string;
          status?: string;
          created_at?: string;
          requested_duration_minutes?: number;
          request_evidence?: Json;
        };
        Relationships: [];
      };
      support_access_grants: {
        Row: {
          id: string;
          request_id: string;
          customer_workspace_id: string;
          approver_id: string;
          starts_at: string;
          expires_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
          activation_evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          customer_workspace_id: string;
          approver_id: string;
          starts_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          activation_evidence?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          customer_workspace_id?: string;
          approver_id?: string;
          starts_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          activation_evidence?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      my_customer_mfa_requirement: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      list_my_customer_contexts: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          context_id: string;
          membership_id: string;
          tenant_id: string;
          tenant_name: string;
          role_code: string;
          role_name: string;
          scope_type: string;
          property_id: string | null;
          building_id: string | null;
          unit_id: string | null;
          context_label: string;
          starts_at: string;
          ends_at: string | null;
        }>;
      };
      get_customer_dashboard: {
        Args: { p_context_id: string };
        Returns: Json;
      };
      get_plan_dependency_counts: {
        Args: { p_plan_ids: string[] };
        Returns: Array<{ plan_id: string; workspace_count: number; contract_count: number }>;
      };
      create_subscription_plan_version: {
        Args: { p_plan_code: string; p_display_name: string; p_feature_catalogue: Json; p_limit_schema: Json; p_effective_from: string; p_effective_until: string | null; p_reason: string };
        Returns: Database['platform']['Tables']['subscription_plans']['Row'];
      };
      activate_subscription_plan: { Args: { p_plan_id: string; p_reason: string }; Returns: Database['platform']['Tables']['subscription_plans']['Row'] };
      retire_subscription_plan: { Args: { p_plan_id: string; p_reason: string }; Returns: Database['platform']['Tables']['subscription_plans']['Row'] };
      create_customer_workspace: {
        Args: {
          p_tenant_id: string;
          p_workspace_type: string;
          p_commercial_owner: string;
          p_environment?: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      update_workspace_metadata: {
        Args: {
          p_workspace_id: string;
          p_commercial_owner: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      transition_workspace_lifecycle: {
        Args: {
          p_workspace_id: string;
          p_target_status: string;
          p_expected_version: number;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      create_provisioning_run: {
        Args: {
          p_workspace_id: string;
          p_idempotency_key: string;
          p_task_types: string[];
        };
        Returns: Database['platform']['Tables']['provisioning_runs']['Row'];
      };
      grant_customer_assignment: {
        Args: {
          p_platform_user_id: string;
          p_customer_workspace_id: string;
          p_scope_type?: string;
          p_scope_id?: string | null;
          p_valid_from?: string;
          p_valid_until?: string | null;
          p_reason?: string;
        };
        Returns: Database['platform']['Tables']['platform_customer_assignments']['Row'];
      };
      revoke_customer_assignment: {
        Args: {
          p_assignment_id: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['platform_customer_assignments']['Row'];
      };
      create_workspace_contract: {
        Args: {
          p_workspace_id: string;
          p_contract_ref: string;
          p_plan_id?: string | null;
          p_currency?: string;
          p_start_date?: string;
          p_end_date?: string | null;
          p_commercial_terms?: Json;
        };
        Returns: Database['platform']['Tables']['workspace_contracts']['Row'];
      };
      activate_workspace_contract: {
        Args: {
          p_contract_id: string;
          p_reason?: string;
        };
        Returns: Database['platform']['Tables']['workspace_contracts']['Row'];
      };
      set_workspace_entitlement: {
        Args: {
          p_workspace_id: string;
          p_entitlement_key: string;
          p_value_type: string;
          p_numeric_value?: number | null;
          p_boolean_value?: boolean | null;
          p_text_value?: string | null;
          p_json_value?: Json | null;
          p_override_value_json?: Json | null;
          p_override_reason?: string | null;
          p_override_expires_at?: string | null;
        };
        Returns: Database['platform']['Tables']['workspace_entitlements']['Row'];
      };
      request_support_access: {
        Args: {
          p_workspace_id: string;
          p_ticket_ref: string;
          p_purpose: string;
          p_requested_scope: string;
          p_sensitivity_level: string;
          p_duration_minutes: number;
          p_evidence: Json;
        };
        Returns: Database['platform']['Tables']['support_access_requests']['Row'];
      };
      approve_support_access: {
        Args: {
          p_request_id: string;
          p_evidence: Json;
        };
        Returns: Database['platform']['Tables']['support_access_grants']['Row'];
      };
      revoke_support_access: {
        Args: {
          p_grant_id: string;
          p_reason: string;
        };
        Returns: Database['platform']['Tables']['support_access_grants']['Row'];
      };
      list_support_access: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string | null; p_status?: string | null; p_workspace_id?: string | null };
        Returns: Array<Record<string, Json> & { total_count: number }>;
      };
      list_support_workspaces: {
        Args: Record<string, never>;
        Returns: Array<{ workspace_id: string; workspace_label: string }>;
      };
      cancel_support_access_request: {
        Args: { p_request_id: string; p_reason: string };
        Returns: Database['platform']['Tables']['support_access_requests']['Row'];
      };
      enforce_entitlement_quota: {
        Args: {
          p_workspace_id: string;
          p_entitlement_key: string;
          p_requested_quantity: number;
          p_idempotency_key?: string;
          p_reason?: string;
        };
        Returns: boolean;
      };
      create_workspace_invitation: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role_id: string;
          p_scope_type?: string;
          p_expires_in?: string;
          p_reason?: string | null;
        };
        Returns: Array<{
          invitation_id: string;
          invitation_token: string;
          invitation_expires_at: string;
        }>;
      };
      validate_workspace_invitation: {
        Args: { p_token: string };
        Returns: Array<{
          invitation_id: string;
          customer_workspace_id: string;
          invitation_status: string;
          invitation_expires_at: string;
        }>;
      };
      revoke_workspace_invitation: {
        Args: { p_invitation_id: string; p_reason: string };
        Returns: Record<string, unknown>;
      };
      accept_primary_admin_invitation: {
        Args: {
          p_token: string;
          p_display_name: string;
          p_locale?: string;
          p_timezone?: string;
        };
        Returns: Array<{
          customer_workspace_id: string;
          membership_id: string;
          onboarding_required: boolean;
        }>;
      };
      list_my_claimable_workspace_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          invitation_id: string;
          workspace_label: string;
          workspace_type: string;
          workspace_environment: string;
          access_label: string;
          invitation_expires_at: string;
        }>;
      };
      claim_workspace_invitation: {
        Args: {
          p_invitation_id: string;
          p_display_name: string;
          p_locale?: string;
          p_timezone?: string;
        };
        Returns: Array<{
          claim_status: 'claimed' | 'already_claimed_by_you';
          customer_workspace_id: string;
          membership_id: string;
          onboarding_required: boolean;
        }>;
      };
      complete_primary_admin_onboarding: {
        Args: { p_workspace_id: string; p_expected_version: number; p_reason: string };
        Returns: Database['platform']['Tables']['customer_workspaces']['Row'];
      };
      get_my_primary_admin_onboarding: {
        Args: { p_workspace_id: string };
        Returns: Array<{ customer_workspace_id: string; workspace_version: number; onboarding_completed: boolean }>;
      };
    };
    Enums: {
      platform_role_type:
        | 'PLATFORM_SUPER_ADMIN'
        | 'PLATFORM_OPERATIONS'
        | 'PLATFORM_FINANCE'
        | 'PLATFORM_SUPPORT'
        | 'PLATFORM_AUDITOR';
      workspace_type: 'ASSOCIATION' | 'PROPERTY_MANAGER' | 'OWNER_PORTFOLIO' | 'HYBRID';
      workspace_lifecycle_status:
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
      workspace_environment: 'PILOT' | 'PRODUCTION';
    };
    CompositeTypes: {
      [key: string]: unknown;
    };
  };
  billing: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      get_customer_billing: {
        Args: {
          p_context_id: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_invoice_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      invoice_status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void' | 'credited';
    };
    CompositeTypes: {[key: string]: unknown};
  };
  finance: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      get_customer_allocations: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_method?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_customer_ledger: {
        Args: {
          p_context_id: string;
          p_query?: string | null;
          p_status?: string | null;
          p_account_type?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_journal_id?: string | null;
        };
        Returns: Json;
      };
      get_close_readiness: {
        Args: {
          p_context_id: string;
          p_period_id: string;
        };
        Returns: Json;
      };
      get_customer_financial_report: {
        Args: {
          p_context_id: string;
          p_report_type: string;
          p_from: string;
          p_to: string;
          p_currency: string;
        };
        Returns: Json;
      };
      close_accounting_period: {
        Args: {
          p_context_id: string;
          p_period_id: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
      journal_status: 'draft' | 'posted' | 'reversed';
      entry_side: 'debit' | 'credit';
      allocation_method: 'meter_consumption' | 'cpi' | 'per_person' | 'surface_m2' | 'direct' | 'fixed';
      run_status: 'draft' | 'calculated' | 'approved' | 'posted' | 'cancelled';
    };
    CompositeTypes: {
      [key: string]: unknown;
    };
  };
  payments: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: { Row: Record<string, unknown>; Relationships: [] };
    };
    Functions: {
      get_customer_payments: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      transaction_direction: 'credit' | 'debit';
      match_status: 'unmatched' | 'suggested' | 'confirmed' | 'rejected';
      payment_status: 'pending' | 'settled' | 'failed' | 'refunded';
    };
    CompositeTypes: { [key: string]: unknown };
  };
  utilities: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_utilities: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_service?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: {
      service_type: 'water'|'electricity'|'gas'|'heat'|'sewer'|'waste'|'internet'|'telephone'|'other';
      meter_scope: 'property'|'building'|'unit'|'common_area'|'submeter';
      reading_method: 'manual'|'photo_ocr'|'bulk_import'|'iot'|'provider';
      reading_status: 'captured'|'validated'|'rejected'|'superseded';
    };
    CompositeTypes: { [key: string]: unknown };
  };
  assets: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: { [key: string]: { Args: Record<string, unknown>; Returns: unknown } };
    Enums: { asset_scope: 'property'|'building'|'unit'|'common_area'; asset_condition: 'unknown'|'good'|'fair'|'poor'|'critical'|'retired' };
    CompositeTypes: { [key: string]: unknown };
  };
  maintenance: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_maintenance: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_priority?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
      get_customer_procurement: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_currency?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: { priority: 'low'|'normal'|'high'|'urgent'|'emergency'; work_order_status: 'draft'|'scheduled'|'assigned'|'in_progress'|'blocked'|'completed'|'verified'|'cancelled' };
    CompositeTypes: { [key: string]: unknown };
  };
  governance: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_governance: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: { meeting_status: 'draft'|'announced'|'open'|'adjourned'|'closed'|'cancelled'; vote_status: 'draft'|'open'|'closed'|'cancelled' };
    CompositeTypes: { [key: string]: unknown };
  };
  communications: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_communications: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: { channel_scope: 'tenant'|'property'|'building'|'unit'|'role'|'direct'; channel_status: 'active'|'archived'; post_status: 'draft'|'published'|'archived'|'removed' };
    CompositeTypes: { [key: string]: unknown };
  };
  occupancy: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: { Row: Record<string, unknown>; Relationships: [] };
    };
    Functions: {
      get_customer_registry: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_kind?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: { [key: string]: string };
    CompositeTypes: { [key: string]: unknown };
  };
  documents: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_documents: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_classification?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: { classification: 'public'|'internal'|'confidential'|'restricted' };
    CompositeTypes: { [key: string]: unknown };
  };
  security_access: {
    Tables: { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] } };
    Views: { [key: string]: { Row: Record<string, unknown>; Relationships: [] } };
    Functions: {
      get_customer_security_access: {
        Args: { p_context_id: string; p_view?: string; p_query?: string | null; p_status?: string | null; p_kind?: string | null; p_from?: string | null; p_to?: string | null; p_limit?: number; p_offset?: number; p_id?: string | null };
        Returns: Json;
      };
    };
    Enums: {
      access_point_type: 'entrance'|'door'|'gate';
      credential_kind: 'key'|'fob'|'access_card';
      credential_status: 'active'|'suspended'|'expired'|'revoked'|'lost'|'returned';
      visitor_access_type: 'visitor'|'contractor'|'delivery'|'vehicle';
      visitor_status: 'scheduled'|'active'|'used'|'expired'|'cancelled'|'denied';
      access_decision: 'allowed'|'denied';
    };
    CompositeTypes: { [key: string]: unknown };
  };
  audit: {
    Tables: {
      events: {
        Row: {
          id: number;
          tenant_id: string | null;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          request_id: string | null;
          before_snapshot: Json | null;
          after_snapshot: Json | null;
          reason: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          tenant_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          request_id?: string | null;
          before_snapshot?: Json | null;
          after_snapshot?: Json | null;
          reason?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: number;
          tenant_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          request_id?: string | null;
          before_snapshot?: Json | null;
          after_snapshot?: Json | null;
          reason?: string | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: unknown;
    };
  };
  customer_api: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      get_dashboard_v1: {
        Args: { p_context_id: string };
        Returns: Json;
      };
      list_contexts_v1: {
        Args: Record<PropertyKey, never>;
        Returns: {
          context_id: string;
          membership_id: string;
          tenant_id: string;
          tenant_name: string;
          role_code: string;
          role_name: string;
          scope_type: string;
          property_id: string | null;
          building_id: string | null;
          unit_id: string | null;
          context_label: string;
          starts_at: string;
          ends_at: string | null;
        }[];
      };
      my_mfa_requirement_v1: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_ledger_v1: {
        Args: {
          p_context_id: string;
          p_query?: string | null;
          p_status?: string | null;
          p_account_type?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_journal_id?: string | null;
        };
        Returns: Json;
      };
      list_accounting_periods_v1: {
        Args: { p_context_id: string };
        Returns: Json;
      };
      get_close_readiness_v1: {
        Args: { p_context_id: string; p_period_id: string };
        Returns: Json;
      };
      close_accounting_period_v1: {
        Args: {
          p_context_id: string;
          p_period_id: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      get_financial_report_v1: {
        Args: {
          p_context_id: string;
          p_report_type: string;
          p_from: string;
          p_to: string;
          p_currency: string;
        };
        Returns: Json;
      };
      get_allocations_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_method?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_audit_events_v1: {
        Args: {
          p_context_id: string;
          p_limit?: number;
          p_offset?: number;
          p_query?: string | null;
          p_action?: string | null;
          p_from?: string | null;
          p_until?: string | null;
        };
        Returns: Json;
      };
      get_billing_v1: {
        Args: {
          p_context_id: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_invoice_id?: string | null;
        };
        Returns: Json;
      };
      get_payments_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_utilities_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_service?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_maintenance_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_priority?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_procurement_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_currency?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_governance_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_communications_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_documents_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_classification?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_occupancy_registry_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_kind?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
      get_security_access_v1: {
        Args: {
          p_context_id: string;
          p_view?: string;
          p_query?: string | null;
          p_status?: string | null;
          p_kind?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: unknown;
    };
  };
};
