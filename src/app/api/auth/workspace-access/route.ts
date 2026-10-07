import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET() {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS });
  const { data, error } = await supabase.schema('customer_api').rpc('list_my_prepared_workspace_access_v1');
  if (error) return NextResponse.json({ error: { code: 'VERIFIED_MFA_REQUIRED' } }, { status: 403, headers: HEADERS });
  return NextResponse.json({ bases: data ?? [] }, { headers: HEADERS });
}
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const parsed = z.object({
    basis_id: z.string().uuid(),
    display_name: z.string().trim().min(2).max(120),
    locale: z.enum(['ro', 'en', 'fa']),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS });
  const { data, error } = await supabase.schema('customer_api').rpc('activate_prepared_workspace_access_v1', {
    p_basis_id: parsed.data.basis_id, p_display_name: parsed.data.display_name, p_locale: parsed.data.locale,
  });
  if (error) return NextResponse.json({ error: { code: 'ACCESS_ACTIVATION_REJECTED' } }, { status: 422, headers: HEADERS });
  return NextResponse.json({ access: data }, { headers: HEADERS });
}
