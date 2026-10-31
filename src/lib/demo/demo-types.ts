export interface DemoNavigationItem {
  key: string;
  title: string;
  access: 'read_only' | 'locked';
  path?: string;
  icon?: string;
}

export interface DemoFeatures {
  form_preview: boolean;
  demo_data_write: boolean;
  workflow_continue: boolean;
  [key: string]: boolean;
}

export interface DemoProfile {
  first_name: string;
  last_name: string;
  mobile_contact?: string;
  mobile_verified: boolean;
  marketing_consent: boolean;
  privacy_accepted: boolean;
}

export interface DemoWorkspaceDescriptor {
  id: string;
  name: string;
  locale: 'ro' | 'en' | 'fa';
  is_demo: boolean;
  role: string;
  demo_mode: 'preview_only';
  navigation: DemoNavigationItem[];
  features: DemoFeatures;
  profile: DemoProfile;
}

export interface DemoInitializeResult {
  created: boolean;
  workspace: DemoWorkspaceDescriptor;
}

export interface DemoItem {
  id: string;
  workspace_id: string;
  parent_id?: string | null;
  module: string;
  kind: string;
  title: string;
  status: string;
  data: Record<string, any>;
  version: number;
  seed_key?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DemoListItemsResult {
  workspace_id: string;
  is_demo: boolean;
  items: DemoItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DemoFinanceMonth {
  period?: string;
  month?: string;
  invoiced: number;
  paid: number;
  outstanding?: number;
}

export interface DemoFinanceReport {
  currency: string;
  read_only: boolean;
  sample_data: boolean;
  invoice_count: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  monthly: DemoFinanceMonth[];
}

export interface DemoReportsResult {
  workspace_id: string;
  is_demo: boolean;
  generated_at: string;
  counts: Record<string, number>;
  maintenance: any;
  finance: DemoFinanceReport;
  activity: any[];
  source: string;
  native_business_data: boolean;
}
