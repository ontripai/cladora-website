import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema, idempotencyKeySchema } from '@/lib/customer/workspace-composition-schema';
const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const labels = z.strictObject({ ro: z.string().trim().min(1).max(200), en: z.string().trim().min(1).max(200), fa: z.string().trim().min(1).max(200) });
const schema = z.strictObject({ context_id: uuidSchema, workspace_id: uuidSchema, code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), labels, idempotency_key: idempotencyKeySchema });
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers });
const rpcFail = (code: string) => code === '42501' ? fail('SERVICE_ACCESS_DENIED', 403)
  : code === '23505' ? fail('SERVICE_CONFLICT', 409)
  : ['22023', '22P02'].includes(code) ? fail('INVALID_REQUEST', 400) : fail('SERVICE_QUERY_FAILED', 500);
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(query.get('context_id'));
  const workspace = uuidSchema.safeParse(query.get('workspace_id'));
  if (!context.success || !workspace.success || query.getAll('context_id').length !== 1 || query.getAll('workspace_id').length !== 1
    || Array.from(query.keys()).some(key => !['context_id', 'workspace_id'].includes(key))) return fail('INVALID_REQUEST', 400);
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await client.schema('customer_api').rpc('list_service_definitions_v1' as never, { p_context_id: context.data, p_workspace_id: workspace.data } as never);
  if (error) return rpcFail(error.code);
  return NextResponse.json({ definitions: data ?? [] }, { headers });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return fail('INVALID_ORIGIN', 403);
  if (request.nextUrl.search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('INVALID_REQUEST', 400);
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) return fail('UNAUTHORIZED', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_REQUEST', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const { data, error } = await client.schema('customer_api').rpc('create_service_definition_v1' as never, { p_request: parsed.data } as never);
  if (error) return rpcFail(error.code);
  if (!data) return fail('SERVICE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers });
}
