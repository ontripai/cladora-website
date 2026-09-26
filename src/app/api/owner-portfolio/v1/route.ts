import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import { ownerPortfolioMutation } from '@/lib/owner-portfolio/schema';
import { z } from 'zod';

const headers = { 'Cache-Control': 'no-store' };

async function authorized() {
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return { db, status: 401 as const };
  const { data: allowed, error } = await db.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never);
  return { db, status: error || allowed !== true ? 403 as const : 200 as const };
}

export async function GET(request: NextRequest) {
  const { db, status } = await authorized();
  if (status !== 200) return NextResponse.json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'OWNER_ROLE_REQUIRED' } }, { status, headers });
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');
  const unitId = request.nextUrl.searchParams.get('unit_id');
  const detailsOffset = Number(request.nextUrl.searchParams.get('details_offset') ?? '0');
  if (!Number.isSafeInteger(detailsOffset) || detailsOffset < 0 || detailsOffset > 100000 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || (unitId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitId)))
    return NextResponse.json({ error: { code: 'INVALID_QUERY' } }, { status: 400, headers });
  const units = await db.from('owner_private_units').select('id,building_label,unit_label,address_text,usage_kind,status,created_at', { count: 'exact' })
    .eq('status', 'active').order('created_at', { ascending: false }).range(offset, offset + 49);
  if (units.error) return NextResponse.json({ error: { code: 'PORTFOLIO_READ_FAILED' } }, { status: 500, headers });
  if (!unitId) return NextResponse.json({ units: units.data, count: units.count, leases: [], entries: [] }, { headers });
  const visible = await db.from('owner_private_units').select('id').eq('id', unitId).maybeSingle();
  if (visible.error || !visible.data) return NextResponse.json({ error: { code: 'UNIT_NOT_FOUND' } }, { status: 404, headers });
  const [leases, entries] = await Promise.all([
    db.from('owner_private_leases').select('id,unit_id,tenant_label,starts_on,ends_on,monthly_rent,currency,status', {count:'exact'}).eq('unit_id',unitId).order('starts_on',{ascending:false}).order('id').range(detailsOffset,detailsOffset+99),
    db.from('owner_private_cash_entries').select('id,unit_id,lease_id,kind,direction,amount,currency,due_on,paid_on,memo,source', {count:'exact'}).eq('unit_id',unitId).order('created_at',{ascending:false}).order('id').range(detailsOffset,detailsOffset+99),
  ]);
  if (leases.error || entries.error) return NextResponse.json({ error: { code: 'PORTFOLIO_READ_FAILED' } }, { status: 500, headers });
  return NextResponse.json({ units: units.data, count: units.count, leases: leases.data, entries: entries.data, lease_count: leases.count, entry_count: entries.count }, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'BAD_ORIGIN' } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 8 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = ownerPortfolioMutation.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  const { db, status } = await authorized();
  if (status !== 200) return NextResponse.json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'OWNER_ROLE_REQUIRED' } }, { status, headers });
  const { action, ...fields } = parsed.data;
  const table = action === 'unit' ? 'owner_private_units' : action === 'lease' ? 'owner_private_leases' : 'owner_private_cash_entries';
  const { data, error } = await db.from(table).insert(fields as never).select('id').single();
  if (error) return NextResponse.json({ error: { code: error.code === '23503' ? 'UNIT_NOT_FOUND' : error.code === '42501' ? 'ACCESS_DENIED' : 'PORTFOLIO_CREATE_FAILED' } }, { status: error.code === '23503' ? 404 : error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ id: data.id }, { status: 201, headers });
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'BAD_ORIGIN' } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get('content-type'))) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, { status: 415, headers });
  const { data: raw, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ lease_id: z.uuid(), transition: z.enum(['activate','end','cancel']) }).strict().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  const { db, status } = await authorized();
  if (status !== 200) return NextResponse.json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'OWNER_ROLE_REQUIRED' } }, { status, headers });
  const from = parsed.data.transition === 'end' ? 'active' : 'draft';
  const to = parsed.data.transition === 'activate' ? 'active' : parsed.data.transition === 'end' ? 'ended' : 'cancelled';
  const { data, error } = await db.from('owner_private_leases').update({ status: to }).eq('id', parsed.data.lease_id).eq('status', from).select('id,status').maybeSingle();
  if (error) return NextResponse.json({ error: { code: error.code === '23514' ? 'INVALID_LEASE_TRANSITION' : 'LEASE_UPDATE_FAILED' } }, { status: 400, headers });
  if (!data) return NextResponse.json({ error: { code: 'LEASE_NOT_FOUND_OR_CHANGED' } }, { status: 404, headers });
  return NextResponse.json({ lease: data }, { headers });
}
