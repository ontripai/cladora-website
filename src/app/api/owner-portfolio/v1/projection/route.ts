import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ownerPortfolioProjectionV1Schema } from '@/lib/core/owner-portfolio-projection-v1';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const responseSchema = z.array(ownerPortfolioProjectionV1Schema).max(100);

export async function GET() {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  }

  const { data, error } = await db.schema('customer_api').rpc(
    'list_my_owner_portfolio_projections_v1' as never,
    { p_expected_unit_versions: {} } as never,
  );
  if (error) {
    return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403, headers });
  }
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: 'PROJECTION_INVALID' }, { status: 502, headers });
  }
  return NextResponse.json({ projections: parsed.data }, { headers });
}
