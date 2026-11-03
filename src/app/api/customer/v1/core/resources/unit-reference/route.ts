import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canonicalResourceReferenceV1Schema } from '@/lib/core/resource-contracts-v1';
import { uuidSchema } from '@/lib/customer/occupancy-schema';
import { createClient } from '@/lib/supabase/server';

const HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const querySchema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  unit_id: uuidSchema,
  resource_version: z.coerce.number().int().positive(),
});

function failure(error: { code?: string }) {
  if (error.code === '42501') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN' } },
      { status: 403, headers: HEADERS },
    );
  }
  if (error.code === '22023') {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST' } },
      { status: 400, headers: HEADERS },
    );
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR' } },
    { status: 500, headers: HEADERS },
  );
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAMETERS' } },
      { status: 400, headers: HEADERS },
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS },
    );
  }

  const { context_id, workspace_id, unit_id, resource_version } = parsed.data;
  const { data, error } = await (supabase.schema('customer_api') as any).rpc(
    'resolve_canonical_resource_reference_v1',
    {
      p_context_id: context_id,
      p_workspace_id: workspace_id,
      p_resource_type: 'unit',
      p_resource_id: unit_id,
      p_resource_version: resource_version,
      p_permission_code: 'core.units.identity.read',
      p_purpose: 'core.unit_identity.history',
    },
  );

  if (error) return failure(error);

  const response = canonicalResourceReferenceV1Schema.safeParse(data);
  if (!response.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_UPSTREAM_RESPONSE' } },
      { status: 502, headers: HEADERS },
    );
  }

  return NextResponse.json(response.data, { headers: HEADERS });
}
