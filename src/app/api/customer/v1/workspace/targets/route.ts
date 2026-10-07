import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(query.get('context_id'));
  if (!context.success || query.getAll('context_id').length !== 1
    || Array.from(query.keys()).some(key => key !== 'context_id')) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: HEADERS });
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
