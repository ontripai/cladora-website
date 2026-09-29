import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 2048);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ invitation_id: z.uuid(), display_name: z.string().trim().min(2).max(120) }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = await db.schema('customer_api').rpc('claim_property_manager_invitation_v1' as never, {
    p_invitation: parsed.data.invitation_id, p_display_name: parsed.data.display_name,
  } as never);
  if (result.error) return NextResponse.json({ error: 'INVITATION_UNAVAILABLE' }, { status: 403, headers });
  const claim = result.data as unknown as { membership_id: string; property_id: string; context_id?: string };
  const { data: contexts, error } = await db.schema('customer_api').rpc('list_contexts_v1');
  const context = !error && Array.isArray(contexts)
    ? (contexts as Array<Record<string, unknown>>).find(item => item.scope_type === 'property'
      && item.context_id === claim.context_id)
    : undefined;
  return NextResponse.json({ membership_id: claim.membership_id, property_id: claim.property_id,
    context_id: typeof context?.context_id === 'string' ? context.context_id : claim.context_id ?? null }, { headers });
}
