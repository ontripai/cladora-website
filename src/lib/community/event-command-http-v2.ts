import 'server-only';
import type {NextRequest} from 'next/server';
import {ZodError} from 'zod';
import {authenticateExperienceGuideLifecycleServerSessionV1 as authenticateSession} from './experience-guide-lifecycle-http-v1';
import {sameEventUuid} from './event-interest-client';
import {ce011CommandPermissionV2,executeCe011EventCommandV2,snapshotEventCommandV2} from './event-command-persistence-v2';
import type {Ce011EventRuntimeV2} from './event-command-runtime-v2';
import {hasTrustedMutationOrigin} from '../security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '../security/request-body';
const headers={'cache-control':'no-store, private',pragma:'no-cache',vary:'Cookie'};
const fail=(status:number,code:string)=>Response.json({error:{code}},{status,headers});
const unknown=()=>Response.json({outcome:'unknown',error:{code:'CE_EVENT_COMMAND_UNCONFIRMED'}},{status:202,headers});
export function createCe011EventCommandHttpV2(runtime:Ce011EventRuntimeV2){
 return {async POST(request:NextRequest){
  let dispatched=false;
  try{
   if(!hasTrustedMutationOrigin(request))return fail(403,'BAD_ORIGIN');
   if(!isApplicationJson(request.headers.get('content-type')))return fail(415,'UNSUPPORTED_MEDIA_TYPE');
   const body=await parseJsonWithLimit<unknown>(request,16384);if(body.errorResponse)return fail(body.errorResponse.status,'INVALID_REQUEST');
   const command=snapshotEventCommandV2(body.data);
   if(runtime.resolve===null)return fail(503,'CE_EVENT_CONNECTION_NOT_READY');
   const session=await authenticateSession(request);if(!session?.session_id||request.signal.aborted)return fail(401,'UNAUTHORIZED');
   const binding=await runtime.resolve(request,{context_id:command.context_id,workspace_id:command.workspace_id,permission_code:ce011CommandPermissionV2[command.type],module_code:'community_events'});
   if(!binding||typeof binding.command_rpc?.rpc!=='function')return fail(503,'CE_EVENT_CONNECTION_NOT_READY');
   if(binding.contract!=='ce011-request-rpc-binding.v2'||binding.request!==request||!sameEventUuid(binding.actor_id,session.actor_id)||!sameEventUuid(binding.session_id,session.session_id)
    ||!sameEventUuid(binding.context_id,command.context_id)||!sameEventUuid(binding.workspace_id,command.workspace_id)||binding.expires_at!==session.expires_at)return fail(403,'CE_EVENT_ACCESS_DENIED');
   // All issuer waits precede RPC/C01's final canonical checks. Do not await an
   // SDK verifier after the canonical RPC response then expose its old result.
   const fresh=await authenticateSession(request);
   if(!fresh?.session_id||!sameEventUuid(fresh.actor_id,session.actor_id)||!sameEventUuid(fresh.session_id,session.session_id)||fresh.expires_at!==session.expires_at
    ||fresh.assurance_level!==session.assurance_level||request.signal.aborted)return fail(401,'UNAUTHORIZED');
   dispatched=true;const result=await executeCe011EventCommandV2(binding,command);
   if(request.signal.aborted||session.expires_at<=Math.floor(Date.now()/1000))return unknown();
   return Response.json(result,{status:200,headers});
  }catch(e){
   const code=(e as {code?:string})?.code;
   if(e instanceof ZodError&&!dispatched)return fail(400,'INVALID_REQUEST');
   if(['22023','22P02','22003'].includes(code??''))return fail(400,'INVALID_REQUEST');
   if(code==='42501')return fail(403,'CE_EVENT_ACCESS_DENIED');
   if(code==='AUTH401')return fail(401,'UNAUTHORIZED');
   if(['23505','23514','40001'].includes(code??''))return fail(409,'CE_EVENT_CONFLICT');
   if(code==='P0002')return fail(404,'CE_EVENT_NOT_FOUND');
   if(['42883','42P01','PGRST202','PGRST106','55000'].includes(code??''))return fail(503,'CE_EVENT_CONNECTION_NOT_READY');
   // Lost reply, bad success or unclassified post-dispatch error is ambiguous.
   // There is no automatic resend, replacement command or fallback RPC.
   return dispatched?unknown():fail(503,'CE_EVENT_CONNECTION_NOT_READY');
  }
 }};
}
