import { SupabaseClient } from '@supabase/supabase-js';
import type {
  DemoWorkspaceDescriptor,
  DemoInitializeResult,
  DemoListItemsResult,
  DemoReportsResult
} from './demo-types';

export function validateDemoPhone(phone: string): { valid: boolean; normalized: string } {
  if (!phone || typeof phone !== 'string') return { valid: false, normalized: '' };
  const trimmed = phone.trim();
  if (!/^\+?[0-9 ()-]+$/.test(trimmed)) return { valid: false, normalized: '' };
  const prefix = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  const normalized = prefix + digits;
  if (!/^\+?[0-9]{8,15}$/.test(normalized)) {
    return { valid: false, normalized: '' };
  }
  return { valid: true, normalized };
}

export function validateDemoPersonName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 80 && !/[\x00-\x1F\x7F]/.test(trimmed);
}

export function validateDemoWorkspaceName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 120 && !/[\x00-\x1F\x7F]/.test(trimmed);
}

export async function fetchDemoWorkspace(
  supabase: SupabaseClient<any, any, any>
): Promise<{ workspace: DemoWorkspaceDescriptor | null; error: Error | null }> {
  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_get_my_workspace_v1');

  if (error) {
    console.error('Error fetching demo workspace:', error);
    return {
      workspace: null,
      error: new Error(error.message || 'Failed to fetch demo workspace')
    };
  }
  return {
    workspace: ((data as unknown) as DemoWorkspaceDescriptor | null),
    error: null
  };
}

export async function initializeDemoWorkspace(
  supabase: SupabaseClient<any, any, any>,
  params: {
    firstName: string;
    lastName: string;
    mobile: string;
    workspaceName: string;
    marketingConsent: boolean;
    privacyAccepted: boolean;
    locale: string;
  }
): Promise<DemoInitializeResult> {
  if (!params.privacyAccepted) {
    throw new Error('Privacy Policy acceptance is mandatory.');
  }

  if (!validateDemoPersonName(params.firstName)) {
    throw new Error('First name must be between 1 and 80 characters.');
  }

  if (!validateDemoPersonName(params.lastName)) {
    throw new Error('Last name must be between 1 and 80 characters.');
  }

  if (!validateDemoWorkspaceName(params.workspaceName)) {
    throw new Error('Workspace name must be between 2 and 120 characters.');
  }

  const phoneCheck = validateDemoPhone(params.mobile);
  if (!phoneCheck.valid) {
    throw new Error('Please enter a valid phone number (8 to 15 digits).');
  }

  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_initialize_workspace_v1', {
      p_first_name: params.firstName.trim(),
      p_last_name: params.lastName.trim(),
      p_mobile: phoneCheck.normalized,
      p_workspace_name: params.workspaceName.trim(),
      p_marketing_consent: Boolean(params.marketingConsent),
      p_privacy_accepted: true,
      p_locale: ['fa', 'en', 'ro'].includes(params.locale) ? params.locale : 'ro',
    });

  if (error) {
    throw new Error(error.message || 'Failed to initialize demo workspace');
  }

  return (data as unknown) as DemoInitializeResult;
}

export async function fetchDemoItems(
  supabase: SupabaseClient<any, any, any>,
  workspaceId: string,
  options?: {
    module?: string | null;
    limit?: number;
    offset?: number;
  }
): Promise<DemoListItemsResult> {
  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_list_items_v1', {
      p_workspace_id: workspaceId,
      p_module: options?.module || null,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    });

  if (error) {
    throw new Error(error.message || 'Failed to fetch demo items');
  }

  return (data as unknown) as DemoListItemsResult;
}

export async function fetchDemoReports(
  supabase: SupabaseClient<any, any, any>,
  workspaceId: string
): Promise<DemoReportsResult> {
  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_get_reports_v1', {
      p_workspace_id: workspaceId,
    });

  if (error) {
    throw new Error(error.message || 'Failed to fetch demo reports');
  }

  return (data as unknown) as DemoReportsResult;
}
