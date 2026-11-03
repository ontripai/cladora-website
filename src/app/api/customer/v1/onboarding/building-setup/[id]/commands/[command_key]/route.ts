import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildingSetupIdSchema, buildingSetupCommandLookupSchema, buildingSetupCommandLookupResponseSchema } from '@/lib/customer/building-setup-schema';
import { mapBuildingSetupLookupError } from '@/lib/customer/building-workspace-onboarding-api';
import { ONBOARDING_HEADERS } from '@/lib/customer/onboarding-import-helper';

type RouteContext = { params: Promise<{ id: string; command_key: string }> };
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id, command_key } = await params;
  const query = request.nextUrl.searchParams;
  const allowed = ['context_id', 'workspace_id', 'operation', 'expected_revision'];
  if (Array.from(query.keys()).some(k => !allowed.includes(k)) || allowed.some(k => query.getAll(k).length !== 1)
    || !/^[1-9][0-9]*$/.test(query.get('expected_revision') ?? '')) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: ONBOARDING_HEADERS });
  }
  const parsed = buildingSetupCommandLookupSchema.safeParse({
    context_id: query.get('context_id'), workspace_id: query.get('workspace_id'), run_id: id, command_key,
    operation: query.get('operation'), expected_revision: Number(query.get('expected_revision')),
  });
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: ONBOARDING_HEADERS });
  const client = await createClient();
  const { data: identity, error: authError } = await client.auth.getClaims();
  if (authError || !buildingSetupIdSchema.safeParse(identity?.claims?.sub).success) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: ONBOARDING_HEADERS });
  }
  const p = parsed.data;
  const { data, error } = await client.schema('customer_api').rpc('get_building_setup_command_receipt_v1' as never, {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_run_id: p.run_id,
    p_command_key: p.command_key, p_operation: p.operation, p_expected_revision: p.expected_revision,
  } as never);
  if (error) { const mapped = mapBuildingSetupLookupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const reply = buildingSetupCommandLookupResponseSchema.safeParse(data);
  if (!reply.success || reply.data.scope.actor_id !== identity?.claims?.sub || reply.data.scope.context_id !== p.context_id
    || reply.data.scope.workspace_id !== p.workspace_id || reply.data.scope.run_id !== p.run_id
    || reply.data.command.command_key !== p.command_key || reply.data.command.operation !== p.operation
    || reply.data.command.expected_revision !== p.expected_revision) {
    return NextResponse.json({ error: { code: 'SETUP_INVALID_RESPONSE' } }, { status: 502, headers: ONBOARDING_HEADERS });
  }
  return NextResponse.json(reply.data, { headers: ONBOARDING_HEADERS });
}
