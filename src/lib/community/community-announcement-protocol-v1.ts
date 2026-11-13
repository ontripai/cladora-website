/** Browser-safe envelope checks; this is correlation, never server authority. */
import {z} from 'zod';
import {ce010CommandSchema,type Ce010Command} from './community-base-schema';
const uuid=z.string().uuid(),positive=z.number().int().positive().safe();
const core=z.strictObject({contract_version:z.literal('core-transaction-command.v2'),transaction_id:uuid,command_id:uuid,
 context_id:uuid,workspace_id:uuid,actor_id:uuid,authority_version:positive,permission_code:z.literal('community.announcement.publish'),
 module_code:z.literal('community_basic'),evaluation_purpose:z.literal('community.announcement.command'),aggregate_type:z.literal('community_announcement'),
 aggregate_id:uuid,aggregate_version:positive,provider_source_ids:z.array(uuid).length(2),idempotency_key:z.string(),input_fingerprint:z.string().regex(/^sha256:[a-f0-9]{64}$/),
 subject_reference:z.strictObject({kind:z.literal('community.announcement'),id:uuid,version:positive,relation:z.enum(['create_announcement','publish_announcement','cancel_announcement']),request_version:z.literal(1)})});
const prepared=z.strictObject({contract:z.literal('ce010-prepared-announcement.v1'),command:ce010CommandSchema,core_command:core});
export function announcementExecutionWireV1(value:unknown,command:Ce010Command){
 if(!('announcement_id'in command))throw Error('INVALID_ANNOUNCEMENT');
 const p=prepared.parse(value),c=p.core_command,version=command.type==='create_announcement'?1:command.expected_version+1;
 const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
 if(JSON.stringify(p.command)!==JSON.stringify(command)||!same(c.command_id,command.command_id)||!same(c.context_id,command.context_id)
  ||!same(c.workspace_id,command.workspace_id)||!same(c.aggregate_id,command.announcement_id)||c.aggregate_version!==version
  ||c.idempotency_key!==command.idempotency_key||!same(c.subject_reference.id,command.announcement_id)||c.subject_reference.version!==version
  ||c.subject_reference.relation!==command.type||!c.provider_source_ids.some(v=>same(v,command.community_id))||!c.provider_source_ids.some(v=>same(v,command.announcement_id)))throw Error('INVALID_PREPARED_ANNOUNCEMENT');
 return JSON.stringify({op:'execute_announcement',command:p.command,core_command:c});
}
