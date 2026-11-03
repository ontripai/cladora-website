import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
import {HEADERS} from './maintenance-api-helper';
import {maintenanceUuidSchema} from './maintenance-schema';
import {operationsEnvelopeSchema,intentFromWire,boundOperationsAnswer} from './operations-command';
import {checklistV2Enabled,checklistCutoverMode} from './operations-checklist-cutover';
const requestSchema=z.strictObject({version:z.union([z.literal(1),z.literal(2)]),phase:z.enum(['open','lookup','reserve','execute','ack']),context_id:maintenanceUuidSchema.refine(value=>value===value.toLowerCase()),command:operationsEnvelopeSchema.nullable()});
export async function operationsCommandPOST(request:NextRequest){
 const error=(status:number,code:string)=>NextResponse.json({error:{code}},{status,headers:HEADERS});
 if(!hasTrustedMutationOrigin(request))return error(403,'BAD_ORIGIN');
 if(!isApplicationJson(request.headers.get('content-type')))return error(415,'UNSUPPORTED_MEDIA_TYPE');
 const {data,errorResponse}=await parseJsonWithLimit<unknown>(request,30*1024);if(errorResponse)return errorResponse;
 const parsed=requestSchema.safeParse(data);if(!parsed.success)return error(400,'INVALID_REQUEST');
 const p=parsed.data;
 if(checklistCutoverMode()==='hold')return error(503,'CHECKLIST_CUTOVER_INCOMPLETE');
 if(p.version===2&&!checklistV2Enabled())return error(503,'CHECKLIST_CUTOVER_INACTIVE');
 try{
  if((p.phase==='open')!==(p.command===null))return error(400,'INVALID_COMMAND');
  if(p.command){const intent=intentFromWire(p.command.wire);if(p.version===1&&intent.version!==1)return error(400,'INVALID_COMMAND_VERSION');if(intent.context_id!==p.context_id||createHash('sha256').update(p.command.wire,'utf8').digest('hex')!==p.command.fingerprint)return error(409,'COMMAND_CONFLICT');}
 }catch{return error(400,'INVALID_COMMAND');}
 const client=await createClient();const {data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return error(401,'UNAUTHORIZED');
 const {data:result,error:rpcError}=await (client.schema('customer_api') as any).rpc(p.version===2?'operations_command_v2':'operations_command_v1',{p_phase:p.phase,p_context_id:p.context_id,p_key:p.command?.key??null,p_wire:p.command?.wire??null,p_fingerprint:p.command?.fingerprint??null});
 if(rpcError)return error(rpcError.code==='42501'?403:rpcError.code==='40001'||rpcError.code==='23505'?409:rpcError.code==='22023'?400:503,rpcError.code==='42501'?'FORBIDDEN':rpcError.code==='40001'||rpcError.code==='23505'?'COMMAND_CONFLICT':'COMMAND_UNAVAILABLE');
 try{const answer=boundOperationsAnswer(result,p.phase,p.context_id,claims.claims.sub);if(p.version===1&&answer.version!==1)throw Error('unsupported_answer_version');return NextResponse.json(answer,{headers:HEADERS});}
 catch{return error(503,'COMMAND_UNAVAILABLE');}
}
export function legacyOperationsMutationClosed(){return NextResponse.json({error:{code:'OPERATIONS_COMMAND_REQUIRED'}},{status:428,headers:HEADERS});}
