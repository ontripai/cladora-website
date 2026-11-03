export interface DemoNavigationItem {
  key: string;
  title?: string;
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
  email?: string;
  mobile_contact?: string;
  mobile_verified: boolean;
  marketing_consent: boolean;
  privacy_accepted?: boolean;
}

export interface DemoWorkspaceDescriptor {
  id: string;
  name: string;
  locale: 'ro' | 'en' | 'fa';
  is_demo: boolean;
  role: string;
  demo_mode: 'preview_only';
  seed_version?: number;
  created_at?: string;
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

export interface DemoMaintenanceReportItem {
  kind: string;
  status: string;
  count: number;
}

export interface DemoActivityItem {
  id: number;
  item_id?: string;
  action: string;
  created_at: string;
}

export interface DemoReportsResult {
  workspace_id: string;
  is_demo: boolean;
  generated_at: string;
  counts: Record<string, number>;
  maintenance: DemoMaintenanceReportItem[];
  finance: DemoFinanceReport;
  activity: DemoActivityItem[];
  source: string;
  native_business_data: boolean;
}
