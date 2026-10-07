import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  const parsed = z.object({ case_id: z.uuid(), body: z.string().trim().min(1).max(5000), visibility: z.enum(['shared','internal']) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('post_customer_case_message_v1', {
    p_case_id: parsed.data.case_id, p_body: parsed.data.body, p_visibility: parsed.data.visibility,
  });
  if (error) return NextResponse.json({ error: { code: error.code === '42501' ? 'FORBIDDEN' : 'MESSAGE_FAILED' } }, { status: error.code === '42501' ? 403 : 400, headers: HEADERS });
  return NextResponse.json({ message: data }, { status: 201, headers: HEADERS });
}
