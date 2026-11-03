// Controlled SQL boundary only. Executes NO SQL and proves NO schema/ACL/trigger,
// native lock, scanner, Storage custody or durable PostgreSQL effect. Receipts
// are produced exclusively by the real Core host, not authored by this model.
export function createDocumentsUploadAckSqlModelV1(ids) {
  let durable = { intents: new Map(), documents: new Map(), versions: new Map(), keys: new Map(), audit: [], outbox: [], access: [] };
  const calls = [];
  const control = { revoked: false, allowed: true, aal: 'aal2', actor: ids.actor, revision: 7,
    commitLoss: false, wrongMutation: false, providerExpired: false, retry40001: false };
  const one = row => ({ rows: [row], rowCount: 1 });
  const none = () => ({ rows: [], rowCount: 0 });
  const now = () => new Date().toISOString();
  const allowed = p => !control.revoked && control.allowed && p[0] === ids.context
    && p[1] === ids.workspace && p[2] === 'documents.vault.upload' && p[3] === 'documents';
  let sequence = 100;
  const pool = { async connect() {
    let staged = null;
    return { release() {}, async query(sql, p = []) {
      const t = sql.replace(/\s+/g, ' ').trim(); calls.push({ text: t, values: structuredClone(p) });
      if (t === 'begin isolation level serializable') { staged = structuredClone(durable); return { command: 'BEGIN', rows: [], rowCount: 0 }; }
      if (t === 'commit') {
        if (control.retry40001) { control.retry40001 = false; throw Object.assign(Error('controlled serialization'), { code: '40001' }); }
        durable = staged; staged = null;
        if (control.commitLoss) { control.commitLoss = false; throw Object.assign(Error('controlled ACK loss'), { code: '08006' }); }
        return { command: 'COMMIT', rows: [], rowCount: 0 };
      }
      if (t === 'rollback') { staged = null; return { command: 'ROLLBACK', rows: [], rowCount: 0 }; }
      if (t.startsWith('set local') || t.includes('pg_advisory_xact_lock')) return one({});
      if (!staged) throw Error('query outside controlled transaction');
      if (t.includes('select txid_current()::text as id')) return one({ id: String(++sequence), now: now() });
      // Host/authority transaction id must refer to the same fixture connection.
      if (t.includes('as transaction_id') && t.includes('transaction_isolation')) return one({ transaction_id: String(sequence), actor_id: control.actor, isolation: 'serializable', evaluated_at: now() });
      if (t.includes('canonical_authority_revision_v1')) return one({ revision: String(control.revision) });
      if (t.includes('m.user_id::text as actor_id')) return p[0] === ids.context ? one({ tenant_id: ids.tenant, actor_id: ids.actor, status: control.revoked ? 'revoked' : 'active', current: !control.revoked }) : none();
      if (t.includes('from platform.customer_workspaces')) return p[0] === ids.workspace ? one({ tenant_id: ids.tenant }) : none();
      if (t.includes('from platform.module_definitions')) return one({ allowed: allowed(p), evaluated_at: now(), module_definition_id: ids.module, entitlement_key: 'module.documents' });
      if (t.includes('as actor_bound')) return one({ actor_bound: control.actor === p[0], allowed: allowed(p.slice(1)) });
      if (t.includes("auth.jwt()->>'aal'" ) && !t.includes('from documents')) return one({ valid: control.actor === p[0] && control.aal === 'aal2' });
      if (t.includes('select actor_id,request_hash,response_ref,expires_at')) {
        const row = staged.keys.get(p[1]); return row ? one(row) : none();
      }
      if (t.startsWith('select $1::timestamptz')) {
        return one({ valid: Date.parse(p[0]) > Date.now() && Date.parse(p[0]) <= Date.now() + 900000
          && !staged.documents.has(p[1]) && !staged.intents.has(p[2]) });
      }
      if (t.includes('from documents.upload_intents ui where ui.id=')) {
        const i = staged.intents.get(p[0]);
        return i ? one({ valid: !control.providerExpired && i.tenant === p[1] && i.context === p[2]
          && i.workspace === p[3] && i.actor === p[4] && i.document === p[5]
          && p[6] === 'document-vault' && i.path === p[7] && i.mime === p[8] && i.size >= p[9]
          && i.status === 'authorized' && i.expires > Date.now() && !staged.documents.has(p[5]) && !staged.versions.has(p[10]) }) : none();
      }
      if (t.startsWith('select exists(') && t.includes('join documents.documents')) {
        const i = staged.intents.get(p[0]), d = staged.documents.get(p[5]), v = staged.versions.get(p[10]);
        return one({ valid: Boolean(i && d && v && i.status === 'consumed' && i.workspace === p[3] && i.actor === p[4]
          && i.committedVersion === p[10] && d.workspace === p[3] && d.title === p[11] && d.type === p[12]
          && d.classification === p[13] && v.sha === p[14] && v.mime === p[15] && v.tx === p[16]
          && v.command === p[17] && v.object === p[18] && v.generation === p[19] && v.etag === p[20]
          && control.actor === p[4] && control.aal === 'aal2' && !control.revoked), now: now() });
      }
      if (t.startsWith('insert into platform.idempotency_keys')) {
        if (staged.keys.has(p[2])) throw Error('controlled duplicate');
        staged.keys.set(p[2], { actor_id: p[1], request_hash: p[3], expires_at: new Date(Date.now() + 86400000) }); return one({});
      }
      if (t.startsWith('insert into documents.upload_intents')) {
        staged.intents.set(p[0], { tenant: p[1], context: p[2], actor: p[3], path: p[4], mime: p[5], size: p[6],
          key: p[7], expires: Date.parse(p[9]), workspace: p[10], document: p[11], status: 'authorized' });
        return one({ mutation_id: control.wrongMutation ? ids.other : p[0] });
      }
      if (t.includes("set_config('documents.canonical_storage_identity_v1'")) return one({});
      if (t.startsWith('update documents.upload_intents')) {
        const i = staged.intents.get(p[0]); if (!i || i.status !== 'authorized') return none();
        i.status = 'consumed'; i.committedVersion = p[4]; return one({});
      }
      if (t.startsWith('insert into documents.documents')) {
        staged.documents.set(p[0], { workspace: p[2], title: p[3], type: p[4], classification: p[5] }); return one({});
      }
      if (t.startsWith('insert into documents.document_versions')) {
        staged.versions.set(p[0], { document: p[2], path: p[3], sha: p[4], mime: p[5], size: p[6], tx: p[9], command: p[10],
          object: p[12], generation: p[13], etag: p[14], scan: 'deferred' });
        return one({ mutation_id: control.wrongMutation ? ids.other : p[0] });
      }
      if (t.startsWith('insert into documents.access_events')) { staged.access.push(p); return one({}); }
      if (t.startsWith('insert into audit.events')) { staged.audit.push(p); return one({ id: String(staged.audit.length) }); }
      if (t.startsWith('insert into platform.outbox_events')) { staged.outbox.push(p); return one({ id: ids.outbox }); }
      if (t === 'select clock_timestamp()::text as now') return one({ now: now() });
      if (t.startsWith('update platform.idempotency_keys set response_ref=')) { staged.keys.get(p[1]).response_ref = JSON.parse(p[2]); return one({}); }
      throw Error(`Unexpected controlled SQL: ${t}`);
    } };
  } };
  return { pool, control, calls, read: () => structuredClone(durable),
    counts: () => [durable.intents.size, durable.documents.size, durable.versions.size, durable.keys.size,
      durable.audit.length, durable.outbox.length, durable.access.length] };
}
