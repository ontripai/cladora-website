/** Inactive server composition. Finance owns parsing, calculation, approval and
 * effect/readback verification. These domain functions are CODE dependencies,
 * never callbacks from HTTP and never substitutes for canonical C01. */
import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {coreTransactionCommandV1Schema,type CoreTransactionScopeV1,type CoreTransactionProvidersV1,type CoreTransactionResultV1} from './postgres-transaction-host-v1';
import queries from './finance-monthly-query-profile-v1.json';
export const CORE_FINANCE_MONTHLY_BINDING_V1='core-finance-monthly-binding.v1' as const;
const uuid=z.string().uuid().transform(v=>v.toLowerCase());
const envelope=z.strictObject({contract_version:z.literal('finance-monthly-http-request.v1'),context_id:uuid,workspace_id:uuid,
 command_id:uuid,transaction_id:uuid,idempotency_key:z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
 expected_authority_version:z.number().int().positive().safe(),operation:z.enum(['execute','readback']),payload:z.unknown()});
const planQuery=z.strictObject({context_id:uuid,workspace_id:uuid,allocation_run_id:uuid});
type Payload={action:'stage'|'calculate'|'approve'|'bill'|'consume';cycle_id:string;allocation_run_id:string;expected_cycle_version:number;
 sources?:{capture_id:string}[];statutory_cycle_id?:string;mappings?:{batch_id:string}[]};
/** Pass the actual pinned Finance module exports at trusted server assembly.
 * No provider may decide authority or supply actor/time. Core overrides C01. */
export interface CoreFinanceMonthlyDomainV1<P extends Payload,Plan,Readback>{
 canonicalMonthlyCommandV1(value:unknown):P;
 monthlyCommandFingerprintV1(value:unknown):string;
 createFinanceMonthlyProvidersV1(value:unknown):CoreTransactionProvidersV1;
 readFinanceMonthlyCommandV1(scope:CoreTransactionScopeV1,command:unknown,input:unknown):Promise<Readback>;
 readFinanceMonthlyPlanV1(scope:CoreTransactionScopeV1,context:string,cycle:string,run:string):Promise<Plan>;
}
const pairs={stage:['finance.allocations.calculate','accounting'],calculate:['finance.allocations.calculate','accounting'],
 approve:['finance.allocations.approve','accounting'],bill:['billing.manage','billing'],consume:['finance.monthly.manage','accounting']} as const;
