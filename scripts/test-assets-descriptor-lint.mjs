import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const filename = '20261021093426_assets_explicit_caller_descriptor_v1.sql';
const manifest = [
  {
    "name": "assets.list_assets_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "920e501c20eee60e0ec154fdaff969ef89508f80dc7597f93665ca4ec1397743"
  },
  {
    "name": "assets.get_asset_detail_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "ab9f9a5df262eea6c1920ba29845db431b49caf082eb72c352cc4b3a5222dbdf"
  },
  {
    "name": "assets.create_asset_internal_v1",
    "source": "20261004083417_asset_registration_scope_guard.sql",
    "sha256": "ff840252d6ee6ecd132639ca29ad5d130f09f9eb127a5835e2f62909f022fb4f"
  },
  {
    "name": "assets.update_asset_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "57f17befe21280d088b7d33cf93aa0403d756e686d3a2e5d0de61b86334c3fd4"
  },
  {
    "name": "assets.transition_asset_lifecycle_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "fcdfd4457402191c4dc0da14a183fffb4498beca4da75d10cf673be415d4fd16"
  },
  {
    "name": "assets.update_asset_operational_status_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "65a823b5e782707955062b1de1658fadc8b98b3546c709afa7c4c1353a6f0415"
  },
  {
    "name": "assets.start_asset_downtime_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "623256cbe45d36305b229f51ac5aba391e27e25dd3adf578197a5a980fcc429a"
  },
  {
    "name": "assets.end_asset_downtime_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "6200edb70c1e5fefaeb9abc59e24bbe8c3b4fe5fecc53368525fbc2a5cdba6be"
  },
  {
    "name": "assets.list_asset_inspections_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "f8a418db7fc9794e1e88ae387c40306a41107722885833e0a051219cdad351fd"
  },
  {
    "name": "assets.record_asset_inspection_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "d8ee8d8ba76a0c775449995b17bbea2c1bfa2b0566315cc46dc9b86ac6b9e880"
  },
  {
    "name": "assets.verify_asset_inspection_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "2dc85f702fa7ee888485be7341744d9276715b1655d3c487717e2edb2025f209"
  },
  {
    "name": "assets.get_asset_warranty_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "ab55e58ee2ee3e5334d3751d57a3aefdeb2be9fa7d5c3ca90de90772ccb319e6"
  },
  {
    "name": "assets.upsert_asset_warranty_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "4fafb7114f43afc8cc537870fa47514bf7662d3a0bbc22631a2c31003929778b"
  },
  {
    "name": "assets.list_warranty_claims_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "4ea8cb31a67d710b6f959a64184497bab2f9c7bae9092a8ebb1a489896cc962f"
  },
  {
    "name": "assets.create_warranty_claim_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "d22bc9d615ce7969d2fcd93af42bdb2a93532cc4765d14dddac9924ea794e07b"
  },
  {
    "name": "assets.resolve_warranty_claim_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "9a421ed88b2bbadaa6ce27f4c22c6defa4892be36dcb6a2f9394aa7f0f78eaff"
  },
  {
    "name": "assets.list_compliance_policies_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "3ffdd58b4d93c02d620095002afbca624f8c20e315352c50adb1f9338a404039"
  },
  {
    "name": "assets.configure_compliance_policy_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "f17ad47ea27b478aada4794b67308fafd18b81b4097811278c8319e23a5652c2"
  },
  {
    "name": "assets.request_asset_decommission_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "a90fc85bb7fb111d85ec540531afc524f6b0bef01e915623a76d0b2cc78a472d"
  },
  {
    "name": "assets.approve_asset_decommission_internal_v1",
    "source": "20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql",
    "sha256": "f644d14876b4b08d4f10c0bdae6ed4d8a7f0a3eee15207973b46245adef3b299"
  },
  {
    "name": "assets.registration_context_v1",
    "source": "20261004084822_asset_equipment_registration_gateway.sql",
    "sha256": "2abc1526b1b43dc4fabf33255aac7b193264413053ea21a43d784084b306c754"
  },
  {
    "name": "assets.registration_choices_v1",
    "source": "20261004084822_asset_equipment_registration_gateway.sql",
    "sha256": "9944144309a5489298fd419f6ed29c439bb09b7a2705c04a191ff3d0593091ec"
  },
  {
    "name": "assets.register_equipment_v1",
    "source": "20261004084822_asset_equipment_registration_gateway.sql",
    "sha256": "d118c338f64da8c8c5809e1fec272801c142cc7385b7b72be9024a2a3927bfa7"
  }
];
const descriptor = 'tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid';
const sql = readFileSync('supabase/migrations/' + filename, 'utf8');
function definitions(source) {
  return [...source.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (assets\.[a-z0-9_]+)\([\s\S]*?\$(function)?\$;/gi)];
}
const history = new Map();
for (const name of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql') && name < filename).sort()) {
  for (const match of definitions(readFileSync('supabase/migrations/' + name, 'utf8'))) {
    history.set(match[1].toLowerCase(), { source: name, body: match[0] });
  }
}
const after = definitions(sql);
assert.equal(after.length, 23);
assert.deepEqual(after.map(match => match[1]), manifest.map(item => item.name));
for (const [index, item] of manifest.entries()) {
  const original = history.get(item.name);
  assert.ok(original, item.name);
  assert.equal(original.source, item.source);
  assert.equal(createHash('sha256').update(original.body).digest('hex'), item.sha256);
  const assignment = /\b(v_caller|v)\s*:=\s*(assets\.(?:check_asset_caller_v1|registration_context_v1)\([^;]+\));/g;
  const matches = [...original.body.matchAll(assignment)];
  assert.equal(matches.length, 1, item.name + ': exactly one original record assignment');
  const expected = original.body.replace(/^create (?:or replace )?function/i, 'CREATE OR REPLACE FUNCTION')
    .replace(assignment, (_all, variable, call) => 'select typed_caller.* into ' + variable + '\n  from ' + call + '\n    as typed_caller(' + descriptor + ');');
  assert.equal(after[index][0].replace(/^create or replace function/i, 'CREATE OR REPLACE FUNCTION'), expected,
    item.name + ': only explicit caller descriptor changes; all domain logic/signature/security attributes preserved');
}
assert.doesNotMatch(sql, /\b(?:grant|revoke|alter|drop)\s|create\s+(?:table|type|schema|role|policy)\b/i);
assert.equal(createHash('sha256').update(readFileSync('supabase/tests/215_assets_actual_role_probe_v1_test.sql')).digest('hex'),
  '0ef1f5bc3e8a07f08826b551ab908ac21ea83d39494520aa6ec2884f9d3716fa');
const probe = readFileSync('supabase/tests/218_assets_descriptor_actual_role_v1_test.sql', 'utf8');
assert.match(probe, /^begin;$/m);
assert.match(probe, /set local role authenticated;/);
assert.match(probe, /set local row_security=on;/);
assert.match(probe, /SQL-session JWT fixture only/);
assert.match(probe, /select \* from finish\(\);\s*rollback;\s*$/);
assert.equal((probe.match(/^select throws_ok\(/gm) ?? []).length, 22 * 8);
assert.equal((probe.match(/^savepoint temporal_case;$/gm) ?? []).length, 6);
assert.doesNotMatch(probe.replace(/--[^\n]*/g, ''), /security\s+definer|\b(?:grant|revoke)\b|row_security\s*=\s*off|select\s+(?:skip|todo)\s*\(/i);
console.log(JSON.stringify({ suite: 'assets-explicit-descriptor', definitions: 23,
  domainLogicBytePreserved: true, originalPgTapAssertionsPreserved: 72,
  publicWrapperDenialCases: 176, runtime: 'NOT_RUN_NOT_PASS' }));
