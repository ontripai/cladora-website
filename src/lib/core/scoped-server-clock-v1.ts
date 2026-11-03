import {z} from 'zod';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
export const CORE_SCOPED_SERVER_CLOCK_V1='core-scoped-server-clock.v1' as const;
/** Reuse postgres-clock-json-timestamptz.v1 encoding (Core288); no Date/TTL,
 * timezone guess or authorization is derived from this timestamp.
 */
export async function readCoreScopedServerClockV1(scope:CoreTransactionScopeV1):Promise<string>{
 const result=await scope.query(`select txid_current()::text as database_transaction_id,
  auth.uid()::text as actor_id,auth.jwt()->>'active_workspace_id' as workspace_id,
  pg_catalog.to_jsonb(pg_catalog.clock_timestamp()) #>> '{}' as evaluated_at`);
 const parsed=z.strictObject({database_transaction_id:z.string(),actor_id:z.string().uuid(),workspace_id:z.string().uuid(),evaluated_at:z.iso.datetime({offset:true})}).parse(result.rows[0]);
 if(result.rowCount!==1||parsed.database_transaction_id!==scope.database_transaction_id
  ||parsed.actor_id!==scope.actor_id||parsed.workspace_id!==scope.workspace_id)throw new Error('CORE_SERVER_CLOCK_SCOPE_MISMATCH');
 return parsed.evaluated_at;
}
