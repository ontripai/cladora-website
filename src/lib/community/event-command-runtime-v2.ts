/** CE consumer contract only. Core must supply a real request-local RPC port.
 * A binding object/string is not authority: canonical SQL enforces C01/C03.
 * No singleton client, service principal, pool/profile fallback or public setter. */
import 'server-only';
import type {EventCommand} from './event-interest-schema';
export type Ce011EventBindingV2=Readonly<{
 contract:'ce011-request-rpc-binding.v2';request:Request;actor_id:string;session_id:string;
 context_id:string;workspace_id:string;expires_at:number;
 command_rpc:Readonly<{rpc:(name:'command_ce_event_v2',args:Readonly<{p_request:EventCommand}>)=>PromiseLike<{data:unknown;error:{code?:string}|null}>}>;
}>;
export type Ce011EventRuntimeV2=Readonly<{resolve:null|((request:Request,scope:Readonly<{
 context_id:string;workspace_id:string;permission_code:string;module_code:'community_events';
}>)=>Promise<Ce011EventBindingV2|null>)} >;
export const CE011_EVENT_RUNTIME_V2:Ce011EventRuntimeV2=Object.freeze({resolve:null});
