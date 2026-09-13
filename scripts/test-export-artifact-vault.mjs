import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20260913162715_export_artifact_quarantine_scanner_gate.sql','utf8');
const materialize=fs.readFileSync('src/app/api/customer/v1/exports/[id]/route.ts','utf8');
const download=fs.readFileSync('src/app/api/customer/v1/exports/[id]/download/route.ts','utf8');
const errors=fs.readFileSync('src/lib/customer/export-artifact-errors.ts','utf8');
assert.match(migration,/export-artifact-vault','export-artifact-vault',false,5242880/);
assert.match(migration,/scan_status='scanning_pending'/);assert.match(migration,/p_verdict when 'clean' then 'clean'/);
assert.match(migration,/revoke all on function app_private\.record_export_artifact_scan_v1[\s\S]*from public,anon,authenticated/);
assert.match(migration,/grant execute on function app_private\.record_export_artifact_scan_v1[\s\S]*to service_role/);
assert.match(migration,/export_artifact_scan_pending/);assert.match(migration,/export_artifact_quarantined/);assert.match(migration,/export_artifact_scan_failed/);
assert.doesNotMatch(migration,/for (update|delete) to authenticated/i);
for(const source of [materialize,download]){assert.match(source,/hasTrustedMutationOrigin/);assert.match(source,/isApplicationJson/);assert.match(source,/parseJsonWithLimit/);assert.match(source,/getClaims/);assert.match(source,/no-store, private/);assert.doesNotMatch(source,/service.role|service_role/i)}
assert.match(materialize,/prepare_export_artifact_v2/);assert.match(materialize,/upsert:false/);assert.match(materialize,/status:evidence\.scan_status==='clean'\?200:202/);assert.doesNotMatch(materialize,/Content-Disposition/);
assert.match(download,/authorize_export_artifact_download_v1/);assert.match(download,/createSignedUrl/);
for(const lang of ['ro','en','fa'])assert.match(errors,new RegExp(`${lang}:\\{`));
console.log('Export artifact vault: private quarantine, fail-closed scanner and controlled download PASS.');
