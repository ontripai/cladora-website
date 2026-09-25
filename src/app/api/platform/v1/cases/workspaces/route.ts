import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const permitted = async () => {
  const auth = await getPlatformAuthContext();
  return hasPlatformAal2(auth) && hasPlatformRole(auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']);
};

export async function GET(request: Request) {
  if (!(await permitted())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  const parsed = z.uuid().safeParse(new URL(request.url).searchParams.get('case_id'));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('list_case_workspace_options_v1', { p_case_id: parsed.data });
  if (error) return NextResponse.json({ error: { code: 'CASE_UNAVAILABLE' } }, { status: 403, headers: HEADERS });
  return NextResponse.json({ options: data }, { headers: HEADERS });
}

export async function POST(request: Request) {
  if (!(await permitted())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const parsed = z.object({
    case_id: z.uuid(), workspace_type: z.enum(['ASSOCIATION', 'PROPERTY_MANAGER', 'OWNER_PORTFOLIO', 'HYBRID']),
    profile_code: z.string().regex(/^[a-z0-9_]{3,64}$/), model_code: z.string().regex(/^[a-z0-9_]{3,64}$/),
    commercial_owner: z.string().trim().min(3).max(200), reason: z.string().trim().min(8).max(500),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('create_case_workspace_v1', {
    p_case_id: parsed.data.case_id, p_workspace_type: parsed.data.workspace_type,
    p_profile_code: parsed.data.profile_code, p_model_code: parsed.data.model_code,
    p_commercial_owner: parsed.data.commercial_owner, p_reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: { code: 'CREATION_NOT_ALLOWED' } }, { status: 400, headers: HEADERS });
  return NextResponse.json({ workspace: data }, { status: 201, headers: HEADERS });
}
