import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';
const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS' } }, { status: 401, headers: HEADERS });
  if (!hasPlatformAal2(auth)) return NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers: HEADERS });
  if (!hasPlatformRole(auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) return NextResponse.json({ error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    if (typeof body.reason !== 'string' || body.reason.trim().length < 8 || body.reason.length > 500) return NextResponse.json({ error: { code: 'INVALID_REASON' } }, { status: 400, headers: HEADERS });
    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('retry_provisioning_task_v1', { p_task_id: id, p_reason: body.reason.trim() });
    if (error) return NextResponse.json({ error: { code: 'PROVISIONING_RETRY_FAILED' } }, { status: error.message.includes('access_denied') ? 403 : 400, headers: HEADERS });
    return NextResponse.json({ task: data }, { headers: HEADERS });
  } catch { return NextResponse.json({ error: { code: 'MALFORMED_JSON' } }, { status: 400, headers: HEADERS }); }
}
