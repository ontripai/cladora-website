import { TABLES, SEQUENCES, must, canonical } from './admission.mjs';

const names = TABLES.map(t => `'${t}'`).join(',');
import { verifyScopedCatalog } from './closure.mjs';
export async function preflight(observer, review, closure) {
  const identity = await observer.query(`select current_database() as database,
    (select oid::text from pg_database where datname=current_database()) as database_oid,
    (select system_identifier::text from pg_control_system()) as system_identifier,
    current_user::text as observer_role,session_user::text as session_role,
    current_setting('server_version_num')::int as version,
    current_setting('default_transaction_read_only') as read_only`);
  const i = identity.rows[0];
  for (const key of ['database', 'database_oid', 'system_identifier', 'observer_role']) {
    must(i?.[key] === review.target[key], 'TARGET_IDENTITY_MISMATCH');
  }
  must(i.session_role === i.observer_role && i.version >= 170000 && i.version < 180000
    && i.read_only === 'on', 'PG17_READONLY_OBSERVER_REQUIRED');
  const native = await observer.query(`select
    to_regprocedure('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)') is not null as native,
    to_regprocedure('app_private.assert_ce_guide_role_safety_v1()') is not null as safety,
    to_regclass('documents.documents') is not null as documents,
    to_regclass('experience.guides') is not null as guides`);
  must(Object.values(native.rows[0] ?? {}).length === 4
    && Object.values(native.rows[0]).every(x => x === true), 'NATIVE_INSTALLATION_MISSING');
  await verifyScopedCatalog(observer, review.installation, closure,
    [review.target.observer_role, review.target.conflict_role].filter(Boolean));
  const role = await observer.query(`select rolsuper,rolcreaterole,rolcreatedb,rolreplication
    from pg_roles where rolname=current_user`);
  must(role.rowCount === 1 && Object.values(role.rows[0]).every(v => v === false), 'OBSERVER_POWERFUL_ROLE');
  const acl = await observer.query(`select t as relation,has_table_privilege(current_user,t,'SELECT') as readable,
    has_table_privilege(current_user,t,'INSERT,UPDATE,DELETE,TRUNCATE') as writable
    from unnest(array[${names}]) t`);
  must(acl.rowCount === TABLES.length && acl.rows.every(r => r.readable && !r.writable), 'OBSERVER_COVERAGE_OR_ACL_MISSING');
  const sequence = await observer.query(`select has_sequence_privilege(current_user,'audit.events_id_seq','SELECT') as readable,
    has_sequence_privilege(current_user,'audit.events_id_seq','USAGE,UPDATE') as writable`);
  must(sequence.rowCount === 1 && sequence.rows[0].readable && !sequence.rows[0].writable, 'OBSERVER_SEQUENCE_COVERAGE_MISSING');
}

export async function snapshot(observer, tenant) {
  // row_security=off causes an error if RLS would silently filter this observer.
  // The separately admitted read-only observer needs complete fixture coverage.
  await observer.query('begin isolation level repeatable read read only');
  try {
    await observer.query('set local row_security=off');
    const result = await observer.query(TABLES.map(t => `select '${t}' as relation,
      count(*)::text as count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x)
        order by to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') as digest
      from ${t} x where tenant_id=$1::uuid`).concat(SEQUENCES.map(s =>
        `select '${s}' as relation,last_value::text as count,
        encode(sha256(convert_to(jsonb_build_array(last_value,is_called)::text,'UTF8')),'hex') as digest from ${s}`
      )).join('\nunion all\n'), [tenant]);
    await observer.query('commit');
    must(result.rowCount === TABLES.length + SEQUENCES.length, 'SNAPSHOT_INCOMPLETE');
    return result.rows;
  } catch (error) { await observer.query('rollback'); throw error; }
}
export const XACT_STATS_SQL = `select coalesce(sum(n_tup_ins),0)::text as inserted,
 coalesce(sum(n_tup_upd),0)::text as updated,coalesce(sum(n_tup_del),0)::text as deleted
 from pg_stat_xact_user_tables`;

