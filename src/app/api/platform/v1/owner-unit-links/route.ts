import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
async function allowed() { const auth = await getPlatformAuthContext(); return hasPlatformAal2(auth) && hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN'); }
export async function GET() {
  if (!(await allowed())) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('list_platform_owner_unit_links_v1' as never);
  if (error) return NextResponse.json({ error: 'READ_FAILED' }, { status: 400, headers });
  return NextResponse.json({ links: data }, { headers });
}
export async function POST(request: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ link_id: z.uuid(), reason: z.string().trim().min(15).max(500) }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const { error } = await db.schema('customer_api').rpc('approve_owner_unit_link_v1' as never, { p_link: parsed.data.link_id, p_reason: parsed.data.reason } as never);
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'FORBIDDEN' : 'APPROVAL_FAILED' }, { status: error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ approved: true }, { headers });
}
