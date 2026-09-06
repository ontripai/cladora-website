import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { dashboardRpcResponseSchema, uuidSchema } from '@/lib/customer/dashboard-schema';

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

  // Authoritative user client (strictly NO service role)
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS }
    );
  }

  // Call authoritative role-aware dashboard RPC
  const { data, error: queryError } = await supabase
    .schema('platform')
    .rpc('get_customer_dashboard', {
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