export async function measure(scope, observer, tenant, operation, afterRead) {
  const pid = (await scope.query('select pg_backend_pid() as pid')).rows[0].pid;
  const observerPid = (await observer.query('select pg_backend_pid() as pid')).rows[0].pid;
  must(pid !== observerPid, 'INDEPENDENT_OBSERVER_REQUIRED');
  const before = await snapshot(observer, tenant);
  const stats = (await scope.query(XACT_STATS_SQL)).rows[0];
  const value = await operation();
  const afterStats = (await scope.query(XACT_STATS_SQL)).rows[0];
  must(canonical(afterStats) === canonical(stats), 'PROVIDER_STAGED_TUPLE_WRITE');
  must(canonical(await snapshot(observer, tenant)) === canonical(before), 'PROVIDER_DURABLE_WRITE_OBSERVED');
  if (afterRead) await afterRead(pid);
  return value;
}

/** Only deliberate mutating probe: admitted synthetic document permission id=id. No data
 * value changes. It is outside provider measurement and cannot be caller SQL.
 */
export async function openContender(conflictPool, tenant, documentId) {
  const client = await conflictPool.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout='800ms'");
    await client.query("set local statement_timeout='2s'");
    const role = await client.query(`select current_user::text as role,session_user::text as session_role,
      rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication
      from pg_roles where rolname=current_user`);
    const identity = role.rows[0];
    must(role.rowCount === 1 && identity.role === conflictPool.expected_role
      && identity.session_role === identity.role
      && ['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'].every(k => identity[k] === false), 'CONFLICT_ROLE_UNSAFE');
    const candidates = await client.query(`select id::text from documents.document_permissions
      where tenant_id=$1 and document_id=$2 order by id limit 2`, [tenant, documentId]);
    must(candidates.rowCount === 1, 'CONFLICT_PERMISSION_FIXTURE_MISSING_OR_AMBIGUOUS');
    const permission = candidates.rows[0].id;
    const rowSql = `select encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') as digest
      from documents.document_permissions p where tenant_id=$1 and document_id=$2 and id=$3`;
    const values = [tenant, documentId, permission];
    const before = await client.query(rowSql, values);
    const stats = (await client.query(XACT_STATS_SQL)).rows[0];
    const pid = (await client.query('select pg_backend_pid() as pid')).rows[0].pid;
    return { client, pid, async update() {
      const updated = await client.query('update documents.document_permissions set id=id where tenant_id=$1 and document_id=$2 and id=$3 returning id', values);
      const after = await client.query(rowSql, values);
      const totals = (await client.query(XACT_STATS_SQL)).rows[0];
      must(updated.rowCount === 1 && before.rows[0]?.digest === after.rows[0]?.digest
        && BigInt(totals.updated) === BigInt(stats.updated) + 1n
        && totals.inserted === stats.inserted && totals.deleted === stats.deleted, 'CONFLICT_PROBE_WOULD_CHANGE_VALUES_OR_OTHER_ROWS');
      return updated;
    } };
  } catch (error) { await client.query('rollback').catch(() => {}); client.release(true); throw error; }
}
export async function sharedLockProbe(scopePid, observer, conflictPool, tenant, doc) {
  const probe = await openContender(conflictPool, tenant, doc);
  try {
    const outcome = probe.update().then(r => ({ result: r }), error => ({ error }));
    let witnessed = false;
    const deadline = Date.now() + 600;
    while (Date.now() < deadline) {
      const blocking = await observer.query('select $1::int=any(pg_blocking_pids($2)) as blocked', [scopePid, probe.pid]);
      if (blocking.rows[0]?.blocked === true) { witnessed = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const result = await outcome;
    must(witnessed && result.error?.code === '55P03', 'REAL_SHARED_LOCK_NOT_WITNESSED');
  } finally { await probe.client.query('rollback'); probe.client.release(); }
}
export async function createSerializationConflict(conflictPool, tenant, doc) {
  const probe = await openContender(conflictPool, tenant, doc);
  try {
    const result = await probe.update();
    must(result.rowCount === 1, 'SERIALIZATION_TARGET_NOT_WRITABLE');
    await probe.client.query('commit');
  } catch (error) { await probe.client.query('rollback').catch(() => {}); throw error; }
  finally { probe.client.release(); }
}
