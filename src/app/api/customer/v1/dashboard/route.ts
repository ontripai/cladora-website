import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { dashboardRpcResponseSchema, uuidSchema } from '@/lib/customer/dashboard-schema';
import { coreServiceAppReadV1 } from '@/lib/core/service-app-read-v1';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const querySchema = z.object({
  context_id: uuidSchema,
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    context_id: request.nextUrl.searchParams.get('context_id'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_CONTEXT' } },
      { status: 400, headers: HEADERS }
    );
  }

  // In approved Service assembly profile, legacy dashboard is not the authority reference.
  // Validate real session and context permission from Core bootstrap, without creating a fake dashboard.
  if (process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1') {
    const bootstrapRequest = new NextRequest(new URL('/api/customer/v1/services/assembly-bootstrap', request.url), {
      headers: request.headers,
    });
    const bootstrapRes = await coreServiceAppReadV1(bootstrapRequest, 'selections');
    if (!bootstrapRes) {
      return NextResponse.json({ error: { code: 'CORE_SERVICE_ASSEMBLY_NOT_READY' } }, { status: 503, headers: HEADERS });
    }
    if (!bootstrapRes.ok) {
      return bootstrapRes;
    }
    const data = (await bootstrapRes.json()) as { selections?: Array<{ context_id: string }> };
    const selections = data?.selections ?? [];
    const isAuthorized = selections.some(s => s.context_id === parsed.data.context_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: { code: 'CONTEXT_ACCESS_DENIED' } }, { status: 403, headers: HEADERS });
    }
    // Authorized context in Service assembly profile: Core17 does not produce a legacy dashboard.
    // Return 404 cleanly without creating a fake dashboard or claiming false 403 access denial.
    return NextResponse.json({ error: { code: 'DASHBOARD_NOT_IN_ASSEMBLY_PROFILE' } }, { status: 404, headers: HEADERS });
  }

  // Authoritative user client (strictly NO service role)
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS }
    );
  }

  // Call Customer API Gateway dashboard RPC (delegates to platform.get_customer_dashboard)
  const { data, error: queryError } = await supabase
    .schema('customer_api')
    .rpc('get_dashboard_v1', {
      p_context_id: parsed.data.context_id,
    });

  if (queryError) {
    const isAccessDenied = queryError.code === '42501';
    return NextResponse.json(
      {
        error: {
          code: isAccessDenied ? 'CONTEXT_ACCESS_DENIED' : 'DASHBOARD_QUERY_FAILED',
        },
      },
      { status: isAccessDenied ? 403 : 500, headers: HEADERS }
    );
  }

  // Authoritative response schema validation & Persona match verification
  const validated = dashboardRpcResponseSchema.safeParse(data);
  const requestedContextId = parsed.data.context_id.toLowerCase().trim();

  if (
    !validated.success ||
    validated.data.contextId.toLowerCase().trim() !== requestedContextId ||
    validated.data.context.id.toLowerCase().trim() !== requestedContextId ||
    validated.data.persona !== validated.data.context.role_code
  ) {
    return NextResponse.json(
      { error: { code: 'INVALID_DASHBOARD_PAYLOAD' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(validated.data, { headers: HEADERS });
}
