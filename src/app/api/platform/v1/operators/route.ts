import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const role = z.enum(['PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR']);
const schema = z.object({
  email: z.email().max(320), employee_ref: z.string().trim().min(3).max(80),
  display_name: z.string().trim().min(3).max(150), role,
  reason: z.string().trim().min(8).max(500),
});

export async function POST(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN'))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request))
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema('customer_api').rpc('create_platform_operator_v1', {
    p_email: parsed.data.email, p_employee_ref: parsed.data.employee_ref,
    p_display_name: parsed.data.display_name, p_role: parsed.data.role, p_reason: parsed.data.reason,
  });
  if (error) {
    const code = error.message.includes('verified_auth_user_required') ? 'VERIFIED_ACCOUNT_REQUIRED'
      : error.code === '23505' ? 'OPERATOR_ALREADY_EXISTS' : 'CREATE_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'VERIFIED_ACCOUNT_REQUIRED' ? 404 : code === 'OPERATOR_ALREADY_EXISTS' ? 409 : 400, headers: HEADERS });
  }
  return NextResponse.json({ operator: data }, { status: 201, headers: HEADERS });
}
