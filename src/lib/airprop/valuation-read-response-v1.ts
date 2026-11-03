import { z } from 'zod';

// Browser-safe whitelist: no engine/crypto, receipt, source IDs or authority trace.
export const valuationReadSelectionV1Schema = z.strictObject({
 context_id:z.string().uuid().transform(v=>v.toLowerCase()),
 workspace_id:z.string().uuid().transform(v=>v.toLowerCase()),
 opportunity_id:z.string().uuid().transform(v=>v.toLowerCase()),
 purpose:z.enum(['sale_estimate','rental_recommendation']),
});
export type ValuationReadSelectionV1=z.infer<typeof valuationReadSelectionV1Schema>;
const amount=z.string().regex(/^(0|[1-9][0-9]{0,40})(\.[0-9]{1,24})?$/);
const range=z.strictObject({low:amount,central:amount,high:amount});
export const valuationReadResponseV1Schema=z.discriminatedUnion('state',[
 z.strictObject({contract:z.literal('airprop-valuation-read.v1'),state:z.literal('NOT_READY'),reason:z.literal('valuation_dependencies_unverified')}),
 z.strictObject({contract:z.literal('airprop-valuation-read.v1'),state:z.literal('UNAVAILABLE')}),
 z.strictObject({contract:z.literal('airprop-valuation-read.v1'),state:z.literal('RESULT'),
  transaction_kind:z.enum(['sale','rent']),rental_period:z.enum(['month','year']).nullable(),
  currency:z.string().regex(/^[A-Z]{3}$/),as_of:z.string().datetime({offset:true}),computed_at:z.string().datetime({offset:true}),
  outcome:z.enum(['insufficient_data','estimated','review_required']),range:range.nullable(),
  basis:z.literal('subject_total'),area_unit:z.literal('sqm'),
  factors:z.tuple([z.literal('comparable_evidence'),z.literal('independent_sale_or_rent'),z.literal('not_market_validated')]),
 }),
]).superRefine((v,ctx)=>{
 if(v.state!=='RESULT')return;
 if((v.transaction_kind==='sale'&&v.rental_period!==null)||(v.transaction_kind==='rent'&&v.rental_period===null)||
    (v.outcome==='insufficient_data')!==(v.range===null))ctx.addIssue({code:'custom',message:'valuation_basis_or_outcome_mismatch'});
 if(v.range){
  // Exact decimal comparison without browser BigInt/Number price rounding.
  const cmp=(a:string,b:string)=>{const [ai,af='']=a.split('.'),[bi,bf='']=b.split('.');return ai.length-bi.length||ai.localeCompare(bi)||af.padEnd(24,'0').localeCompare(bf.padEnd(24,'0'));};
  if(cmp(v.range.low,v.range.central)>0||cmp(v.range.central,v.range.high)>0)ctx.addIssue({code:'custom',message:'invalid_range'});
 }
});
export type ValuationReadResponseV1=z.infer<typeof valuationReadResponseV1Schema>;
