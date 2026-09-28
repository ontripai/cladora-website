import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const schema = z.object({ context_id: z.uuid(), workspace_id: z.uuid(), unit_id: z.uuid(),
  role: z.enum(['owner', 'tenant_resident']), name: z.string().trim().min(2).max(120),
  evidence: z.string().trim().min(15).max(500) }).strict();

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: 'BAD_ORIGIN' }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type')))
    return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const input = schema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = await db.schema('customer_api').rpc('register_unit_invite_relationship_v1' as never, {
    p_context: input.data.context_id, p_workspace: input.data.workspace_id,
    p_unit: input.data.unit_id, p_role: input.data.role,
    p_name: input.data.name, p_evidence: input.data.evidence,
  } as never);
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'RELATIONSHIP_REVIEW_REQUIRED' : 'ACCESS_DENIED' },
    { status: error.code === '23505' ? 409 : 403, headers });
  return NextResponse.json(data, { status: 201, headers });
}
