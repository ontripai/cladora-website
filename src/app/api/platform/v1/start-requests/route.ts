import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('assign'), lead_id: z.uuid(), assignee_id: z.uuid().nullable(), reason: z.string().trim().min(8).max(500) }),
  z.object({ action: z.literal('status'), lead_id: z.uuid(), status: z.enum(['contacted','qualified','rejected','spam']), reason: z.string().trim().min(8).max(500) }),
]);

export async function PATCH(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_SALES']))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (!hasTrustedMutationOrigin(request))
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers });
  const db = await createClient();
  const { data, error } = parsed.data.action === 'assign'
    ? await db.schema('customer_api').rpc('assign_start_request_v1', {
      p_lead_id: parsed.data.lead_id, p_assignee_id: parsed.data.assignee_id, p_reason: parsed.data.reason,
    })
    : await db.schema('customer_api').rpc('update_start_request_v1', {
      p_lead_id: parsed.data.lead_id, p_status: parsed.data.status, p_reason: parsed.data.reason,
    });
  if (error) return NextResponse.json({ error: { code: error.code === '42501' ? 'FORBIDDEN' : 'UPDATE_FAILED' } }, { status: error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ request: data }, { headers });
}