export function createCoreFinanceMonthlyBindingV1<P extends Payload,Plan,Readback>(options:Readonly<{
 pool:Pool;target:CoreFunctionalDevelopmentTargetV1;domain:CoreFinanceMonthlyDomainV1<P,Plan,Readback>}>){
 const target=Object.freeze({...options.target}),domain=Object.freeze({...options.domain});
 const requests=new WeakMap<Request,{context:string;workspace:string;busy:boolean}>();
 async function run<T>(request:Request,context:string,workspace:string,fn:()=>Promise<T>){
  const previous=requests.get(request);
  if(request.signal.aborted||previous?.busy||(previous&&(previous.context!==context||previous.workspace!==workspace)))throw Error('FINANCE_REQUEST_SCOPE_MISMATCH');
  const state=previous??{context,workspace,busy:false};requests.set(request,state);state.busy=true;
  try{const answer=await fn();if(request.signal.aborted)throw Error('FINANCE_RESPONSE_ABORTED');return answer;}finally{state.busy=false;}
 }
 function runtime(request:Request,profile:'calculate'|'approve'|'bill'|'consume'|'read'){
  return createCoreFunctionalCommandRuntimeV1({pool:options.pool,target,request,offering:null,finance_profile:profile});
 }
 async function prepare(request:Request,value:unknown,operation:'execute'|'readback'){
  const input=envelope.parse(value);if(input.operation!==operation)throw Error('FINANCE_OPERATION_MISMATCH');
  const payload=domain.canonicalMonthlyCommandV1(input.payload),pair=pairs[payload.action];
  if(!pair)throw Error('FINANCE_ACTION_NOT_ADMITTED');
  const rt=runtime(request,payload.action==='stage'?'calculate':payload.action);
  const selected={context_id:input.context_id,workspace_id:input.workspace_id,cycle_id:payload.cycle_id};
  const identity=await rt.withFinanceScope(selected,'identity',async(_scope,identity)=>identity);
  // Keep the ORIGINAL HTTP revision, IDs/key/body. Current authority is observed
  // separately; an UNKNOWN command is never upgraded to a replacement command.
  const command=coreTransactionCommandV1Schema.parse({contract_version:'core-transaction-command.v1',
   context_id:input.context_id,workspace_id:input.workspace_id,actor_id:identity.actor_id,authority_version:input.expected_authority_version,
   transaction_id:input.transaction_id,command_id:input.command_id,idempotency_key:input.idempotency_key,
   permission_code:pair[0],module_code:pair[1],evaluation_purpose:`finance.monthly.${payload.action}`,
   aggregate_type:'finance.monthly_cycle',aggregate_id:payload.cycle_id,aggregate_version:payload.expected_cycle_version,
   input_fingerprint:domain.monthlyCommandFingerprintV1(payload),provider_source_ids:[payload.allocation_run_id,
    ...(payload.action==='calculate'?payload.mappings!.map(m=>m.batch_id):payload.action==='stage'?[payload.statutory_cycle_id!,...payload.sources!.map(s=>s.capture_id)]:[])].sort()});
  return {rt,input,payload,command,selected};
 }
 function effectScope(scope:CoreTransactionScopeV1,payload:P,command:ReturnType<typeof coreTransactionCommandV1Schema.parse>,kind:'validation'|'mutation'){
  return Object.freeze({...scope,async query<Row extends import('pg').QueryResultRow>(sql:string,args:unknown[]=[]){
   const expected=kind==='validation'?[payload.cycle_id,scope.tenant_id,scope.workspace_id,payload.expected_cycle_version]
    :[command.context_id,scope.workspace_id,scope.actor_id,JSON.stringify(payload)];
   if(sql!==queries[kind]||JSON.stringify(args)!==JSON.stringify(expected))throw Error('FINANCE_EFFECT_QUERY_NOT_ADMITTED');
   return scope.query<Row>(sql,args);
  }});
 }
 return Object.freeze({contract_version:CORE_FINANCE_MONTHLY_BINDING_V1,
  async executeVerified(request:Request,value:unknown):Promise<CoreTransactionResultV1>{
   const parsed=envelope.parse(value);
   return run(request,parsed.context_id,parsed.workspace_id,async()=>{
    const p=await prepare(request,value,'execute'),provider=domain.createFinanceMonthlyProvidersV1(p.payload);
    // Only the real Finance validation/effect queries cross its domain scope.
    // Canonical host alone writes reservation/receipt/audit/outbox and retries.
    const providers:CoreTransactionProvidersV1={resolveAuthority:provider.resolveAuthority,
     validateProviders:(scope,c,a)=>provider.validateProviders(effectScope(scope,p.payload,p.command,'validation'),c,a),
     mutate:(scope,c)=>provider.mutate(effectScope(scope,p.payload,p.command,'mutation'),c)};
    return p.rt.host.execute(p.command,providers);
   });
  },
  async readbackVerified(request:Request,value:unknown):Promise<Readback>{
   const parsed=envelope.parse(value);
   return run(request,parsed.context_id,parsed.workspace_id,async()=>{
    const p=await prepare(request,value,'readback');
    return p.rt.withFinanceScope({...p.selected,idempotency_key:p.command.idempotency_key,request_hash:createHash('sha256').update(JSON.stringify(p.command)).digest('hex')},'readback',
     scope=>domain.readFinanceMonthlyCommandV1(scope,p.command,p.payload));
   });
  },
  async readPlanVerified(request:Request,cycleId:string,value:unknown):Promise<Plan>{
   const selected=planQuery.parse(value),cycle=uuid.parse(cycleId);
   return run(request,selected.context_id,selected.workspace_id,()=>runtime(request,'read').withFinanceScope(
    {...selected,cycle_id:cycle},'plan',scope=>domain.readFinanceMonthlyPlanV1(scope,selected.context_id,cycle,selected.allocation_run_id)));
  },
 });
}
// Actual role mapping, SQL/ACL/RLS, domain provenance and native acceptance remain
// explicit deployment gates. Constructing a source factory is not activation.
export const CORE_FINANCE_MONTHLY_RUNTIME_BINDING_V1=null;
