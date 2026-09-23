export const RETENTION_OPERATION_SECTIONS = [
  'summary',
  'retention',
  'holds',
  'disposal',
  'storage',
  'kms',
] as const;

export type RetentionOperationsSection = (typeof RETENTION_OPERATION_SECTIONS)[number];

export type RetentionFeatureFlag = {
  enabled: boolean;
  lock_version: number;
  updated_at: string;
};

export type RetentionOperationsResponse = {
  generated_at: string;
  mode: 'read_only';
  section: RetentionOperationsSection;
  feature_flags: Record<string, RetentionFeatureFlag>;
  summary: {
    policy_versions: number;
    active_holds: number;
    open_protocols: number;
    storage_attention: number;
    kms_attention: number;
  };
  items: Array<Record<string, unknown>>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
};

export type RetentionWorkerDryRun = {
  generated_at: string;
  mode: 'dry_run';
  invariants: {
    database_mutated: false;
    storage_delete_api_called: false;
    kms_provider_called: false;
    claims_acquired: false;
  };
  storage: {
    feature_enabled: boolean;
    candidate_count: number;
    would_claim_count: number;
    candidates: Array<Record<string, unknown>>;
  };
  kms: {
    feature_enabled: boolean;
    candidate_count: number;
    would_dispatch_count: number;
    candidates: Array<Record<string, unknown>>;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS = /^[a-z_]{1,40}$/;

function boundedInteger(raw: string | null, fallback: number, minimum: number, maximum: number) {
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error('INVALID_INTEGER');
  return Math.min(Math.max(value, minimum), maximum);
}

export function parseRetentionOperationsQuery(url: string) {
  const params = new URL(url).searchParams;
  const rawSection = params.get('section') ?? 'summary';
  if (!RETENTION_OPERATION_SECTIONS.includes(rawSection as RetentionOperationsSection)) {
    throw new Error('INVALID_SECTION');
  }

  const tenantId = params.get('tenant_id')?.trim() || null;
  const status = params.get('status')?.trim() || null;
  if (tenantId && !UUID.test(tenantId)) throw new Error('INVALID_TENANT_ID');
  if (status && !STATUS.test(status)) throw new Error('INVALID_STATUS');

  return {
    section: rawSection as RetentionOperationsSection,
    tenantId,
    status,
    limit: boundedInteger(params.get('limit'), 20, 1, 50),
    offset: boundedInteger(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function parseDryRunQuery(url: string) {
  const params = new URL(url).searchParams;
  const tenantId = params.get('tenant_id')?.trim() || null;
  if (tenantId && !UUID.test(tenantId)) throw new Error('INVALID_TENANT_ID');
  return {
    tenantId,
    limit: boundedInteger(params.get('limit'), 25, 1, 50),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function assertSafeDryRun(value: unknown): asserts value is RetentionWorkerDryRun {
  if (!isRecord(value) || value.mode !== 'dry_run' || !isRecord(value.invariants)) {
    throw new Error('INVALID_DRY_RUN_ENVELOPE');
  }
  const invariants = value.invariants;
  if (
    invariants.database_mutated !== false ||
    invariants.storage_delete_api_called !== false ||
    invariants.kms_provider_called !== false ||
    invariants.claims_acquired !== false
  ) {
    throw new Error('DRY_RUN_SAFETY_INVARIANT_FAILED');
  }
}
