import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET() {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = await db.schema('customer_api').rpc('list_my_owner_unit_links_v1' as never);
  if (error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json({ links: data }, { headers });
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), private_unit_id: z.uuid(), workspace_id: z.uuid(), canonical_unit_id: z.uuid(), evidence: z.string().trim().min(15).max(500) }).strict(),
  z.object({ action: z.literal('withdraw'), link_id: z.uuid() }).strict(),
]);
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = parsed.data.action === 'request'
    ? await db.schema('customer_api').rpc('request_owner_unit_link_v1' as never, { p_private_unit: parsed.data.private_unit_id, p_workspace: parsed.data.workspace_id, p_canonical_unit: parsed.data.canonical_unit_id, p_evidence: parsed.data.evidence } as never)
    : await db.schema('customer_api').rpc('withdraw_owner_unit_link_v1' as never, { p_link: parsed.data.link_id } as never);
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'LINK_EXISTS' : error.code === '42501' ? 'ACCESS_DENIED' : 'LINK_ACTION_FAILED' }, { status: error.code === '23505' ? 409 : error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ result: data }, { status: parsed.data.action === 'request' ? 201 : 200, headers });
}
