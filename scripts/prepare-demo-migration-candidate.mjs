import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Candidate materializer only. No network, credentials, SQL execution, linking,
// grants or production target. Historical migration bytes remain unchanged.
const held = new Map([
  ['20261018163000_service_subject_link_role_bound_pool_privileged_v1.sql', 'requires separately privileged STEP-SU-02; SERVICE provider unavailable'],
  ['20261018170000_communications_service_role_acl_shutdown_v1.sql', 'requires authentic STEP-SU-02 receipt; separate deny-only proposal is not S4'],
  ['20261025214155_building_setup_command_receipts_v1.sql', 'inactive G2 installer; historical command recovery not installed'],
]);
export function prepareDemoCandidate(sourceRoot, destination) {
  const manifestBytes = readFileSync(join(sourceRoot, 'supabase/local-profiles/baseline-v14.manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.profile !== 'baseline-v14' || manifest.source_migrations.length !== 300) throw Error('unsupported baseline');
  const sourceDir = join(sourceRoot, 'supabase/migrations');
  const rows = manifest.source_migrations;
  const names = readdirSync(sourceDir).filter(n => n.endsWith('.sql')).sort();
  if (JSON.stringify(names) !== JSON.stringify(rows.map(r => r.name))) throw Error('inventory changed');
  for (const r of rows) if (createHash('sha256').update(readFileSync(join(sourceDir,r.name))).digest('hex') !== r.sha256) throw Error('source changed: ' + r.name);
  for (const name of held.keys()) if (!names.includes(name)) throw Error('held migration missing');
  const target = resolve(destination);
  if (target === resolve(sourceRoot) || target.startsWith(resolve(sourceRoot) + '/')) throw Error('destination inside source');
  if (existsSync(target) && readdirSync(target).length) throw Error('destination must be fresh');
  const config = readFileSync(join(sourceRoot, 'supabase/config.toml'), 'utf8');
  const projectLine = /^project_id[ \t]*=[ \t]*"cladora-local"[ \t]*$/gm;
  if ((config.match(projectLine) ?? []).length !== 1) throw Error('unexpected source target');
  const localConfig = config.replace(projectLine, 'project_id = "cladora-demo-candidate"');
  if ((localConfig.match(/^project_id[ \t]*=/gm) ?? []).length !== 1 ||
      !/^project_id = "cladora-demo-candidate"$/m.test(localConfig)) throw Error('unsafe candidate target');
  const receipt = {
    kind: 'DISTINCT_REDUCED_DEMO_CANDIDATE_NOT_S3_S4',
    accepted: false, executable_hosted: false, runtime: 'NOT_RUN_NOT_PASS',
    source_baseline_sha256: createHash('sha256').update(manifestBytes).digest('hex'),
    active_count: 297,
    active: rows.filter(r => !held.has(r.name)),
    held: rows.filter(r => held.has(r.name)).map(r => ({...r, reason: held.get(r.name), installed: false})),
    communications: 'DENY_ONLY_CLOSURE_REQUIRES_INDEPENDENT_NATIVE_PROOF',
    operations_backend: 'NOT_INSTALLED; CURRENT_MAINTENANCE_UI_BLOCKED',
    ce_pool: 'PRIVILEGED_FINALIZATION_NOT_PERFORMED',
    production_target: null,
  };
  mkdirSync(join(target, 'supabase/migrations'), {recursive: true});
  writeFileSync(join(target, 'supabase/config.toml'), localConfig);
  for (const r of receipt.active) copyFileSync(join(sourceDir, r.name), join(target, 'supabase/migrations', r.name));
  writeFileSync(join(target,'candidate.receipt.json'), JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw Error('usage: source-root fresh-local-destination');
  const r = prepareDemoCandidate(process.argv[2], process.argv[3]);
  console.log(JSON.stringify({kind:r.kind,active:r.active_count,held:r.held.map(x=>x.name),hosted_execution:false}));
}
