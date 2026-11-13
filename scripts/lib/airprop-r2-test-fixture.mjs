// Controlled transport only. Real Core R2 modules; no SQL/Auth/network target.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire, Module } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { id, scope, sourceRow } from './airprop-listing-flow-test-fixture.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), require = createRequire(import.meta.url);
export function r2Loader(mocks = {}) {
  const cache = new Map();
  const load = input => {
    let file = resolve(root, input); if (!existsSync(file)) file += '.ts';
    const rel = file.slice(root.length + 1);
    if (Object.hasOwn(mocks, rel)) return mocks[rel];
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); mod.filename = file; cache.set(file, mod);
    if (extname(file) === '.json') { mod.exports = JSON.parse(readFileSync(file, 'utf8')); return mod.exports; }
    mod.require = name => name === 'server-only' ? {} : Object.hasOwn(mocks, name) ? mocks[name]
      : name.startsWith('@/') ? load('src/' + name.slice(2)) : name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
    mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, file); return mod.exports;
  }; return load;
}
export function createAirpropR2ReadFixture(mocks = {}) {
  const x = { calls: [], guards: 0, authCalls: 0, rows: 1, specs: true, foreign: false, fault: null,
    clock: '2026-11-02T09:00:00.000000Z', completed: '2026-11-02T09:00:00.000100Z',
    expires: '2026-11-02T10:00:00.000000Z', aal: 'aal1' };
  const auth = { auth: { async getUser() { x.authCalls++; return { data: { user: { id: id(3) } }, error: null }; },
    async getClaims() { return { data: { claims: { sub: id(3), session_id: id(60), role: 'authenticated', aal: x.aal, exp: 4102444800 } }, error: null }; } } };
  const load = r2Loader({ 'src/lib/supabase/server.ts': { async createClient() { return auth; } }, ...mocks });
  const core = load('src/lib/core/airprop-read-host-v1.ts'), sql = core.CORE_READ_HOST_SQL;
  const q = load('src/lib/core/airprop-read-selector-queries-v1.ts').CORE_AIRPROP_READ_SELECTOR_SQL_V1;
  const native = load('src/lib/airprop/listing-native-read-v1.ts');
  const principal = { executor: 'synthetic_read_executor', runtime: 'synthetic_read_runtime' };
  const pool = { async connect() {
    const c = new EventEmitter(); c.release = destroy => { assert.equal(destroy, true); queueMicrotask(() => c.emit('end')); };
    c.query = async (text, values = []) => {
      x.calls.push({ text, values }); if (x.fault?.sql === text) throw x.fault.error;
      const result = (rows, command = 'SELECT') => ({ rows, rowCount: rows.length, command });
      if (text === sql.principal) return result([{ ...principal, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false }]);
      if (text.startsWith('set ')) return result([], 'SET');
      if (text === 'begin isolation level serializable') return result([], 'BEGIN');
      if (text === 'commit') return result([], 'COMMIT'); if (text === 'rollback') return result([], 'ROLLBACK');
      if (text === sql.identity || text === sql.session) return result([{}]);
      if (text === sql.revision) return result([{ revision: '7' }]);
      if (text === sql.resolve) return result([{ tenant_id: id(6), workspace_id: scope.workspace_id, membership_id: id(40) }]);
      if (text === sql.lock) return result([{ ...scope, tenant_id: id(6), membership_id: id(40), actor_id: id(3) }]);
      if (text === sql.guard) { x.guards++; return result([{ ...scope, tenant_id: id(6), membership_id: id(40), actor_id: id(3),
        database_transaction_id: '77', backend_pid: 80, authority_revision: '7', allowed: true, scope_current: true,
        checked_at: x.clock, scope_expires_at: x.expires, session_guard: '' }]); }
      if (text === sql.completed) return result([{ backend_pid: 80, completed_at: x.completed, unexpired: true }]);
      if (text === native.LISTING_NATIVE_PAGE_SQL) {
        const row = sourceRow(); return result(x.rows ? [{ listing_id: row.listing_id, tenant_id: row.tenant_id, workspace_id: row.workspace_id,
          property_id: row.property_id, unit_id: row.unit_id, listing_version: row.listing_version, status: row.status,
          available_from: row.available_from, available_until: row.available_until }] : []);
      }
      if (text === q.binding) return result([{ id: id(80), status: 'active', valid_from: '2026-01-01T00:00:00.000000Z', valid_to: null }]);
      if (text === q.ancestry) return result([{ unit_id: id(9), building_id: id(81), property_id: x.foreign ? id(99) : id(8), tenant_id: id(6),
        unit_status: 'active', building_status: 'active', property_status: 'active', scope_type: 'tenant', scope_property_id: null, scope_building_id: null, scope_unit_id: null }]);
      if (text === q.spec) return result(x.specs ? [{ id: id(55), version: 4, unit_id: id(9), building_id: id(81), tenant_id: id(6) }] : []);
      if (text.startsWith('select pg_catalog.to_char(pg_catalog.clock_timestamp()')) return result([{ at: x.clock }]);
      throw Error('Unexpected controlled SQL');
    }; return c;
  } };
  const host = core.createCoreAirpropReadHostV1({ pool, principal });
  // Synthetic complete companion ONLY for consumer wiring tests. Core R2 does
  // NOT produce this; no live Party/version/permission is claimed.
  const producer = { async bindSelector() { throw Error('GET_MUST_NOT_USE_COMMAND_RECEIPT'); },
    async readCanonical(_scope, _server, _row, _after, selected) {
      assert.equal(selected.status, 'selected'); assert.equal(selected.canonical_companion, null);
      assert.equal(selected.binding.specification_id, id(55));
      return { core: sourceRow().core, current_until: '2026-11-02T09:30:00.000000Z' };
    } };
  return { x, load, core, q, native, pool, principal, host, producer, auth };
}
