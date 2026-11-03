/** Pure source/identity invariants. No SQL parser, compile, connection or install. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {deriveCore15NativePayloadV1,originalTargetGuard,developmentTargetGuard} from './lib/core15-install-payload.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const m=JSON.parse(read('supabase/install/core-functional-runtime-v1/manifest.json'));
let n=0;function check(name,f){f();console.log(`PASS ${++n} ${name}`);}
const digest=b=>createHash('sha256').update(b).digest('hex');
check('all ordered install source identities are exact; no asserted native success',()=>{
 assert.equal(m.Platform12.FullSHA,'794f5a12c3928ae0a3585ab679a3cbe60aab49a3');
 assert.equal(m.Platform12.target.purpose,'owned-isolated-synthetic-development');assert.equal(m.native_results,'NOT_RUN_NOT_PASS');assert.equal(m.units.length,14);
 for(const [i,u] of m.units.entries()){const b=readFileSync(new URL(u.path,root));assert.equal(i+1,u.order);assert.equal(b.length,u.bytes);assert.equal(digest(b),u.sha256);assert.equal(execFileSync('git',['hash-object','--stdin'],{input:b,encoding:'utf8'}).trim(),u.git_blob);const payload=u.payload_transform?Buffer.from(deriveCore15NativePayloadV1(b.toString('utf8'),u.entry_guc_unit)):b;assert.equal(payload.length,u.payload.bytes);assert.equal(digest(payload),u.payload.sha256);}
});
check('new S01 unit preserves accepted WHOLE definition and all guards; explicit install boundary only',()=>{
 const original=read('supabase/proposals/core-service-s01/store-v1.sql'),out=read('supabase/install/core-functional-runtime-v1/01-s01-store.sql');
 const tail='-- CORE_S01_PROOF_INSERTION_POINT\nROLLBACK;\n';assert.ok(original.endsWith(tail));
 assert.ok(out.includes(original.slice(0,-tail.length)));assert.ok(out.endsWith('-- END_CORE15_S01_INSTALL_UNIT\nCOMMIT;\n'));
});
check('original Core12 hold intact; derived dev successor retains exact entire canonical delta/checks',()=>{
 const original=read('supabase/proposals/core-canonical-sqlstate-boundary-v1/delta.sql'),out=read('supabase/install/core-functional-runtime-v1/03-canonical-sqlstate.sql');
 const hold="DO $hold$ BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_review_only_execution_hold'; END $hold$;";
 assert.ok(original.includes(hold));const start=out.indexOf('DO $core15_admission$'),end=out.indexOf('END $core15_admission$;',start)+'END $core15_admission$;'.length;
 assert.ok(start>0&&end>start);const recovered=out.slice(out.indexOf('-- CORE-CANONICAL-SQLSTATE-BOUNDARY-12'),start)+hold+out.slice(end,-'COMMIT;\n'.length)+'ROLLBACK;\n';assert.equal(recovered,original);
});
function access(sql){assert.doesNotMatch(sql,/alter\s+default\s+privileges|alter\s+role|bypassrls\s*;|grant\s+all/i);
 for(const pattern of [/REVOKE ALL ON FUNCTION app_private.lock_core_request_session_v1\(\)/,/row_security_active\('auth.sessions'/,/has_column_privilege\(current_user,'auth.sessions','id','UPDATE'\)/,/FOR SHARE;/,/WITH CHECK\(false\)/,/core_functional_default_acl_delta/,/core_functional_extra_acl/])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/GRANT[^;]+ON\s+(?:TABLE\s+)?auth\.sessions[^;]+TO\s+cladora_core_runtime/is);
 assert.doesNotMatch(sql,/exception\s+when\s+others/i);
}
const unit=read('supabase/install/core-functional-runtime-v1/02-session-runtime-access.sql');
check('closed runtime access/source guard invariants',()=>access(unit));
for(const [name,changed] of [['default ACL mutation',unit+'\nALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;'],['missing explicit close',unit.replace('REVOKE ALL ON FUNCTION app_private.lock_core_request_session_v1()','-- removed close')],['missing row-lock owner prerequisite',unit.replace("has_column_privilege(current_user,'auth.sessions','id','UPDATE')","true")],['runtime Auth direct grant',unit+'\nGRANT SELECT ON auth.sessions TO cladora_core_runtime;'],['catch-all privilege fallback',unit+"\nexception when others then return true;"]])check(`coherent semantic negative (not hash): ${name}`,()=>assert.throws(()=>access(changed)));
check('verify and recovery identities exact',()=>{for(const x of [m.verify,m.recovery]){const b=readFileSync(new URL(x.path,root));assert.equal(b.length,x.bytes);assert.equal(digest(b),x.sha256);}});

check('four native images preserve ALL body/ACL/owner300 bytes, with exact guard replacement counts 1/1/2/1',()=>{
 for(const u of m.units.filter(u=>u.payload_transform)){const before=read(u.path),after=deriveCore15NativePayloadV1(before,u.entry_guc_unit);assert.equal(after.split(developmentTargetGuard).join(originalTargetGuard),before);assert.equal(after.includes('ryygcqiunqqtfkpkflzf'),false);}
});
check('missing/extra native target guard fails, not a silent first-occurrence replacement',()=>{
 const before=read('supabase/install/v14-operations/maintenance-procurement.sql');
 assert.throws(()=>deriveCore15NativePayloadV1(before.replace(originalTargetGuard,'true'),'maintenance-procurement'));
 assert.throws(()=>deriveCore15NativePayloadV1(before+'\n'+originalTargetGuard,'maintenance-procurement'));
});
check('complete checkpoint inventory and separate native session evidence match exact bytes',()=>{
 assert.equal(digest(JSON.stringify(m.inventory)),m.inventory_seal_sha256);
 for(const x of m.inventory){const b=readFileSync(new URL(x.path,root));assert.equal(b.length,x.bytes);assert.equal(digest(b),x.sha256);}
 const e=JSON.parse(read(m.session_cut.evidence));assert.equal(e.native_state,'PASS_REAL_AUTH_PG_SESSION_SLICE_ONLY');
 assert.equal(digest(readFileSync(new URL(m.session_cut.source,root))),e.module_sha256);
 assert.equal(Object.keys(e.checks).length,9);assert.ok(Object.values(e.checks).every(x=>x===true));
 for(const x of m.session_cut.units)assert.equal(digest(readFileSync(new URL(x.path,root))),x.sha256);
});
console.log(JSON.stringify({checks:n,native:'NOT_RUN_NOT_PASS_FOR_FULL_SERVICE_INSTALL',task_complete:false}));
