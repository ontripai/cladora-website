const canonicalize = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};

export function fingerprint(value) {
  const input = canonicalize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `svc1:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

export function receiptEnvelope({ contract, intent, workspaceId, sourceKind, sourceId, sourceVersion,
  receiptId = 'f0000000-0000-4000-8000-000000000001', actorId = 'f0000000-0000-4000-8000-000000000002',
  bindingId = 'f0000000-0000-4000-8000-000000000003', authorityVersion = 1, ...payload }) {
  return {
    contract, version: 1, receipt_id: receiptId,
    source_identity: { kind: sourceKind, id: sourceId, version: sourceVersion },
    workspace_id: workspaceId,
    authority: { actor_reference_id: actorId, authority_version: authorityVersion, outcome: 'verified' },
    decision_status: 'verified', result_code: 'OK', reason_code: null,
    evaluated_at: '2026-10-11T12:00:00+00:00',
    idempotency_key: intent.idempotency_key,
    input_fingerprint: fingerprint(intent), idempotency_binding_id: bindingId,
    ...payload,
  };
}
