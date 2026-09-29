import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import { claimedUnitContextId } from '@/lib/auth/unit-invitation-context';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET() {
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = await db.schema('customer_api').rpc('list_my_unit_invitations_v1' as never);
  if (result.error) return NextResponse.json({ error: 'INVITATIONS_UNAVAILABLE' }, { status: 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type')))
    return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 2048);
  if (errorResponse) return errorResponse;
  const input = z.object({ invitation_id: z.uuid(), display_name: z.string().trim().min(2).max(120) }).strict().safeParse(raw);
  if (!input.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = await db.schema('customer_api').rpc('claim_unit_invitation_v1' as never,
    { p_invitation: input.data.invitation_id, p_display_name: input.data.display_name } as never);
  if (result.error) return NextResponse.json({ error: 'INVITATION_UNAVAILABLE' }, { status: 403, headers });
  const claim = result.data as unknown as { membership_id: string; unit_id: string; owner_portfolio?: boolean };
  const { data: contexts, error: contextsError } = await db.schema('customer_api').rpc('list_contexts_v1');
  const contextId = !contextsError && Array.isArray(contexts)
    ? claimedUnitContextId(claim, contexts) : null;
  return NextResponse.json({ ...claim, context_id: contextId }, { headers });
}
