import { randomUUID } from 'node:crypto';

/** Deterministic transaction contract double, NOT PostgreSQL/runtime deployment evidence.
 * Runs the real Core host and canonical provider. Unknown SQL fails closed.
 */
export function createB2ContractPool(actor) {
  const state = { revision: 7, revoked: false, permission: true, gate: false, failure: null,
    ledger: {}, domain: 0, audit: 0, outbox: 0, connections: 0, queries: [] };
  const tenant = randomUUID(), definition = randomUUID();
  const now = () => new Date().toISOString();
  return { state, async connect() {
    state.connections += 1;
    let staged;
    return { release() {}, async query(sql, values = []) {
      const text = sql.replace(/\s+/g, ' ').trim().toLowerCase(); state.queries.push(text);
      const rows = items => ({ rows: items, rowCount: items.length });
      if (text.startsWith('begin')) { staged = structuredClone({ ledger: state.ledger, domain: state.domain, audit: state.audit, outbox: state.outbox }); return rows([]); }
      if (text === 'rollback') { staged = null; return rows([]); }
      if (text === 'commit') { Object.assign(state, staged); staged = null; if (state.failure === 'commit') throw new Error('unknown_commit'); return rows([]); }
      if (text.startsWith('set local') || text.includes('pg_advisory_xact_lock')) return rows([]);
      if (text.includes('from platform.customer_workspaces')) return rows([{ tenant_id: tenant }]);
      if (text.includes('as transaction_id') && text.includes('transaction_isolation')) return rows([{ transaction_id: '123', actor_id: actor, isolation: 'serializable', evaluated_at: now() }]);
      if (text.includes('txid_current()::text as id')) return rows([{ id: '123', now: now() }]);
      if (text.includes('canonical_authority_revision_v1')) {
        if (state.failure === 'provider') throw new Error('private_sql_details');
        return rows([{ revision: String(state.revision) }]);
      }
      if (text.includes('from identity.context_grants')) return rows([{ tenant_id: tenant, actor_id: actor, status: state.revoked ? 'revoked' : 'active', current: true }]);
      if (text.includes('from platform.module_definitions')) return rows([{ allowed: state.permission, evaluated_at: now(), module_definition_id: definition, entitlement_key: 'module.airprop_commercial' }]);
      if (text.includes('as actor_bound')) return rows([{ actor_bound: true, allowed: state.permission }]);
      if (text.startsWith('select actor_id,request_hash')) return rows(staged.ledger[values[1]] ? [staged.ledger[values[1]]] : []);
      if (text.includes('has_function_privilege')) return rows([{ allowed: state.gate }]);
      if (text.startsWith('insert into platform.idempotency_keys')) {
        staged.ledger[values[2]] = { actor_id: values[1], request_hash: values[3], response_ref: null, expires_at: new Date(Date.now() + 86400000) }; return rows([]);
      }
      if (text.startsWith('select customer_api.')) {
        staged.domain += 1;
        if (state.failure === 'mutation') throw new Error('mutation_failed');
        const idField = text.includes('listing') ? 'listing_id' : text.includes('reservation') ? 'reservation_id'
          : text.includes('obligation') ? 'schedule_id' : text.includes('commercial_execution') ? 'link_id'
          : text.includes('work_order') ? 'action_link_id' : 'mandate_request_id';
        return rows([{ result: { version: 1, idempotent: false, [idField]: randomUUID() } }]);
      }
      if (text.startsWith('insert into audit.events')) { staged.audit += 1; return rows([{ id: String(staged.audit) }]); }
      if (text.startsWith('insert into platform.outbox_events')) { staged.outbox += 1; return rows([{ id: randomUUID() }]); }
      if (text === 'select clock_timestamp()::text as now') return rows([{ now: now() }]);
      if (text.startsWith('update platform.idempotency_keys')) { staged.ledger[values[1]].response_ref = JSON.parse(values[2]); return rows([]); }
      throw new Error('unexpected_sql_in_contract_double');
    } };
  } };
}
export const persistedB2Effects = pool => ({ domain: pool.state.domain, audit: pool.state.audit,
  outbox: pool.state.outbox, idempotency: Object.keys(pool.state.ledger).length });
