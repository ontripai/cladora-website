import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { workspaceCostBenchmarkV1Schema } from '@/lib/customer/workspace-cost-benchmark-v1';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const query = z.strictObject({
  context_id: z.string().uuid(), workspace_id: z.string().uuid(),
  period_start: z.string().date(), period_end: z.string().date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
}).superRefine((value, ctx) => {
  const start = Date.parse(`${value.period_start}T00:00:00Z`);
  const end = Date.parse(`${value.period_end}T00:00:00Z`);
  if (end < start || end - start > 365 * 86_400_000) ctx.addIssue({ code: 'custom', path: ['period_end'], message: 'invalid_period' });
});
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers: HEADERS });
function rpcFailure(code?: string) {
  if (['42883','PGRST202'].includes(code ?? '')) return fail('COST_BENCHMARK_CONNECTION_NOT_READY',503);
  if (code==='42501') return fail('COST_BENCHMARK_ACCESS_DENIED',403);
  if (['22023','22P02'].includes(code ?? '')) return fail('INVALID_REQUEST',400);
  return fail('COST_BENCHMARK_FAILED',500);
}

export async function GET(request: NextRequest) {
  const params=request.nextUrl.searchParams;
  const allowed=['context_id','workspace_id','period_start','period_end','currency'];
  if(Array.from(params.keys()).some((key)=>!allowed.includes(key))||allowed.some((key)=>params.getAll(key).length!==1)) return fail('INVALID_REQUEST',400);
  const parsed=query.safeParse(Object.fromEntries(params)); if(!parsed.success)return fail('INVALID_REQUEST',400);
  const supabase=await createClient(); const {data:claims,error:authError}=await supabase.auth.getClaims();
  if(authError||!claims?.claims?.sub)return fail('UNAUTHORIZED',401);
  const {data,error}=await (supabase.schema('customer_api') as never as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{code?:string}|null}>}).rpc('get_workspace_cost_benchmark_v1',{
    p_context_id:parsed.data.context_id,p_workspace_id:parsed.data.workspace_id,
    p_period_start:parsed.data.period_start,p_period_end:parsed.data.period_end,p_currency:parsed.data.currency,
  });
  if(error)return rpcFailure(error.code); const result=workspaceCostBenchmarkV1Schema.safeParse(data);
  return result.success?NextResponse.json(result.data,{headers:HEADERS}):fail('COST_BENCHMARK_INVALID_RESPONSE',502);
}
