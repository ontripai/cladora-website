/** Finance622 source-capture ABI adoption; pure reference planner, never approval. */
import {z} from 'zod';
const reference=z.strictObject({contract_version:z.literal('monthly-source-reference-handoff.v2'),
 context_id:z.string().uuid().transform(v=>v.toLowerCase()),cycle_id:z.string().uuid().transform(v=>v.toLowerCase()),
 source_relation:z.enum(['utilities.provider_invoices','maintenance.vendor_payables','utilities.meter_readings','finance.allocation_runs']),
 source_id:z.string().uuid().transform(v=>v.toLowerCase())});
const types={'utilities.provider_invoices':'provider_invoice','maintenance.vendor_payables':'vendor_payable',
 'utilities.meter_readings':'meter_reading','finance.allocation_runs':'allocation_run'} as const;
export function planMonthlySourceCaptureV2(value:unknown){
 const r=reference.parse(value);
 return {contract_version:'monthly-source-reference-handoff.v2' as const,status:'request_prepared_source_unverified' as const,
  requires_finance_source:'622054afe7f47ba92c7c47159c7af4d1e38fe57d' as const,
  request:{method:'POST' as const,path:`/api/customer/v1/accounting/monthly-cycles/${r.cycle_id}/capture-source`,
   body:{action:'capture-source' as const,context_id:r.context_id,source_type:types[r.source_relation],source_id:r.source_id}},
  action_authorization:'not_evaluated' as const};
}
