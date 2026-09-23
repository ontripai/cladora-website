import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const READ_ROLES = [
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_OPERATIONS',
  'PLATFORM_FINANCE',
  'PLATFORM_AUDITOR',
] as const;
const ACTOR_ROLES = [...READ_ROLES, 'PLATFORM_SUPPORT'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[A-Z0-9_]{1,100}$/;
const ENTITY = /^[a-z0-9_]{1,100}$/;

type AuditRpcRow = {
  id: number;
  workspace_id: string | null;
  actor_id: string | null;
  actor_display_name: string;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  reason: string | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  occurred_at: string;
  total_count: number;
};

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function GET(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return failure('UNAUTHORIZED_PLATFORM_ACCESS', 401);
  if (!hasPlatformAal2(auth)) return failure('MFA_REQUIRED', 403);
  if (!hasPlatformRole(auth, [...READ_ROLES])) return failure('INSUFFICIENT_ROLE_PRIVILEGES', 403);

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const query = (params.get('q') ?? '').trim().slice(0, 100);
  const action = params.get('action')?.trim() || null;
  const actorRole = params.get('actor_role')?.trim() || null;
  const entityType = params.get('entity_type')?.trim() || null;
  const workspaceId = params.get('workspace_id')?.trim() || null;
  const occurredFrom = parseDate(params.get('from'));
  const occurredUntil = parseDate(params.get('until'));

  if (
    (action && !IDENTIFIER.test(action)) ||
    (actorRole && !ACTOR_ROLES.includes(actorRole as (typeof ACTOR_ROLES)[number])) ||
    (entityType && !ENTITY.test(entityType)) ||
    (workspaceId && !UUID.test(workspaceId)) ||
    occurredFrom === undefined ||
    occurredUntil === undefined ||
    (occurredFrom && occurredUntil && occurredFrom >= occurredUntil)
  ) return failure('INVALID_AUDIT_FILTERS', 400);

  const supabase = await createClient();
  const { data, error } = await supabase.schema('customer_api').rpc('list_control_plane_audit_events_v1', {
    p_limit: limit,
    p_offset: offset,
    p_query: query || null,
    p_action: action,
    p_actor_role: actorRole,
    p_entity_type: entityType,
    p_workspace_id: workspaceId,
    p_occurred_from: occurredFrom,
    p_occurred_until: occurredUntil,
  });

  if (error) return failure('AUDIT_QUERY_FAILED', 500);
  const events = (data ?? []) as unknown as AuditRpcRow[];
  const total = Number(events[0]?.total_count ?? 0);
  return NextResponse.json({
    events: events.map(({ total_count: _totalCount, ...event }) => event),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  }, { headers: HEADERS });
}
