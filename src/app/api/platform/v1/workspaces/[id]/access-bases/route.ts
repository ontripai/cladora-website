import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const paramsSchema = z.string().uuid();
const payloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('PILOT'),
    email: z.string().trim().email().max(320),
    role_id: z.string().uuid(),
    duration_hours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
    evidence_note: z.string().trim().min(15).max(500),
  }),
  z.object({
    mode: z.literal('PAID'),
    email: z.string().trim().email().max(320),
    role_id: z.string().uuid(),
    contract_id: z.string().uuid(),
    payment_reference: z.string().trim().min(3).max(120),
    payment_amount: z.number().positive(),
    payment_currency: z.enum(['RON', 'EUR', 'USD']),
    paid_on: z.iso.date(),
    paid_through: z.iso.date(),
    evidence_note: z.string().trim().min(15).max(500),
  }),
]);

async function authorize(workspaceId: string) {
  const auth = await getPlatformAuthContext();
  return paramsSchema.safeParse(workspaceId).success &&
    hasPlatformAal2(auth) && hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN');
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!(await authorize(id))) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  }
  const supabase = await createClient();
  const [bases, contracts] = await Promise.all([
    supabase.schema('customer_api').rpc('list_workspace_access_bases_v1', { p_workspace_id: id }),
    supabase.schema('customer_api').from('workspace_contracts_v1')
      .select('id,contract_ref,status,currency,start_date,end_date,signed_at')
      .eq('customer_workspace_id', id).eq('status', 'active'),
  ]);
  if (bases.error || contracts.error) {
    return NextResponse.json({ error: { code: 'ACCESS_BASES_UNAVAILABLE' } }, { status: 500, headers: HEADERS });
  }
  return NextResponse.json({ bases: bases.data ?? [], contracts: contracts.data ?? [] }, { headers: HEADERS });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!(await authorize(id))) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  }
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  }
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_ACCESS_BASIS' } }, { status: 400, headers: HEADERS });
  }
  const input = parsed.data;
  const paid = input.mode === 'PAID' ? input : null;
  const supabase = await createClient();
  const { data, error } = await supabase.schema('customer_api').rpc('prepare_workspace_access_basis_v1', {
    p_workspace_id: id,
    p_email: input.email,
    p_role_id: input.role_id,
    p_mode: input.mode,
    p_duration_hours: input.mode === 'PILOT' ? input.duration_hours : null,
    p_contract_id: paid?.contract_id ?? null,
    p_payment_reference: paid?.payment_reference ?? null,
    p_payment_amount: paid?.payment_amount ?? null,
    p_payment_currency: paid?.payment_currency ?? null,
    p_paid_on: paid?.paid_on ?? null,
    p_paid_through: paid?.paid_through ?? null,
    p_evidence_note: input.evidence_note,
  });
  if (error) {
    const duplicate = error.code === '23505';
    return NextResponse.json(
      { error: { code: duplicate ? 'ACCESS_BASIS_EXISTS' : 'ACCESS_BASIS_REJECTED' } },
      { status: duplicate ? 409 : 422, headers: HEADERS },
    );
  }
  return NextResponse.json({ basis: data }, { status: 201, headers: HEADERS });
}
