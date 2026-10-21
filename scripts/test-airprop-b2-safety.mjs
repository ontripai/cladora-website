import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProtectedDirectory } from './lib/airprop-b2-safety-guard.mjs';

const files = ['src/lib/airprop/artifact-b2-contract.ts', 'src/lib/airprop/artifact-b2-runtime.ts',
  'src/lib/airprop/artifact-b2-api.ts', 'src/lib/airprop/artifact-b2-portfolio.ts',
  'src/app/api/customer/v2/airprop/artifact-b2/route.ts', 'src/components/customer/CustomerAirpropB2.tsx'];
const text = files.map(path => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(text, /service_role|SUPABASE_DB|new Pool\(|grant\s+execute|create\s+table|schema\('documents'\)/i);
assert.doesNotMatch(readFileSync(files[5], 'utf8'), /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
const runtime = readFileSync(files[1], 'utf8');
assert.match(runtime, /import \{ resolveAuthority \} from '\.\.\/core\/current-authority-postgres-provider-v1'/);
assert.match(runtime, /createCorePostgresTransactionHostV1\(pool\)/);
assert.doesNotMatch(runtime, /insert into|update\s+platform|new Map|authorityCache/i);
assert.doesNotMatch(runtime, /validateReplay|replay_policy|replay_provider_code/,
  'AIRPROP remains on Core authority-only replay and must not invoke the replay hook');
assert.match(readFileSync(files[4], 'utf8'), /runtime: null/);
assert.match(readFileSync(files[0], 'utf8'), /commands: null, can_edit: false/);

const migrationCutoff = '20261012190924';
const migrationVersion = path => {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(path);
  assert.ok(match, `AIRPROP B2 migration safety: invalid migration path: ${path}`);
  return match[1];
};
const migrationResult = validateProtectedDirectory({
  directory: 'supabase/migrations',
  // Includes the four byte-exact PM control-plane migrations recovered from
  // the applied Production ledger on 2026-10-18.
  expectedProtectedCount: 251,
  expectedProtectedDigest: '11b52ba4747d2fdf2e46b55e7fd9af3e69330b2d82cbadf2e89f0d161762d6ff',
  isProtected: path => migrationVersion(path) <= migrationCutoff,
  reviewedAdditions: {
    '20261013062342_service_request_subject_context_v1.sql': {
      owner: 'SERVICE / PR #375',
      sha256: 'c8555ccaacd3964c7667d82bcbe904619fdda697a2e37f44870242c8cbc58e04',
    },
    '20261013063739_document_reference_exact_workspace_v1.sql': {
      owner: 'Documents/Vault / PR #379',
      sha256: '988a8ddea361421cf6d75700ac3b0332c59ef0e10862201d2c2da0db48f91c51',
    },
    '20261013120000_communications_private_message_subject_provider_v1.sql': {
      owner: 'CE Communications / PR #377',
      sha256: '339b1b88e89072fd95c0e07a8821084877c722c4f121bb6f0a16dfde73f96080',
    },
    '20261013145654_service_request_subject_provider_v2.sql': {
      owner: 'SERVICE / PR #383',
      sha256: 'a4765535e180c39c633afb4a8b4f03c898c25c91ec31a906e73aa780c036ae98',
    },
    '20261013150000_communications_private_message_request_audience_gate_v1.sql': {
      owner: 'CE Communications / PR #386',
      sha256: 'aa90a34c3f2671fe39c20c8b0c131ef85b5d06c433341fa4c6ffba61f59869e7',
    },
    '20261013170242_service_request_subject_link_v1.sql': {
      owner: 'SERVICE / PR #385',
      sha256: '2741a7128096bcc7aa14c0ea28acf1fc8142a76d6103306e347ad225ad0869e8',
    },
    '20261014082947_experience_guide_storage_lifecycle_v1.sql': {
      owner: 'CE / PR #395',
      sha256: '5d951a6938d8737041c6c7272f2dc40d1abe289d005afc85a7c871330116a0e5',
    },
    '20261014083050_document_workspace_binding_writer_v1.sql': {
      owner: 'Documents / PR #396',
      sha256: '1e7b64b5e623b9ca9f3eee43e1b41ac61f9fe9be008d1c59fa90e68d9ed3804d',
    },
    '20261014132000_experience_guide_child_publish_lock_v1.sql': {
      owner: 'CE / PR #404',
      sha256: '3ffa7e694eec72d6cf7e1bb5e813e21cb65ce6e4519ac4025931dbfdfe820ab6',
    },
    '20261014200948_document_null_workspace_creation_closure_v1.sql': {
      owner: 'Documents / PR #406',
      sha256: '5d8b2b6d68868001e7fdc6085c87aabe5568917d271a84192734c9643e8496e8',
    },
    '20261015100000_core_platform_role_bound_pool_v1.sql': {
      owner: 'Core / PR #409',
      sha256: 'ff944f72f3a5396c57afeeaec0406ec480f859d00ef8736b00c64f14d905e641',
    },
    '20261015183000_core_jurisdiction_profile_v1.sql': {
      owner: 'Core / PR #419',
      sha256: '924b577b18e6e70d149272e3f193c23d4c5d83db81b2f1f3b51950e0d1ce74c7',
    },
    '20261015203723_core_jurisdiction_domain_artifact_resolver_v1.sql': {
      owner: 'Core / PR #431',
      sha256: '483c88f52f884e7b3a1af5dd2671f5a2ac72f539c55a361a7801a545f0c0c7b8',
    },
    '20261016080831_core_read_authority_profile_v1.sql': {
      owner: 'Core / PR #448',
      sha256: '5e4ca3cf9c84a0604a55c2a30612aee30b54df40a5c94e74225967b42e14e422',
    },
    '20261018060834_database_advisor_performance_hardening_v1.sql': {
      owner: 'Database / PR #460',
      sha256: '0ee2e9c82375b134c78485ba51b6dc97b4b0523925208e1db06cb9d0b063acab',
    },
    '20261018092958_documents_legacy_creation_rpc_shutdown_v1.sql': {
      owner: 'Documents / D1',
      sha256: 'd14a34f39242e2d05b16a713faa4fca1d5d45c2f59795495300046f6f6d39438',
    },
    '20261018094131_documents_canonical_storage_identity_v1.sql': {
      owner: 'Documents / D2',
      sha256: '34b1ea7f98ef235db3113775d3bee660f8de021768a8217ba2dcc208aceacf8b',
    },
    '20261018130000_documents_replacement_promotion_after_clean_v1.sql': {
      owner: 'Documents / D3-D4',
      sha256: '896d54f54b6a531f7c65a45198257b99471c8c05afc216cb8768247d8215d249',
    },
    '20261018133000_documents_vault_download_exact_workspace_v2.sql': {
      owner: 'Documents / D5',
      sha256: '38640d7d60b122966a8e18fe1a56d643f60022b4722998b70a1d8619c2d9c6a4',
    },
    '20261018140000_communications_private_conversation_workspace_binding_v1.sql': {
      owner: 'Documents + Communications / D5',
      sha256: '2a3edc9d1f757afc0bff43a4c1a19cfeac0c8d9dca6eaac0204f68cf4fb970f0',
    },
    '20261018143000_communications_document_attachment_workspace_gate_v2.sql': {
      owner: 'Documents + Communications / D6',
      sha256: 'a64fcd8e3e101b453b9b547fbe385b808ea8f4b024bdbbda2f3ba6da35cf8ee1',
    },
    '20261018150000_documents_retention_lifecycle_workspace_gate_v2.sql': {
      owner: 'Documents / D7',
      sha256: '53ca525fbd9970cc7260e28c60cf6e956c58e1e02cd33f63ef07c9337cc8436a',
    },
    '20261018151500_documents_service_role_acl_cleanup_v1.sql': {
      owner: 'Documents / D8',
      sha256: '756852f145ef156f1afba777b08f6bf2f179bef9c17dc033e078eea99993f56b',
    },
    '20261018153000_communications_private_message_currentness_gate_v2.sql': {
      owner: 'SERVICE + Communications / S1',
      sha256: '123c7335044bb96c3ba6e9d705ca4536d1103efb36216ac80ae6331616e2bbc3',
    },
    '20261018160000_service_request_message_link_finalizer_v2.sql': {
      owner: 'SERVICE / S2',
      sha256: 'b493ced51cb543182bf9b02b428ddce77a8585d40b6abadc7b6a4f2185eb0b73',
    },
    '20261018163000_service_subject_link_role_bound_pool_privileged_v1.sql': {
      owner: 'SERVICE + Core / S3',
      sha256: 'f48ca618b0ff959b5f6e15c73ec9b778d91c189c1772787b2b57edacabeb4a24',
    },
    '20261018170000_communications_service_role_acl_shutdown_v1.sql': {
      owner: 'SERVICE + Communications / S4',
      sha256: '85cf0be289620aba101497919884304619cfb39d53874c38c0132ee3b4f33800',
    },
    '20261019170121_dw02_canonical_unit_reference_v1.sql': {
      owner: 'Core / DW02',
      sha256: 'a3e78a3b9973cc0bce1ea381b3831cf04fe38f07689801e545890215718c09a6',
    },
    '20261019183450_pc01_product_capability_projection_v1.sql': {
      owner: 'Core / PC01',
      sha256: '5de49ca29500c30b0fde3be314be3c5269de34f92b303f05e451a5afd64593d3',
    },
    '20261019193000_pf01_owner_portfolio_projection_v1.sql': {
      owner: 'Core / PF01',
      sha256: 'abad17b3ee8aa4783247dac60b0eb24b71782794617743d22a569b19f82b6aba',
    },
    '20261019194632_ops01_service_execution_request_v1.sql': {
      owner: 'Operations / OPS01',
      sha256: 'ef5ec215c7c8cf94749aff310fdd637e1e0753e6c6e58ed750dbe822bfd67682',
    },
    '20261019210500_fin01_service_quote_proposal_projection_v1.sql': {
      owner: 'Finance / FIN01',
      sha256: '32d77a144ca88424b88d67956ba4cdddb7ec1812d0729efa0ebceeb6ff615bec',
    },
    '20261019221500_com01_private_conversation_request_receipt_v1.sql': {
      owner: 'Communications / COM01',
      sha256: '9277409a94fa0e57d01f31b3af77f8579ed6751094f0237d0841067e9f77168d',
    },
    '20261019230000_bk01_c13_amenity_capacity_v1.sql': {
      owner: 'Booking + C13 / BK01-C13',
      sha256: '4921797f0c10282b5eb21f3caf2977a5e16b2e6580c88da6da04a760740541b7',
    },
    '20261019233000_c14_workspace_cost_benchmark_v1.sql': {
      owner: 'Finance / C14',
      sha256: 'd4c6c010725755aa271c8b513b1fafeae52e159588be9d4cbeb939e5e2f49f47',
    },
    '20261019234500_c15_observed_savings_evidence_v1.sql': {
      owner: 'Finance / C15',
      sha256: '724acdb5a57f91bdc7200e7e204ae2801f95e1d5c9a4cf943ecfb8cafa00198e',
    },
    '20261021045324_core_mobile_payment_exact_replay_current_authority_v1.sql': {
      owner: 'Core / bounded handoff R2 / PR #466',
      sha256: 'f2946847392129e5e1c91b3b79310d939d9e141fa105580dd94e68efe48dd6c5',
    },
    '20261021045651_documents_canonical_unit_link_v1.sql': {
      owner: 'Documents/Vault / bounded canonical Unit handoff / PR #466',
      sha256: '7c3ecb5058cf910ba29e75b50f33985b11fcb1009d48b1ae7be73435704f2401',
    },
    '20261021045809_ce_communications_canonical_unit_v1.sql': {
      owner: 'CE / bounded canonical Unit handoff / PR #466',
      sha256: '47749ef20155547a3c82a3dcb18f9fee8daa405a28c40cecb036394d04be5263',
    },
    '20261021071420_advisor_finance_governance_sql_v1.sql': {
      owner: 'Coordinator / bounded Finance-Governance Advisor correction / PR #466',
      sha256: '4ab9d74120d7b8215050f43566134a747d73f1e10fdb7a62ed40f31b49fa5a66',
    },
    '20261021093426_assets_explicit_caller_descriptor_v1.sql': {
      owner: 'Coordinator / byte-preserved Assets caller descriptors / PR #466',
      sha256: '9ce4834d26553eee8fad21c3e9f792f7e4de1d002c5e3c6f4a0be4adc37bdc18',
    },
    '20261021085559_assets_current_authority_v1.sql': {
      owner: 'Coordinator / runtime-proven Assets temporal authority correction / PR #466',
      sha256: 'ae14aa13d047ab5f3309a795000827eae8eae27236d6fabd98334fc69f8962c3',
    },
  },
  label: 'AIRPROP B2 migration baseline',
});

const coreResult = validateProtectedDirectory({
  directory: 'src/lib/core',
  expectedProtectedCount: 13,
  expectedProtectedDigest: '7502bf811cb4959cd7f7c1ade651b8020b3e99cb0d76a0667caf7fbdedb2c3be',
  isProtected: path => ![
    'communications-private-message-subject-provider-v1.ts',
    'communications-private-message-request-audience-provider-v1.ts',
    'current-unit-property-selector-v1.ts',
    'jurisdiction-domain-artifact-v1.ts',
    'jurisdiction-domain-artifact-resolver-v1.ts',
    'jurisdiction-domain-artifact-transaction-evidence-v1.ts',
    'jurisdiction-profile-selector-v1.ts',
    'jurisdiction-profile-v1.ts',
    'platform-role-bound-pool-v1.ts',
    'postgres-transaction-host-v1.ts',
    'read-authority-profile-v1.ts',
    'transaction-replay-provider-hook-v1.ts',
    'operations-execution-receipt-v1.ts',
    'product-rights-v1.ts',
  ].includes(path),
  reviewedAdditions: {
    'communications-private-message-subject-provider-v1.ts': {
      owner: 'CE Communications / PR #377',
      sha256: '832a9481232662e3411a67ff9b2b81f8a5a842af4795381a1837faa5a2cb6248',
    },
    'communications-private-message-request-audience-provider-v1.ts': {
      owner: 'CE Communications / PR #386',
      sha256: '487aa0fd69f3e5222870cfead3ab2e0a97bb239a9240099f0d6fe027934b96e2',
    },
    'current-unit-property-selector-v1.ts': {
      owner: 'Core / PR #417',
      sha256: 'cf8649d0196c4d87e6bb17a756ab24194faddd1cec382cde97e17c5466c55dcd',
    },
    'jurisdiction-domain-artifact-v1.ts': {
      owner: 'Core / PR #428',
      sha256: '8ec7d8b4a0d0ef80ffdbb06f48b9c5cb65c0fc8fa5c8b0fd0f42cc0e746fd168',
    },
    'jurisdiction-domain-artifact-resolver-v1.ts': {
      owner: 'Core / PR #431',
      sha256: '285770357c485b8cd05121f30f9220d765d4d14ba017066c179b62745c348e69',
    },
    'jurisdiction-domain-artifact-transaction-evidence-v1.ts': {
      owner: 'Core / PR #431',
      sha256: 'e30ced9821eb8f8cc99dac45b1ae1461d46d53e34f1a7cdae774c55d54281981',
    },
    'jurisdiction-profile-selector-v1.ts': {
      owner: 'Core / PR #423',
      sha256: '279c75fc6b0401836fbad5268fcc6ca5b51a16878b2d712f1502adda25b268ad',
    },
    'jurisdiction-profile-v1.ts': {
      owner: 'Core / PR #419',
      sha256: '70781991127452ce50f7b6974f6c68edd06508ab2ac13366001c162873438487',
    },
    'platform-role-bound-pool-v1.ts': {
      owner: 'Core / PR #409',
      sha256: 'd31f3b31a1302686d8022627475b2e14057cd36fff219a8b4441ff052798fc79',
    },
    'read-authority-profile-v1.ts': {
      owner: 'Core / PR #448',
      sha256: '0b32914d66e743e4148882d88e9cc06bffee56686fbd355236eafd84aaa9c75d',
    },
    'transaction-replay-provider-hook-v1.ts': {
      owner: 'Core / PR #399',
      sha256: 'eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4',
    },
  },
  reviewedReplacements: {
    'operations-execution-receipt-v1.ts': {
      owner: 'Operations / OPS01',
      historicalSha256: '67a99ae64afc5791013e49d7212930eee7a93243f52dd60acb2e0b5be8c04a27',
      sha256: 'f372097ede71c525d963e3ab6b9cd11d1a5ca117b95c8abb6cc47d84c40b9bc5',
    },
    'product-rights-v1.ts': {
      owner: 'Core / PC01',
      historicalSha256: '780199a5be7b5e44ef2c620cf83e8570c583b337b37c5da9295e1c30badcaebd',
      sha256: '0a150e396c76ddff9d9757c2e06174b3177c11c60126ef525b2a46c084a70ae6',
    },
    'postgres-transaction-host-v1.ts': {
      owner: 'Core / PR #431',
      historicalSha256: 'eb89d03320549a721a54df10fa747f8977d9f42f6dfaa2e85ae89e1265c37d7c',
      sha256: 'ce0360f30f1c49ff06e8ec944ba7263e0012c56fb2c27e5094d6604a1cf09a6e',
    },
  },
  historicalProtectedCount: 16,
  historicalProtectedDigest: '9239ad3ef818b3ada7ec0f4cc2171179bd394ca1422fceab090280c95adf9331',
  label: 'AIRPROP B2 Core baseline',
});

console.log('PASS B2 safety: canonical provider/host reuse and inactive production remain closed; protected migration/Core baselines are immutable; reviewed additions present:', {
  migrations: migrationResult.reviewedAdditionsPresent,
  core: coreResult.reviewedAdditionsPresent,
  coreReplacements: coreResult.reviewedReplacementsPresent,
  historicalCoreBaseline: {
    count: coreResult.historicalProtectedCount,
    digest: coreResult.historicalProtectedDigest,
  },
});
