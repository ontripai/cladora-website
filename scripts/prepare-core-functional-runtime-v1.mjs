/** Exact, explicit independent install lineage. Not a migration-history replay. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const sourcePath='supabase/proposals/core-service-s01/store-v1.sql';
const source=readFileSync(new URL(sourcePath,root),'utf8');
const sourceHash='42d2c96d7ac7e8a09aa2ecc60725054eb7c058ef471e64ea309add0a1bb72d50';
assert.equal(createHash('sha256').update(source).digest('hex'),sourceHash,'accepted S01 source changed');
const tail='-- CORE_S01_PROOF_INSERTION_POINT\nROLLBACK;\n';
assert.ok(source.endsWith(tail));assert.equal(source.split(tail).length,2);
// All guards, definitions, owner/ACL/default assertions and exact body survive.
// This is a NEW install unit, explicitly COMMIT-capable; never edit the proof.
const output='-- core-functional-install.v1 / S01; isolated development admission required.\n'
 +'-- SOURCE_SHA256 '+sourceHash+'; history is independent, not applied original migration.\n'
 +source.slice(0,-tail.length)+'-- END_CORE15_S01_INSTALL_UNIT\nCOMMIT;\n';
const path=new URL('supabase/install/core-functional-runtime-v1/01-s01-store.sql',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(path,'utf8'),output,'S01 install unit stale');
else writeFileSync(path,output);
console.log(JSON.stringify({path:fileURLToPath(path),bytes:Buffer.byteLength(output),sha256:createHash('sha256').update(output).digest('hex'),sql_execution:'NOT_RUN'}));

// Separate, owner-authorized development installation lineage. The original
// Core12 review-only delta and its execution hold remain byte-identical. This
// successor RETAINS all eight exact pre/postimage/owner/ACL/default/dependency
// guards; only its explicit review-only envelope becomes a guarded dev installer.
const deltaPath='supabase/proposals/core-canonical-sqlstate-boundary-v1/delta.sql';
const delta=readFileSync(new URL(deltaPath,root),'utf8');
assert.equal(createHash('sha256').update(delta).digest('hex'),'2e9edd7e196c54b046f4a7dd71944473bffa2a8b24f2f8ec7f09f6318a4eb8ae');
const hold="DO $hold$ BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_review_only_execution_hold'; END $hold$;";
assert.equal(delta.split(hold).length,2);assert.ok(delta.endsWith('ROLLBACK;\n'));
const admission=`DO $core15_admission$ BEGIN
 IF current_database()!~'^cladora_dev_[a-z0-9_]+$' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'core15_development_install_admission_required' USING ERRCODE='55000'; END IF;
END $core15_admission$;`;
const installed='-- NEW core-functional-install.v1 / canonical SQLSTATE successor; original review-only source NOT executed.\n'
 +delta.replace(hold,()=>admission).slice(0,-'ROLLBACK;\n'.length)+'COMMIT;\n';
const deltaOutput=new URL('supabase/install/core-functional-runtime-v1/03-canonical-sqlstate.sql',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(deltaOutput,'utf8'),installed);else writeFileSync(deltaOutput,installed);
console.log(JSON.stringify({path:fileURLToPath(deltaOutput),bytes:Buffer.byteLength(installed),sha256:createHash('sha256').update(installed).digest('hex'),sql_execution:'NOT_RUN'}));
