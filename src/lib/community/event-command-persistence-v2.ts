/** Reuses the canonical CE011 C03 SQL/RPC. No model state, transaction,
 * idempotency reservation, receipt, retry loop or audit/outbox engine in JS. */
import 'server-only';
import {eventCommandSchema,type EventCommand} from './event-interest-schema';
import {parseEventCommandResult} from './event-interest-client';
import type {Ce011EventBindingV2} from './event-command-runtime-v2';
export const ce011CommandPermissionV2={
 create_event:'events.event.publish',publish_event:'events.event.publish',cancel_event:'events.event.cancel',
 register_interest:'events.interest.manage_self',withdraw_interest:'events.interest.manage_self',
 record_attendance:'events.attendance.record',correct_attendance:'events.attendance.correct',
} as const;
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
export function snapshotEventCommandV2(value:unknown):EventCommand{
 const command=eventCommandSchema.parse(structuredClone(value));
 // Existing PostgreSQL version columns are int4; do not silently round/widen.
 const eventLimit=command.type==='publish_event'||command.type==='cancel_event'?2147483646:2147483647;
 if(command.expected_version>eventLimit)throw Object.assign(Error('INVALID_VERSION'),{code:'22023'});
 const versions=[...('expected_interest_version'in command?[command.expected_interest_version]:[]),...('expected_attendance_version'in command?[command.expected_attendance_version]:[])];
 if(versions.some(x=>!Number.isSafeInteger(x)||x>2147483646))throw Object.assign(Error('INVALID_VERSION'),{code:'22023'});
 return freeze(command);
}
export async function executeCe011EventCommandV2(binding:Ce011EventBindingV2,command:EventCommand){
 const answer=await binding.command_rpc.rpc('command_ce_event_v2',{p_request:command});
 if(answer.error)throw answer.error; // preserve the original40001/error object; HTTP never exposes its text
 return parseEventCommandResult(answer.data,command);
}
