import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-roles-schema';

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(params.get('context_id'));
  if (!context.success || params.getAll('context_id').length !== 1 || Array.from(params.keys()).some(key => key !== 'context_id')) {
    return NextResponse.json({ error: { code: 'INVALID_QUERY', message: 'Valid context_id required' } }, { status: 400, headers });
  }
  const client = await createClient();
  const { data: claims, error: authError } = await client.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401, headers });
  }
  const { data, error } = await (client.schema('customer_api') as any).rpc('list_workspace_role_assignment_candidates_v2', { p_context_id: context.data });
  if (error) {
    const mfa = error.message?.includes('mfa_required');
    const denied = error.code === '42501';
    return NextResponse.json({ error: { code: mfa ? 'MFA_REQUIRED' : denied ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: mfa ? 'AAL2 verification required' : denied ? 'Assignment access denied' : 'Could not load members' } }, { status: denied ? 403 : 500, headers });
  }
  return NextResponse.json(data, { headers });
}
