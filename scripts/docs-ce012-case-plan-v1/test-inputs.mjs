// Controlled source inputs only. These explicit synthetic identities/references
// are not installed rows, issued sessions or committed receipts. Compiler never
// calls this fixture builder or generates identities.
export function makeInputs(api) {
  const id = n => `39000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const platform = { contract: api.PLATFORM_INPUT_CONTRACT, consumer: 'PLATFORM-DOCS-CE012-PGAUTH-BIND-05',
    custody: { run_id: 'cladora-lane-0123456789ab', custody_nonce: 'a'.repeat(32),
      database: 'docs_ce012_0123456789abcdef', database_oid: '100', system_identifier: '200' },
    database_provenance_sha256: '1'.repeat(64),
    auth_provenance: { origin: 'http://127.0.0.1:9999', actor_id: id(1), session_id: id(2),
      assurance_level: 'aal2', source_evidence_sha256: '2'.repeat(64) },
    observed_at: '2026-11-02T08:00:01.000Z',
    harness: { source_commit: api.HARNESS_SOURCE, request_sha256: api.HARNESS_REQUEST_SHA256,
      runtime_closure_sha256: api.RUNTIME_CLOSURE_SHA256 } };
  const tenant = id(3), workspace = id(4);
  const cases = api.CASE_NAMES.map((name, i) => {
    const n = 100 + i * 20;
    const target = { document_id: id(n + 1), document_version_id: id(n + 2), document_version: 2 };
    const guide = { contract: 'ce012-guide-command.v1', version: 1, command_id: id(n + 3), action: 'save_draft',
      context_id: id(n + 4), workspace_id: workspace, guide_id: id(n + 5), expected_guide_version: 5,
      payload: { title: 'Synthetic guide', step_id: id(n + 6), step_title: 'Read', instructions: 'Synthetic fixture only.',
        document_target: { ...target, label: 'Caller label is not download authority' } },
      idempotency_key: `ce012-plan-fixture-${i}` };
    guide.payload_fingerprint = api.canonicalGuidePayloadFingerprint(guide);
    const cmd = { contract_version: 'core-transaction-command.v2', transaction_id: id(n + 7),
      command_id: guide.command_id, context_id: guide.context_id, workspace_id: workspace,
      actor_id: platform.auth_provenance.actor_id, authority_version: 7,
      permission_code: 'experience.guide.manage', module_code: 'experience_guides', evaluation_purpose: 'experience.guide.command',
      aggregate_type: 'experience_guide', aggregate_id: guide.guide_id, aggregate_version: 6,
      provider_source_ids: [guide.guide_id, target.document_id, target.document_version_id],
      idempotency_key: guide.idempotency_key, input_fingerprint: guide.payload_fingerprint,
      subject_reference: { kind: 'experience.guide', id: guide.guide_id, version: 5, relation: 'save_draft', request_version: 1 } };
    const historical = name.startsWith('historical_'), replaced = historical || name === 'replaced_fresh';
    return { name, source_artifact_sha256: '3'.repeat(64), command: cmd, guide_command: guide,
      documents_authority_request: { contract_version: 'core-current-authority-transaction-port-request.v1',
        decision_id: id(n + 8), context_id: cmd.context_id, workspace_id: workspace,
        actor_id: cmd.actor_id, authority_version: 7, permission_code: 'documents.vault.read', module_code: 'documents',
        evaluation_purpose: 'documents.reference.read', transaction_context: { transaction_id: cmd.transaction_id,
          command_id: cmd.command_id, attempt: 1, isolation_level: 'serializable', lock: { kind: 'command_aggregate',
            workspace_id: workspace, aggregate_type: cmd.aggregate_type, aggregate_id: cmd.aggregate_id,
            acquired_at: '2026-11-02T08:00:00.000Z' } } },
      core_fixture_source_sha256: '4'.repeat(64), context_membership_id: id(n + 9),
      guide: { id: guide.guide_id, tenant_id: tenant, workspace_id: workspace, version: historical ? 6 : 5, status: 'draft' },
      document: { id: target.document_id, tenant_id: tenant, workspace_id: name === 'cross_workspace' ? id(999) : workspace,
        current_version: replaced ? 3 : 2, status: 'active', deleted_at: null, archived_at: null, disposition_status: 'retained' },
      document_version: { id: target.document_version_id, tenant_id: tenant, document_id: target.document_id, version: 2,
        scanning_status: name === 'quarantined' ? 'quarantined' : 'clean', checksum_status: 'verified', sha256: '5'.repeat(64) },
      permissions: [{ id: id(n + 10), tenant_id: tenant, document_id: target.document_id, membership_id: id(n + 9),
        permission: 'view', valid_from: '2026-10-01T00:00:00.000Z', valid_until: null }],
      scan_attestation: { version_id: target.document_version_id, tenant_id: tenant, provider: 'clamav',
        verdict: name === 'quarantined' ? 'quarantined' : 'clean', content_sha256: '5'.repeat(64),
        scanned_at: '2026-11-01T00:00:00.000Z', recorded_at: '2026-11-01T00:00:00.000Z' },
      receipt_id: null, receipt_hash: null, historical_reference: null };
  });
  const documents = { contract: api.DOCUMENTS_INPUT_CONTRACT, platform_input_sha256: api.contentHash(platform),
    custody: structuredClone(platform.custody), tenant_id: tenant, cases };
  return { platform, documents };
}
export function historicalReference(c) {
  const g = c.guide_command, t = g.payload.document_target;
  return { source_contract: 'core-transaction-receipt.v2', source_store: 'platform.idempotency_keys.response_ref',
    ce_contract: 'ce012-guide-command.v1', core_receipt_id: '39000000-0000-4000-8000-000000009001',
    core_receipt_hash: '6'.repeat(64), ce_save_receipt_id: '39000000-0000-4000-8000-000000009002',
    binding: { command_id: g.command_id, context_id: g.context_id, workspace_id: g.workspace_id, guide_id: g.guide_id,
      document_id: t.document_id, document_version_id: t.document_version_id, document_version: t.document_version,
      expected_guide_version: g.expected_guide_version, payload_fingerprint: g.payload_fingerprint, idempotency_key: g.idempotency_key } };
}
