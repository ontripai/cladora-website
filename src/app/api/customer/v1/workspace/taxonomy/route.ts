import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { workspaceTaxonomyResponseSchema, uuidSchema } from '@/lib/customer/workspace-taxonomy-schema';

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

  // Call Customer API Taxonomy RPC
  const { data, error: queryError } = await (supabase.schema('customer_api') as any)
    .rpc('get_workspace_taxonomy_v1', {
      p_context_id: parsed.data.context_id,
    });

  if (queryError) {
    const isAccessDenied = queryError.code === '42501';
    return NextResponse.json(
      {
        error: {
          code: isAccessDenied ? 'CONTEXT_ACCESS_DENIED' : 'TAXONOMY_QUERY_FAILED',
        },
      },
      { status: isAccessDenied ? 403 : 500, headers: HEADERS }
    );
  }

  const validated = workspaceTaxonomyResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'SCHEMA_VALIDATION_FAILED' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(
    { data: validated.data },
    { status: 200, headers: HEADERS }
  );
}
