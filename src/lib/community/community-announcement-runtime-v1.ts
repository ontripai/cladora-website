/** CE consumer requirements, NOT a delivered Core/Platform producer ABI. */
import 'server-only';
import type {Pool} from 'pg';
export type Ce010RequestBindingV1=Readonly<{
 contract:'ce010-request-binding.v1';request:Request;actor_id:string;session_id:string;
 /** Core/Platform must own role safety, target custody and transaction-local
  * verified SID/exp/context carriage. No Guide/SERVICE pool is interchangeable. */
 request_pool:Pick<Pool,'connect'>;
}>;
export type Ce010RuntimeV1=Readonly<{resolve:null|((request:Request,scope:Readonly<{context_id:string;workspace_id:string}>)=>Promise<Ce010RequestBindingV1|null>)} >;
// No env/credential discovery, public setter, allow callback or synthetic pool.
export const CE010_ANNOUNCEMENT_RUNTIME_V1:Ce010RuntimeV1=Object.freeze({resolve:null});
