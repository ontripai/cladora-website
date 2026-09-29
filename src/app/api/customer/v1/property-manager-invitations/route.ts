import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
// PostgreSQL accepts any canonical 128-bit UUID. Some deterministic test contexts
// use non-RFC version/variant bits, so z.uuid() is too restrictive here.
const postgresUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function GET(request: NextRequest) {
  const parsed = z.object({ context_id: postgresUuid, property_id: z.uuid().optional() }).safeParse({
    context_id: request.nextUrl.searchParams.get('context_id'),
    property_id: request.nextUrl.searchParams.get('property_id') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = parsed.data.property_id
    ? await db.schema('customer_api').rpc('list_managed_property_manager_invitations_v1' as never,
      { p_context: parsed.data.context_id, p_property: parsed.data.property_id } as never)
    : await db.schema('customer_api').rpc('list_invitable_manager_properties_v1' as never,
      { p_context: parsed.data.context_id } as never);
  if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 2048);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ context_id: postgresUuid, property_id: z.uuid(), email: z.email().max(320), lang: z.enum(['ro', 'en', 'fa']).default('ro') }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const created = await db.schema('customer_api').rpc('create_property_manager_invitation_v1' as never, {
    p_context: parsed.data.context_id, p_property: parsed.data.property_id, p_email: parsed.data.email,
  } as never);
  if (created.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  const invitation = created.data as unknown as { id: string; replayed: boolean; known_account: boolean };
  if (!invitation.replayed) {
    try {
      const redirectTo = `${getApplicationOrigin()}/${parsed.data.lang}/auth/callback?next=/${parsed.data.lang}/invitation-continuation`;
      const admin = createAdminClient();
      const delivered = invitation.known_account
        ? await admin.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
        : await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
      if (delivered.error) throw delivered.error;
    } catch {
      await db.schema('customer_api').rpc('revoke_property_manager_invitation_v1' as never, {
        p_context: parsed.data.context_id, p_invitation: invitation.id,
      } as never);
      return NextResponse.json({ error: 'INVITATION_DELIVERY_FAILED' }, { status: 502, headers });
    }
  }
  return NextResponse.json({ id: invitation.id, delivery: invitation.replayed ? 'already_pending' : 'email_invited' }, { status: 201, headers });
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 1024);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ context_id: postgresUuid, invitation_id: z.uuid() }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const claims = await db.auth.getClaims();
  if (!claims.data?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const result = await db.schema('customer_api').rpc('revoke_property_manager_invitation_v1' as never, {
    p_context: parsed.data.context_id, p_invitation: parsed.data.invitation_id,
  } as never);
  if (result.error) return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  return NextResponse.json({ revoked: true }, { headers });
}
