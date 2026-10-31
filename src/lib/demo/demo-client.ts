import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  DemoWorkspaceDescriptor, 
  DemoInitializeResult, 
  DemoListItemsResult, 
  DemoReportsResult 
} from './demo-types';

export async function fetchDemoWorkspace(
  supabase: SupabaseClient<any, any, any>
): Promise<DemoWorkspaceDescriptor | null> {
  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_get_my_workspace_v1');

  if (error) {
    console.error('Error fetching demo workspace:', error);
    return null;
  }
  return (data as unknown) as DemoWorkspaceDescriptor | null;
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
  const { data, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_initialize_workspace_v1', {
      p_first_name: params.firstName.trim(),
      p_last_name: params.lastName.trim(),
      p_mobile: params.mobile.trim(),
      p_workspace_name: params.workspaceName.trim(),
      p_marketing_consent: params.marketingConsent,
      p_privacy_accepted: params.privacyAccepted,
      p_locale: params.locale,
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
