/** Narrow source checks, NOT SQL parser/compile/ACL/RLS proof. */
import assert from 'node:assert/strict';
import {composeCoreDocumentsCustodyV1,read,sha} from './prepare-core-documents-custody-packet-v1.mjs';
const packet=composeCoreDocumentsCustodyV1(),sql=read('install.sql');
const validate=s=>{
 for(const t of["command_wire text,command_sha256 text",'dispatch_started boolean NOT NULL DEFAULT false',"WITH CHECK(false)","c->>'authority_version' IS DISTINCT FROM r.authority_version::text",'r.command_wire<>wire',"r.final_key<>key",'stored.request_hash IS DISTINCT FROM r.command_sha256',"p_phase='dispatch' AND r.phase='sealed' AND NOT r.dispatch_started",'FOR UPDATE',"RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog"]){assert.ok(s.includes(t),t);}
 assert.doesNotMatch(s,/UPDATE\s+(platform\.idempotency_keys|audit\.events|platform\.outbox_events)|INSERT\s+INTO\s+(documents\.|platform\.idempotency_keys|audit\.|platform\.outbox_events)|ON\s+CONFLICT.*DO\s+UPDATE/i);
};
validate(sql);
for(const token of['dispatch_started boolean NOT NULL DEFAULT false','r.command_wire<>wire','r.final_key<>key','stored.request_hash IS DISTINCT FROM r.command_sha256','WITH CHECK(false)'])assert.throws(()=>validate(sql.replaceAll(token,'/* removed */')));
assert.equal((packet.sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((packet.sql.match(/^COMMIT;$/gm)||[]).length,1);assert.ok(packet.sql.indexOf('statement_timeout')<packet.sql.indexOf('DO $preflight$'));
assert.ok(packet.preflight.startsWith('BEGIN READ ONLY;')&&packet.preflight.endsWith('ROLLBACK;\n'));assert.ok(packet.verify.startsWith('BEGIN READ ONLY;')&&packet.verify.endsWith('ROLLBACK;\n'));
assert.equal((packet.verify.match(/documents_custody_body_mismatch/g)||[]).length,2);assert.ok(!packet.verify.includes('CORE_DOCUMENTS_BODY_PINS'));
assert.equal(packet.sql,composeCoreDocumentsCustodyV1().sql);
console.log(JSON.stringify({source_invariants:'PASS',coherent_removals_rejected:5,images:{install:{bytes:Buffer.byteLength(packet.sql),sha256:sha(packet.sql)},preflight:{bytes:Buffer.byteLength(packet.preflight),sha256:sha(packet.preflight)},verify:{bytes:Buffer.byteLength(packet.verify),sha256:sha(packet.verify)}},SQL_parser:false,SQL_execute:false,native:'NOT_RUN_NOT_PASS'}));
