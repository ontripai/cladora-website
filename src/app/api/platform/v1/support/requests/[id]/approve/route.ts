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
    if (typeof body.evidence !== 'string' || body.evidence.trim().length < 3 || body.evidence.length > 1000) return NextResponse.json({ error: { code: 'INVALID_EVIDENCE' } }, { status: 400, headers: HEADERS });
    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('approve_support_access_v1', { p_request_id: id, p_evidence: { reference: body.evidence.trim() } });
    if (error) return NextResponse.json({ error: { code: error.message.includes('dual_control') ? 'SELF_APPROVAL_FORBIDDEN' : 'SUPPORT_APPROVAL_FAILED' } }, { status: error.message.includes('access_denied') || error.message.includes('dual_control') ? 403 : 400, headers: HEADERS });
    return NextResponse.json({ grant: data }, { headers: HEADERS });
  } catch { return NextResponse.json({ error: { code: 'MALFORMED_JSON' } }, { status: 400, headers: HEADERS }); }
}
