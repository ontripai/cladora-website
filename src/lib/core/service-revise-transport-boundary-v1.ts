/** Private coordination of the official Core host and official runtime client.
 * No authority, SQL execution, connection or receipt is created here. */
import 'server-only';
import type{PoolClient}from'pg';
type State={phase:'open'|'expect_final'|'sealed'|'commit'|'settled'|'invalid';raw_commit_40001:unknown;ack:'COMMIT'|'ROLLBACK'|null};
const leases=new WeakMap<PoolClient,State>();
export function registerCoreServiceReviseTransportV1(client:PoolClient){if(leases.has(client))throw Error('service_transport_duplicate');leases.set(client,{phase:'open',raw_commit_40001:null,ack:null});}
function state(client:PoolClient){const s=leases.get(client);if(!s)throw Error('service_transport_not_official');return s;}
export function expectCoreServiceReviseFinalWireV1(client:PoolClient){const s=state(client);if(s.phase!=='open')throw Error('service_transport_final_phase');s.phase='expect_final';}
export function coreServiceReviseTransportPhaseV1(client:PoolClient){return state(client).phase;}
export function completeCoreServiceReviseFinalWireV1(client:PoolClient){const s=state(client);if(s.phase!=='expect_final')throw Error('service_transport_unexpected_final');s.phase='sealed';}
export function invalidateCoreServiceReviseTransportV1(client:PoolClient){const s=state(client);if(s.phase==='sealed'||s.phase==='expect_final')s.phase='invalid';}
export function beginCoreServiceReviseSettlementV1(client:PoolClient,verb:'commit'|'rollback'){const s=state(client);if(s.phase!=='sealed')throw Error('service_transport_unsealed_settlement');s.phase=verb==='commit'?'commit':'open';}
export function recordCoreServiceReviseRawSettlementV1(client:PoolClient,ack:'COMMIT'|'ROLLBACK'){const s=state(client);s.ack=ack;s.phase='settled';}
export function recordCoreServiceReviseRawCommitFailureV1(client:PoolClient,error:unknown){const s=state(client);if(s.phase==='commit'&&typeof error==='object'&&error!==null&&'code'in error&&error.code==='40001')s.raw_commit_40001=error;s.phase='invalid';}
export function coreServiceReviseRawCommitAbortedV1(client:PoolClient,error:unknown){return state(client).raw_commit_40001===error;}
export function closeCoreServiceReviseTransportV1(client:PoolClient){const s=leases.get(client);if(s)s.phase='invalid';}
