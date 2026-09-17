import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  workspaceCompositionResponseSchema,
  uuidSchema,
} from '@/lib/customer/workspace-composition-schema';

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
      { error: { code: 'INVALID_CONTEXT', message: 'Valid context_id UUID is required' } },
      { status: 400, headers: HEADERS }
    );
  }

  // Authoritative user client (strictly NO service role)
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, headers: HEADERS }
    );
  }

  // Call Customer API Dynamic Composition RPC
  const { data, error: queryError } = await (supabase.schema('customer_api') as any)
    .rpc('get_workspace_composition_v1', {
      p_context_id: parsed.data.context_id,
    });

  if (queryError) {
    if (queryError.message?.includes('workspace_composition_context_not_workspace_bound')) {
      return NextResponse.json(
        {
          error: {
            code: 'CONTEXT_NOT_BOUND',
            message: 'Active context is not bound to a customer workspace.',
          },
        },
        { status: 409, headers: HEADERS }
      );
    }

    if (queryError.message?.includes('workspace_composition_workspace_binding_ambiguous')) {
      return NextResponse.json(
        {
          error: {
            code: 'BINDING_AMBIGUOUS',
            message: 'Target property is bound to multiple active workspaces.',
          },
        },
        { status: 409, headers: HEADERS }
      );
    }

    const isAccessDenied = queryError.code === '42501';
    return NextResponse.json(
      {
        error: {
          code: isAccessDenied ? 'CONTEXT_ACCESS_DENIED' : 'COMPOSITION_QUERY_FAILED',
          message: queryError.message || 'Failed to query workspace composition',
        },
      },
      { status: isAccessDenied ? 403 : 500, headers: HEADERS }
    );
  }

  const validated = workspaceCompositionResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'SCHEMA_VALIDATION_FAILED', message: 'Invalid response schema from database' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(
    { data: validated.data },
    { status: 200, headers: HEADERS }
  );
}
