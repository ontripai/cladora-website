import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, private' };
const requestSchema = z.object({
  email: z.string().trim().email().max(320),
  role_id: z.string().uuid(),
  lang: z.enum(['ro', 'en', 'fa']).default('ro'),
  reason: z.string().trim().min(3).max(500),
  expires_in_hours: z.number().int().min(1).max(72).default(72),
});

type InvitationRpcRow = {
  invitation_id: string;
  invitation_expires_at: string;
};

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await props.params;
  if (!z.string().uuid().safeParse(workspaceId).success) {
    return NextResponse.json(
      { error: { code: 'INVALID_WORKSPACE_ID', message: 'A valid workspace UUID is required.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication required.' } },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Operations or Super Admin role required.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasWorkspaceAssignment(authCtx, workspaceId, 'workspace')) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_ASSIGNMENT_REQUIRED', message: 'Workspace assignment required.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INVITATION_PAYLOAD', message: 'Invitation fields are invalid.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const supabase = await createClient();
  const { data: invitationRole, error: invitationRoleError } = await supabase
    .schema('customer_api')
    .from('workspace_primary_admin_roles_v1')
    .select('id')
    .eq('id', parsed.role_id)
    .maybeSingle();
  if (invitationRoleError || !invitationRole) {
    return NextResponse.json(
      { error: { code: 'INVALID_PRIMARY_ADMIN_ROLE', message: 'The selected role cannot receive a primary administrator invitation.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const { data, error } = await supabase.schema('customer_api').rpc('create_workspace_invitation_v1', {
    p_workspace_id: workspaceId,
    p_email: parsed.email,
    p_role_id: parsed.role_id,
    p_scope_type: 'tenant',
    p_expires_in: `${parsed.expires_in_hours} hours`,
    p_reason: parsed.reason,
  });

  if (error) {
    const conflict = error.message.includes('active_invitation_exists');
    const forbidden = error.message.includes('access_denied');
    return NextResponse.json(
      {
        error: {
          code: conflict ? 'ACTIVE_INVITATION_EXISTS' : forbidden ? 'FORBIDDEN_INVITATION' : 'INVITATION_CREATION_FAILED',
          message: conflict ? 'An active invitation already exists.' : forbidden ? 'Invitation access denied.' : 'Could not create invitation.',
        },
      },
      { status: conflict ? 409 : forbidden ? 403 : 500, headers: NO_CACHE_HEADERS },
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as InvitationRpcRow | null;
  if (!row?.invitation_id) {
    return NextResponse.json(
      { error: { code: 'INVITATION_CREATION_FAILED', message: 'Invitation result was incomplete.' } },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const origin = getApplicationOrigin();
    const redirectTo = `${origin}/${parsed.lang}/auth/callback`;
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.email, { redirectTo });
    if (inviteError) throw inviteError;
  } catch {
    await supabase.schema('customer_api').rpc('revoke_workspace_invitation_v1', {
      p_invitation_id: row.invitation_id,
      p_reason: 'Auth delivery failed; invitation revoked automatically',
    });
    return NextResponse.json(
      { error: { code: 'AUTH_INVITATION_DELIVERY_FAILED', message: 'Invitation email was not sent; the database invitation was revoked.' } },
      { status: 502, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      invitation: {
        id: row.invitation_id,
        email: parsed.email.toLowerCase(),
        expires_at: row.invitation_expires_at,
        delivery: 'sent',
      },
    },
    { status: 201, headers: NO_CACHE_HEADERS },
  );
}
