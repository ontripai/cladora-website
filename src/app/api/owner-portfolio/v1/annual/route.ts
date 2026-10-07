import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupportedLocale } from '@/types';
import { annualCsv } from '@/lib/owner-portfolio/csv';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export async function GET(request: NextRequest) {
  const parsed = z.coerce.number().int().min(2000).max(2100).safeParse(request.nextUrl.searchParams.get('year'));
  if (!parsed.success || request.nextUrl.searchParams.get('year') === null) return NextResponse.json({ error: 'INVALID_YEAR' }, { status: 400, headers });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  const { data, error } = await db.schema('customer_api').rpc('owner_annual_bookkeeping_v1' as never, { p_year: parsed.data } as never);
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'ACCESS_DENIED' : 'SUMMARY_FAILED' }, { status: error.code === '42501' ? 403 : 400, headers });
  if(request.nextUrl.searchParams.get('format')==='csv') {
    const report=data as unknown as {groups:Record<string,unknown>[]};
    return new NextResponse(annualCsv(report.groups,isSupportedLocale(request.nextUrl.searchParams.get('lang')??'')?request.nextUrl.searchParams.get('lang') as 'ro'|'en'|'fa':'en'),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="owner-bookkeeping-${parsed.data}.csv"`}});
  }
  return NextResponse.json(data, { headers });
}
