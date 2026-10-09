import 'server-only';

import { Pool, type PoolClient } from 'pg';
import type { ListPackagesInput, PmCommand } from './contracts';

export type PmFunctionName =
  | 'register_package_internal_v1'
  | 'transition_cycle_internal_v1'
  | 'attach_evidence_internal_v1'
  | 'record_test_result_internal_v1'
  | 'record_acceptance_internal_v1'
  | 'request_change_internal_v1';

export interface PmRuntimeAdapter {
  listPackages(actorAuthUserId: string, input: ListPackagesInput): Promise<unknown>;
  getPackage(actorAuthUserId: string, programId: string, packageId: string): Promise<unknown>;
  execute(actorAuthUserId: string, functionName: PmFunctionName, command: PmCommand): Promise<unknown>;
}

async function withActor<T>(pool: Pool, actorAuthUserId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims',$1,true)`, [
      JSON.stringify({ sub: actorAuthUserId, aal: 'aal2', role: 'authenticated' }),
    ]);
    const result = await action(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function createPmPostgresAdapter(connectionString: string): PmRuntimeAdapter & { close(): Promise<void> } {
  if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) {
    throw new Error('PM database connection is not configured');
  }
  const pool = new Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  return {
    async listPackages(actorAuthUserId, input) {
      return withActor(pool, actorAuthUserId, async (client) => {
        const filters = { status: input.status, workstream_id: input.workstream_id };
        const result = await client.query(
          `select pm_private.list_packages_internal_v1($1::uuid,$2::jsonb,$3::integer,$4::timestamptz,$5::uuid) as value`,
          [input.program_id, JSON.stringify(filters), input.limit, input.cursor_created_at ?? null, input.cursor_id ?? null]
        );
        return result.rows[0]?.value;
      });
    },
    async getPackage(actorAuthUserId, programId, packageId) {
      return withActor(pool, actorAuthUserId, async (client) => {
        const result = await client.query(
          `select pm_private.get_package_internal_v1($1::uuid,$2::uuid) as value`,
          [programId, packageId]
        );
        return result.rows[0]?.value;
      });
    },
    async execute(actorAuthUserId, functionName, command) {
      const allowed = new Set<PmFunctionName>([
        'register_package_internal_v1',
        'transition_cycle_internal_v1',
        'attach_evidence_internal_v1',
        'record_test_result_internal_v1',
        'record_acceptance_internal_v1',
        'request_change_internal_v1',
      ]);
      if (!allowed.has(functionName)) throw new Error('Unsupported PM function');
      return withActor(pool, actorAuthUserId, async (client) => {
        const result = await client.query(
          `select pm_private.${functionName}($1::jsonb) as value`,
          [JSON.stringify(command)]
        );
        return result.rows[0]?.value;
      });
    },
    close: () => pool.end(),
  };
}
