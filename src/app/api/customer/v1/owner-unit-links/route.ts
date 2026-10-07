import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET(request: NextRequest) {
  const workspace = z.uuid().safeParse(request.nextUrl.searchParams.get('workspace_id'));
  if (!workspace.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = await db.schema('customer_api').rpc('list_workspace_owner_link_requests_v1' as never, { p_workspace: workspace.data } as never);
  if (error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json({ links: data }, { headers });
}
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ link_id: z.uuid(), ownership_party_id: z.uuid(), evidence: z.string().trim().min(15).max(500) }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { error } = await db.schema('customer_api').rpc('manager_verify_owner_unit_link_v1' as never, { p_link: parsed.data.link_id, p_party: parsed.data.ownership_party_id, p_evidence: parsed.data.evidence } as never);
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'ACCESS_DENIED' : 'VERIFICATION_FAILED' }, { status: error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ verified: true }, { headers });
}
