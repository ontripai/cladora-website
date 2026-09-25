import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const payload = z.object({ lead_id: z.uuid(), reason: z.string().trim().min(8).max(500), lang: z.enum(['ro','en','fa']) });

export async function POST(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_SALES']))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request))
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('open_customer_case_v1', {
    p_lead_id: parsed.data.lead_id, p_reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: { code: error.code === '42501' ? 'FORBIDDEN' : 'CASE_OPEN_FAILED' } }, { status: error.code === '42501' ? 403 : 400, headers: HEADERS });
  const result = data as { case_id: string; invitation_id: string | null; customer_email: string; verified_account_exists: boolean };
  let delivery: 'existing_account' | 'auth_invitation_sent' | 'auth_invitation_failed' = 'existing_account';
  if (result.invitation_id && !result.verified_account_exists) {
    try {
      const redirectTo = `${getApplicationOrigin()}/${parsed.data.lang}/auth/callback?next=/${parsed.data.lang}/cases`;
      const { error: inviteError } = await createAdminClient().auth.admin.inviteUserByEmail(result.customer_email, { redirectTo });
      if (inviteError) delivery = 'auth_invitation_failed';
      else delivery = 'auth_invitation_sent';
    } catch { delivery = 'auth_invitation_failed'; }
  }
  return NextResponse.json({ case_id: result.case_id,
    customer_portal_url: `/${parsed.data.lang}/cases`, delivery }, { status: 201, headers: HEADERS });
}
