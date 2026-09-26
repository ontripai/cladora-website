import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET(request: NextRequest) {
  const unit = z.uuid().safeParse(request.nextUrl.searchParams.get('private_unit_id'));
  if (!unit.success) return NextResponse.json({ error: 'INVALID_UNIT' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = await db.schema('customer_api').rpc('list_my_owner_building_charges_v1' as never, { p_private_unit: unit.data } as never);
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'ACCESS_DENIED' : 'CHARGES_READ_FAILED' }, { status: error.code === '42501' ? 403 : 400, headers });
  return NextResponse.json({ charges: data }, { headers });
}
