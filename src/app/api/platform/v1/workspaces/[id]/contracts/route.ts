import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_FINANCE'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Finance or Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasWorkspaceAssignment(authCtx, workspaceId, 'commercial')) {
    return NextResponse.json(
      { error: { code: 'COMMERCIAL_ASSIGNMENT_REQUIRED', message: 'Explicit commercial assignment for workspace required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { contract_ref, plan_id, currency, start_date, end_date, commercial_terms } = body;

    if (!contract_ref || typeof contract_ref !== 'string' || !start_date) {
      return NextResponse.json(
        { error: { code: 'INVALID_CONTRACT_PARAMETERS', message: 'contract_ref and start_date are required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (plan_id !== undefined && plan_id !== null) {
      if (typeof plan_id !== 'string' || !UUID_REGEX.test(plan_id)) {
        return NextResponse.json(
          { error: { code: 'INVALID_PLAN_ID', message: 'plan_id must be a valid UUID format' } },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    const validCurrencies = ['EUR', 'RON', 'USD'];
    const selectedCurrency = currency || 'EUR';
    if (!validCurrencies.includes(selectedCurrency)) {
      return NextResponse.json(
        { error: { code: 'INVALID_CURRENCY', message: `Currency must be one of: ${validCurrencies.join(', ')}` } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('create_workspace_contract_v1', {
      p_workspace_id: workspaceId,
      p_contract_ref: contract_ref.trim(),
      p_plan_id: plan_id || null,
      p_currency: selectedCurrency,
      p_start_date: start_date,
      p_end_date: end_date || null,
      p_commercial_terms: commercial_terms || {},
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_CONTRACT_CREATION', message: 'Insufficient commercial privileges for workspace.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      if (error.message.includes('plan_not_found')) {
        return NextResponse.json(
          { error: { code: 'PLAN_NOT_FOUND', message: 'The specified subscription plan was not found.' } },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'CONTRACT_CREATION_FAILED', message: 'Failed to create commercial contract record' } },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ contract: data }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
