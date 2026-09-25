import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
async function allowed() {
  const auth = await getPlatformAuthContext();
  return hasPlatformAal2(auth) && hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN');
}

export async function GET(request: Request) {
  if (!(await allowed())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  const parsed = z.uuid().safeParse(new URL(request.url).searchParams.get('case_id'));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('owner_portfolio_pilot_status_v1' as never, { p_case_id: parsed.data } as never);
  if (error) return NextResponse.json({ error: { code: 'STATUS_FAILED' } }, { status: 400, headers });
  return NextResponse.json(data, { headers });
}

export async function POST(request: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'BAD_ORIGIN' } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('activate'), case_id: z.uuid(), hours: z.union([z.literal(24), z.literal(48), z.literal(72)]), reason: z.string().trim().min(15).max(500) }).strict(),
    z.object({ action: z.literal('revoke'), case_id: z.uuid(), reason: z.string().trim().min(8).max(500) }).strict(),
  ]).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  const db = await createClient();
  const { data, error } = parsed.data.action === 'activate'
    ? await db.schema('customer_api').rpc('activate_owner_portfolio_pilot_v1' as never, { p_case_id: parsed.data.case_id, p_hours: parsed.data.hours, p_reason: parsed.data.reason } as never)
    : await db.schema('customer_api').rpc('revoke_owner_portfolio_pilot_v1' as never, { p_case_id: parsed.data.case_id, p_reason: parsed.data.reason } as never);
  if (error) return NextResponse.json({ error: { code: error.code === '42501' ? 'FORBIDDEN' : error.code === '23505' ? 'PILOT_ALREADY_DECIDED' : 'PILOT_ACTION_FAILED' } }, { status: error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400, headers });
  return NextResponse.json({ result: data }, { status: parsed.data.action === 'activate' ? 201 : 200, headers });
}
