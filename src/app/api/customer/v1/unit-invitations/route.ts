import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const bodySchema = z.object({ context_id: z.uuid(), workspace_id: z.uuid(), unit_id: z.uuid(), party_id: z.uuid(),
  role: z.enum(['owner', 'tenant_resident', 'vendor_contact']), email: z.email().max(320),
  lang: z.enum(['ro', 'en', 'fa']).default('ro'), owner_portfolio: z.boolean().optional() }).strict();

export async function GET(request: NextRequest) {
  const context = z.uuid().safeParse(request.nextUrl.searchParams.get('context_id'));
  if (!context.success) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  if (!request.nextUrl.searchParams.has('unit_id')) {
    const paging = z.object({ query: z.string().trim().max(100).optional(),
      offset: z.coerce.number().int().min(0).default(0) }).safeParse({
        query: request.nextUrl.searchParams.get('query') ?? undefined,
        offset: request.nextUrl.searchParams.get('offset') ?? 0,
      });
    if (!paging.success) return NextResponse.json({ error: 'INVALID_PAGE' }, { status: 400, headers });
    const result = await db.schema('customer_api').rpc('list_managed_invite_units_v1' as never,
      { p_context: context.data, p_query: paging.data.query || null, p_limit: 50,
        p_offset: paging.data.offset } as never);
    if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
    return NextResponse.json(result.data, { headers });
  }
  const unit = z.uuid().safeParse(request.nextUrl.searchParams.get('unit_id'));
  const workspace = z.uuid().safeParse(request.nextUrl.searchParams.get('workspace_id'));
  if (!unit.success || !workspace.success) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400, headers });
  if (request.nextUrl.searchParams.get('pending') === '1') {
    const result = await db.schema('customer_api').rpc('list_managed_unit_invitations_v1' as never,
      { p_context: context.data, p_workspace: workspace.data, p_unit: unit.data } as never);
    if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
    return NextResponse.json(result.data, { headers });
  }
  const result = await db.schema('customer_api').rpc('list_unit_invite_parties_v1' as never,
    { p_context: context.data, p_workspace: workspace.data, p_unit: unit.data } as never);
  if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type')))
    return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const input = bodySchema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  if (input.data.owner_portfolio && input.data.role !== 'owner')
    return NextResponse.json({ error: 'OWNER_ROLE_REQUIRED' }, { status: 400, headers });
  const result = input.data.owner_portfolio
    ? await db.schema('customer_api').rpc('create_owner_portfolio_invitation_v1' as never, {
      p_context: input.data.context_id, p_workspace: input.data.workspace_id,
      p_unit: input.data.unit_id, p_party: input.data.party_id, p_email: input.data.email,
    } as never)
    : await db.schema('customer_api').rpc('create_unit_invitation_v1' as never, {
      p_context: input.data.context_id, p_workspace: input.data.workspace_id,
      p_unit: input.data.unit_id, p_party: input.data.party_id,
      p_role: input.data.role, p_email: input.data.email,
    } as never);
  if (result.error) return NextResponse.json({ error: result.error.message.includes('unit_relationship_required')
    ? 'RELATIONSHIP_REQUIRED' : 'ACCESS_DENIED' }, { status: 403, headers });
  const invite = result.data as { id: string; replayed: boolean; known_account: boolean };
  if (!invite.replayed) {
    const redirectTo = `${getApplicationOrigin()}/${input.data.lang}/auth/callback?next=/${input.data.lang}/invitation-continuation`;
    const admin = createAdminClient();
    const sent = invite.known_account
      ? await admin.auth.signInWithOtp({ email: input.data.email,
          options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
      : await admin.auth.admin.inviteUserByEmail(input.data.email, { redirectTo });
    if (sent.error) {
      await db.schema('customer_api').rpc('revoke_unit_invitation_v1' as never,
        { p_invitation: invite.id } as never);
      return NextResponse.json({ error: 'INVITATION_DELIVERY_FAILED' }, { status: 502, headers });
    }
  }
  return NextResponse.json({ id: invite.id,
    delivery: invite.replayed ? 'already_pending' : 'email_invited' }, { status: 201, headers });
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type')))
    return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 1024);
  if (errorResponse) return errorResponse;
  const input = z.object({ invitation_id: z.uuid() }).strict().safeParse(raw);
  if (!input.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = await db.schema('customer_api').rpc('revoke_unit_invitation_v1' as never,
    { p_invitation: input.data.invitation_id } as never);
  if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json({ revoked: true }, { headers });
}
