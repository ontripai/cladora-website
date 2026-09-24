import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const schema = z.object({
  legal_name: z.string().trim().min(3).max(200),
  registration_number: z.string().trim().max(100).default(''),
  default_locale: z.enum(['ro','en','fa']).default('ro'),
  commercial_owner: z.string().trim().min(3).max(200),
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
  const { data, error } = await supabase.schema('customer_api').rpc('create_pilot_workspace_v1', {
    p_legal_name: parsed.data.legal_name,
    p_registration_number: parsed.data.registration_number,
    p_default_locale: parsed.data.default_locale,
    p_commercial_owner: parsed.data.commercial_owner,
  });
  if (error) return NextResponse.json({ error: { code: error.message.includes('tenant_already_exists') ? 'TENANT_ALREADY_EXISTS' : 'CREATE_FAILED' } }, { status: error.message.includes('tenant_already_exists') ? 409 : 400, headers: HEADERS });
  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
