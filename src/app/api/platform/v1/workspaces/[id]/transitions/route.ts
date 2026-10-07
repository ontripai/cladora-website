import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

const transitionSchema = z.object({
  target_status: z.enum([
    'LEAD',
    'UNDER_REVIEW',
    'APPROVED',
    'CONTRACT_PENDING',
    'PAYMENT_PENDING',
    'PROVISIONING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'TERMINATED',
    'ARCHIVED',
  ]),
  expected_version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await props.params;
  const authCtx = await getPlatformAuthContext();

  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication required' } },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Operations or Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasWorkspaceAssignment(authCtx, workspaceId, 'workspace')) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_ASSIGNMENT_REQUIRED', message: 'Explicit customer workspace assignment required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const parsed = transitionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_TRANSITION_PARAMETERS', message: 'A valid target status, positive version, and reason are required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const { target_status, expected_version, reason } = parsed.data;

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('transition_workspace_lifecycle_v1', {
      p_workspace_id: workspaceId,
      p_target_status: target_status,
      p_expected_version: expected_version,
      p_reason: reason,
    });

    if (error) {
      if (error.message.includes('concurrency_conflict')) {
        return NextResponse.json(
          { error: { code: 'CONCURRENCY_CONFLICT', message: 'Workspace version has changed. Please refresh and retry.' } },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }
      if (error.message.includes('illegal_transition')) {
        return NextResponse.json(
          { error: { code: 'ILLEGAL_TRANSITION', message: 'Requested lifecycle state transition is not permitted.' } },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (error.message.includes('activation_blocked')) {
        return NextResponse.json(
          { error: { code: 'ACTIVATION_BLOCKED', message: 'Production activation requires accepted primary-admin access, active membership, verified MFA, and completed onboarding.' } },
          { status: 422, headers: NO_CACHE_HEADERS }
        );
      }
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_TRANSITION', message: 'Insufficient privileges for target lifecycle transition.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { error: { code: 'TRANSITION_EXECUTION_FAILED', message: 'Failed to execute lifecycle transition.' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ workspace: data }, { status: 200, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
