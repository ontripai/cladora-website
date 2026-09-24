import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function POST(request: Request, props: { params: Promise<{ id: string; basisId: string }> }) {
  const { id, basisId } = await props.params;
  const auth = await getPlatformAuthContext();
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(basisId).success ||
      !hasPlatformAal2(auth) || !hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  }
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  }
  const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_REASON' } }, { status: 400, headers: HEADERS });
  }
  const supabase = await createClient();
  const { data: bases, error: listError } = await supabase.schema('customer_api')
    .rpc('list_workspace_access_bases_v1', { p_workspace_id: id });
  if (listError || !Array.isArray(bases) || !bases.some((basis) => basis !== null && typeof basis === 'object' && !Array.isArray(basis) && basis.id === basisId)) {
    return NextResponse.json({ error: { code: 'BASIS_NOT_FOUND' } }, { status: 404, headers: HEADERS });
  }
  const { error } = await supabase.schema('customer_api').rpc('revoke_workspace_access_basis_v1', {
    p_basis_id: basisId, p_reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: { code: 'REVOKE_FAILED' } }, { status: 422, headers: HEADERS });
  return NextResponse.json({ revoked: true }, { headers: HEADERS });
}
