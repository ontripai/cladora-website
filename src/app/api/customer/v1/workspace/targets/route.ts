import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { coreServiceAppReadV1 } from '@/lib/core/service-app-read-v1';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(query.get('context_id'));
  if (!context.success || query.getAll('context_id').length !== 1
    || Array.from(query.keys()).some(key => key !== 'context_id')) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: HEADERS });
  }

  // In approved Core assembly profile, consume workspace targets from Core's official bootstrap selections
  if (process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1') {
    const bootstrapRequest = new NextRequest(new URL('/api/customer/v1/services/assembly-bootstrap', request.url), {
      headers: request.headers,
    });
    const bootstrapRes = await coreServiceAppReadV1(bootstrapRequest, 'selections');
    if (!bootstrapRes) {
      return NextResponse.json({ error: { code: 'CORE_SERVICE_ASSEMBLY_NOT_READY' } }, { status: 503, headers: HEADERS });
    }
    // Genuine Core 401 or 403 or 503 from session lease is preserved
    if (!bootstrapRes.ok) {
      return bootstrapRes;
    }
    const data = (await bootstrapRes.json()) as {
      selections?: Array<{
        context_id: string;
        workspace_id: string;
        workspace_type: string;
        environment: string;
      }>;
    };
    const selections = data?.selections ?? [];
    const authorizedContexts = new Set(selections.map(s => s.context_id));
    if (!authorizedContexts.has(context.data)) {
      // Authenticated session, but this context_id is not in user's authorized selections:
      // Return 403 WORKSPACE_ACCESS_DENIED (absence of selection is not unauthenticated 401)
      return NextResponse.json(
        { error: { code: 'WORKSPACE_ACCESS_DENIED' } },
        { status: 403, headers: HEADERS }
      );
    }
    const matching = selections.filter(s => s.context_id === context.data);
    const seen = new Set<string>();
    const workspaces = [];
    for (const s of matching) {
      if (s.workspace_id && !seen.has(s.workspace_id)) {
        seen.add(s.workspace_id);
        workspaces.push({
          workspace_id: s.workspace_id,
          workspace_type: s.workspace_type,
          environment: s.environment,
        });
      }
    }
    return NextResponse.json({ workspaces }, { headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS });
  }
  // The gateway checks current Context ownership and canonical scoped assignments.
  // New RPC typing is generated after applying the reviewed migration.
  const { data, error } = await supabase.schema('customer_api').rpc(
    'list_workspace_targets_v2' as never, { p_context_id: context.data } as never,
  );
  if (error) {
    const forbidden = error.code === '42501';
    return NextResponse.json({ error: { code: forbidden ? 'WORKSPACE_ACCESS_DENIED' : 'WORKSPACE_TARGET_QUERY_FAILED' } },
      { status: forbidden ? 403 : 500, headers: HEADERS });
  }
  return NextResponse.json({ workspaces: data ?? [] }, { headers: HEADERS });
}
