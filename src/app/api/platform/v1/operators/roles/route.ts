import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const role = z.enum(['PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR','PLATFORM_SALES','PLATFORM_CONTRACTS','PLATFORM_ONBOARDING']);
const grant = z.object({ platform_user_id: z.uuid(), role, reason: z.string().trim().min(8).max(500) });
const revoke = z.object({ assignment_id: z.uuid(), reason: z.string().trim().min(8).max(500) });

async function mutate(request: Request, method: 'POST' | 'DELETE') {
  const auth = await getPlatformAuthContext();
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN'))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request))
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const payload = await request.json().catch(() => null);
  const supabase = await createClient();
  if (method === 'POST') {
    const parsed = grant.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
    const { data, error } = await supabase.schema('customer_api').rpc('grant_platform_operator_role_v1', {
      p_platform_user_id: parsed.data.platform_user_id, p_role: parsed.data.role, p_reason: parsed.data.reason,
    });
    if (error) return NextResponse.json({ error: { code: error.code === '23505' ? 'ROLE_ALREADY_ACTIVE' : 'GRANT_FAILED' } }, { status: error.code === '23505' ? 409 : 400, headers: HEADERS });
    return NextResponse.json({ assignment: data }, { status: 201, headers: HEADERS });
  }
  const parsed = revoke.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const { data, error } = await supabase.schema('customer_api').rpc('revoke_platform_operator_role_v1', {
    p_assignment_id: parsed.data.assignment_id, p_reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: { code: 'REVOKE_FAILED' } }, { status: 400, headers: HEADERS });
  return NextResponse.json({ assignment: data }, { headers: HEADERS });
}

export async function POST(request: Request) { return mutate(request, 'POST'); }
export async function DELETE(request: Request) { return mutate(request, 'DELETE'); }
