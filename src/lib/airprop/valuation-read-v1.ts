import { z } from 'zod';
import { computeValuationBaselineV1, projectValuationBaselineV1, valuationBaselinePreparedInputV2Schema } from './valuation-baseline-v1';
import { valuationReadSelectionV1Schema, valuationReadResponseV1Schema, type ValuationReadSelectionV1, type ValuationReadResponseV1 } from './valuation-read-response-v1';

type Prepared=z.infer<typeof valuationBaselinePreparedInputV2Schema>;
export type AuthorizedValuationReadV1={
 // Internal adapter seam, NOT a proposed replacement for Core ABI or auth evidence.
 // Both callbacks must derive actor/session/clock from the authenticated server,
 // resolve opportunity→canonical resource, authorize THIS action, and load rights.
 // Never construct this from request JSON, client can_* flags or a cached run.
 // Read an existing prepared request; GET must not create a receipt or persist a run.
 readPrepared:(request:Request,selection:ValuationReadSelectionV1)=>Promise<null|{selection:ValuationReadSelectionV1;prepared:unknown}>;
 readCurrent:(request:Request,selection:ValuationReadSelectionV1)=>Promise<null|{
  selection:ValuationReadSelectionV1;resource:Prepared['input']['resource'];
  core_request:Prepared['input']['core_request'];core_evidence:Prepared['input']['core_evidence'];
  sources:Prepared['input']['sources'];read_at:string;
 }>;
};
const headers={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie'};
const notReady=():ValuationReadResponseV1=>({contract:'airprop-valuation-read.v1',state:'NOT_READY',reason:'valuation_dependencies_unverified'});
const unavailable=():ValuationReadResponseV1=>({contract:'airprop-valuation-read.v1',state:'UNAVAILABLE'});
const equal=(a:ValuationReadSelectionV1,b:ValuationReadSelectionV1)=>Object.keys(a).every(k=>a[k as keyof typeof a]===b[k as keyof typeof b]);
const json=(body:ValuationReadResponseV1,status:number)=>Response.json(valuationReadResponseV1Schema.parse(body),{status,headers});

/** No configured trusted producer means no computation and zero data access. */
export async function handleValuationReadV1(request:Request,producer:AuthorizedValuationReadV1|null=null):Promise<Response>{
 if(request.method!=='GET')return json(unavailable(),405);
 try{
  const entries=Array.from(new URL(request.url).searchParams.entries());
  const selection=valuationReadSelectionV1Schema.safeParse(Object.fromEntries(entries));
  if(!selection.success||new Set(entries.map(([k])=>k)).size!==entries.length)return json(unavailable(),400);
  if(!producer)return json(notReady(),503);
  const selected=selection.data;
  const loaded=await producer.readPrepared(request,selected);
  if(!loaded)return json(notReady(),503);
  const bound=valuationReadSelectionV1Schema.parse(loaded.selection);
  if(!equal(selected,bound))return json(unavailable(),403);
  const prepared=valuationBaselinePreparedInputV2Schema.parse(loaded.prepared),i=prepared.input;
  const kind=selected.purpose==='sale_estimate'?'sale':'rent';
  if(i.resource.workspace_id!==selected.workspace_id||i.core_request.resource.context_id!==selected.context_id||
    i.core_request.resource.workspace_id!==selected.workspace_id||!i.request.purposes.includes(selected.purpose)||i.policy.transaction_kind!==kind)return json(unavailable(),403);
  // No accepted FX producer/rights binding exists in this composition. A rate
  // record by itself is not authorization; do not silently use or invent FX.
  if(i.quality_policy.fx_rates.length||i.observations.some(o=>o.currency!==i.quality_policy.target_currency))return json(notReady(),503);
  const run=computeValuationBaselineV1(prepared);
  if(run.stage==='not_ready')return json(notReady(),503);
  if(run.stage==='blocked')return json(unavailable(),403);
  // Fresh current authorization/read is required even for replay/insufficient data.
  const current=await producer.readCurrent(request,selected);
  if(!current)return json(notReady(),503);
  if(!equal(selected,valuationReadSelectionV1Schema.parse(current.selection))||
     current.core_request.resource.context_id.toLowerCase()!==selected.context_id)return json(unavailable(),403);
  const projection=projectValuationBaselineV1({trusted_preparation:prepared,run,
   resource:current.resource,core_request:current.core_request,core_evidence:current.core_evidence,
   sources:current.sources,read_at:current.read_at,detail:'result_display'});
  if('stage' in projection)return json(unavailable(),403);
  const v=projection.valuation,result=v.result;
  return json(valuationReadResponseV1Schema.parse({contract:'airprop-valuation-read.v1',state:'RESULT',transaction_kind:v.transaction_kind,
   rental_period:v.rental_period,currency:v.currency,as_of:result.as_of,computed_at:result.computed_at,
   outcome:run.stage==='insufficient_data'?'insufficient_data':run.stage==='review_required'?'review_required':'estimated',range:v.transaction_kind==='sale'?result.sale_range:result.rent_range,
   basis:'subject_total',area_unit:'sqm',factors:['comparable_evidence','independent_sale_or_rent','not_market_validated']}),200);
 }catch{
  // Never expose provider errors, keys, IDs, evidence or private trace.
  return json(unavailable(),503);
 }
}
