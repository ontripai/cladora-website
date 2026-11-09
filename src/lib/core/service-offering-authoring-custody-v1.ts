/** Fixed canonical pre-dispatch custody port for the actual SERVICE8393 consumer. */
import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Pool} from 'pg';
import {createVersionedServiceOfferingCommandV1Schema as create,transitionVersionedServiceOfferingCommandV1Schema as transition} from '../customer/service-v14-execution/offering-command';
import {createCoreFunctionalCommandRuntimeV1,coreFunctionalDevelopmentTargetV1Schema,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {createCoreFunctionalRequestAuthV1} from './functional-request-auth-v1';
import {getPublicSupabaseEnv} from '../supabase/env';
export const CORE_SERVICE_AUTHORING_CUSTODY_V1='core-service-authoring-custody.v1' as const;
export const CORE_SERVICE_AUTHORING_CUSTODY_RUNTIME_BINDING=null;
const digest=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().uuid();
const inputSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('create'),custody_owner:digest,command_sha256:digest,command:create}),
 z.strictObject({kind:z.literal('transition'),custody_owner:digest,command_sha256:digest,command:transition}),
]);
const responseSchema=z.strictObject({contract_version:z.literal('core-service-authoring-custody-db.v1'),
 database_oid:z.number().int().positive(),database_name:z.string(),backend_marker:z.string(),tenant_id:uuid,membership_id:uuid,
 record_wire:z.string().max(131072),record_sha256:digest});
export function serializeCoreServiceAuthoringCustodyV1(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(serializeCoreServiceAuthoringCustodyV1).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+serializeCoreServiceAuthoringCustodyV1(v)).join(',')+'}';
 const json=JSON.stringify(value);if(json===undefined)throw Error('SERVICE_CUSTODY_INVALID');return json;
}
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
function withoutIdentity(command:Record<string,unknown>){const {actor_id:_actor,authority_version:_authority,...request}=command;return request;}
function withoutAuthority(command:Record<string,unknown>){const {authority_version:_authority,...rest}=command;return rest;}
/** No caller SQL, endpoint, schema, Auth callback or durable=true assertion. */
export function createCoreServiceOfferingAuthoringCustodyBindingV1(){return Object.freeze({
 contract_version:'service-offering-authoring-custody-binding.v1' as const,
 async bind(options:Readonly<{request:Request;pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
  const {request}=options,target=Object.freeze(coreFunctionalDevelopmentTargetV1Schema.parse(options.target));
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,target,offering:null});
  await runtime.verifyServerSession();if(request.signal.aborted)throw Error('SERVICE_CUSTODY_ABORTED');
  const env=getPublicSupabaseEnv();if(new URL(env.url).origin!==new URL(target.auth_origin).origin)throw Error('SERVICE_CUSTODY_TARGET_MISMATCH');
  const client=await createCoreFunctionalRequestAuthV1(request,target.auth_origin,env.publishableKey);
  let originalScope:string|null=null,busy=false;
  return Object.freeze({contract_version:'service-offering-authoring-custody-port.v1' as const,durability:'canonical_database.v1' as const,
   async prepareOrRecover(value:unknown){
    if(request.signal.aborted||busy)throw Error('SERVICE_CUSTODY_UNAVAILABLE');
    const input=inputSchema.parse(value),command=input.command;
    const selected='input' in command?command.input:command;
    const scope=JSON.stringify([selected.context_id,selected.workspace_id]);
    if(originalScope!==null&&scope!==originalScope)throw Error('SERVICE_CUSTODY_SCOPE_MISMATCH');originalScope=scope;
    const publicWire=serializeCoreServiceAuthoringCustodyV1({kind:input.kind,request:withoutIdentity(command)});
    if(Buffer.byteLength(publicWire)>65536||sha(publicWire)!==input.command_sha256)throw Error('SERVICE_CUSTODY_FINGERPRINT_MISMATCH');
    busy=true;
    try{
     const identity=await runtime.resolveCommandIdentity({context_id:selected.context_id,workspace_id:selected.workspace_id,
      permission_code:'action' in command&&command.action==='publish'?'services.catalog.publish':'services.catalog.manage',module_code:'services_catalog'});
     if(identity.actor_id!==command.actor_id||request.signal.aborted)throw Error('SERVICE_CUSTODY_ACTOR_MISMATCH');
     const wire=serializeCoreServiceAuthoringCustodyV1({contract_version:'service-offering-authoring-custody-record.v1',...input});
     const {data,error}=await client.schema('platform_dev').rpc('prepare_service_offering_authoring_v1',{p_request:{
      context_id:selected.context_id,workspace_id:selected.workspace_id,kind:input.kind,idempotency_key:selected.idempotency_key,
      custody_owner:input.custody_owner,command_sha256:input.command_sha256,public_wire:publicWire,record_wire:wire,
     }}).abortSignal(AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
     if(error)throw error; // Same original40001/timeout/unknown, no retry/fallback.
     if(request.signal.aborted)throw Error('SERVICE_CUSTODY_ABORTED');
     const row=responseSchema.parse(data);
     if(row.database_oid!==target.database_oid||row.database_name!==target.database_name||row.backend_marker!==target.backend_id
      ||row.tenant_id!==identity.tenant_id||row.membership_id!==identity.membership_id||sha(row.record_wire)!==row.record_sha256)throw Error('SERVICE_CUSTODY_TARGET_OR_SCOPE_MISMATCH');
     // Dispatch by kind to the exact existing SERVICE command schema, not a new command codec.
     const raw=JSON.parse(row.record_wire) as Record<string,unknown>;
     if(raw.contract_version!=='service-offering-authoring-custody-record.v1')throw Error('SERVICE_CUSTODY_RECORD_MISMATCH');
     const {contract_version:_version,...rest}=raw;const stored=inputSchema.parse(rest);
     if(stored.kind!==input.kind||stored.custody_owner!==input.custody_owner||stored.command_sha256!==input.command_sha256
      ||serializeCoreServiceAuthoringCustodyV1(withoutAuthority(stored.command))!==serializeCoreServiceAuthoringCustodyV1(withoutAuthority(command)))throw Error('SERVICE_CUSTODY_RECORD_MISMATCH');
     // Preserve the stored authority tuple; current identity is NEVER written over it.
     return Object.freeze({...stored,contract_version:'service-offering-authoring-custody-record.v1' as const});
    }finally{busy=false;}
   },
  });
 },
});}
