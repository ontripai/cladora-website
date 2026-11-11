// New inactive packet only; no PG parser, SQL execution, Core/owner suite replay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPacket,loadSealedPacket,selectSourceMode,classifyRecovery,sha256,GUARD,INPUTS,DIR } from './prepare-airprop-listing-binding-adoption-v2.mjs';
const packet=buildPacket(),frames=new Map(Object.entries({...packet.units,'seal.json':packet.sealBytes}).map(([n,b])=>[n,Buffer.from(b)]));
const reader=n=>{if(!frames.has(n))throw Error('ABSENT_FRAME');return frames.get(n);};
const outer=sha256(packet.sealBytes),clone=()=>new Map([...frames].map(([n,b])=>[n,Buffer.from(b)]));
let groups=0;const check=(name,fn)=>{fn();console.log('PASS',++groups,name);};
const h=n=>String(n).repeat(64),lookup=m=>n=>m.get(n);
check('V2 packet distinct from checkpoint8ecb and source inputs pinned exactly',()=>{
 assert.equal(packet.seal.base,'067464d07cb08629adf59490febf6222f5c0d878');
 for(const x of packet.seal.inventory)assert.equal(sha256(readFileSync(x.path)),x.sha256);
 for(const [n,b] of frames)assert.equal(readFileSync(DIR+'/'+n,'utf8'),b.toString('utf8'));
 assert.equal(packet.seal.activation,null);assert.equal(packet.seal.sql_compiled,'NOT_RUN_NOT_PASS');
});
check('loader authenticates all actual bytes and exposes immutable source, no dispatch',()=>{
 const r=loadSealedPacket(reader,outer);assert.equal(r.status,'INACTIVE_SOURCE_VERIFIED');assert.equal(r.dispatch,null);assert.equal(r.activation,null);
 assert.equal(r.units.length,8);assert.equal(typeof r.units[0].utf8,'string');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.units[0]));
});
check('altered predecessor cannot be silently re-pinned to generate successor',()=>{
 const path=Object.keys(INPUTS)[0];assert.throws(()=>buildPacket(p=>Buffer.concat([readFileSync(p),Buffer.from(p===path?'\n':'') ])),/SOURCE_PIN/);
});
check('missing expected seal is not approval and modified seal fails identity',()=>{
 assert.throws(()=>loadSealedPacket(reader,null),/EXPECTED_SEAL_REQUIRED/);
 const f=clone();f.set('seal.json',Buffer.from(packet.sealBytes+' '));assert.throws(()=>loadSealedPacket(lookup(f),outer),/SEAL_IDENTITY/);
});
check('single-byte frame tamper/missing frame rejected before a caller receives SQL',()=>{
 const f=clone();f.set('adapt-v1.sql',Buffer.from(packet.units['adapt-v1.sql']+'\n'));assert.throws(()=>loadSealedPacket(lookup(f),outer),/FRAME_IDENTITY/);
 f.delete('adapt-v1.sql');assert.throws(()=>loadSealedPacket(lookup(f),outer));
});
check('coherent frame+manifest re-seal does not replace independently pinned outer identity',()=>{
 const f=clone(),seal=JSON.parse(packet.sealBytes),body=Buffer.from(packet.units['fresh.sql'].replace(GUARD,''));
 f.set('fresh.sql',body);const pin=seal.units.find(x=>x.name==='fresh.sql');pin.sha256=sha256(body);pin.bytes=body.length;
 f.set('seal.json',Buffer.from(JSON.stringify(seal)));assert.throws(()=>loadSealedPacket(lookup(f),outer),/SEAL_IDENTITY/);
 assert.throws(()=>loadSealedPacket(lookup(f),sha256(f.get('seal.json'))),/SEAL_SOURCE_OR_INVENTORY/);
});
check('all seven SQL units retain first unconditional guard and final rollback',()=>{
 const sql=Object.entries(packet.units).filter(([n])=>n.endsWith('.sql'));assert.equal(sql.length,7);
 for(const [,s] of sql){assert.ok(s.indexOf(GUARD)<s.indexOf('DO $gate$')||!s.includes('DO $gate$'));assert.ok(s.includes(GUARD));assert.ok(s.endsWith('ROLLBACK;\n'));assert.doesNotMatch(s,/\bCOMMIT\s*;/i);}
});
check('fresh requires absent object set, never CREATE IF NOT EXISTS over drift',()=>{
 const s=packet.units['fresh.sql'];assert.match(s,/FRESH_REQUIRES_ABSENT/);assert.doesNotMatch(s,/CREATE TABLE IF NOT EXISTS/i);
 assert.match(s,/fresh_before/);assert.match(s,/fresh_after/);assert.match(s,/CREATE TABLE airprop\.listing_selected_bindings_v1/i);
});
check('adapt is non-destructive exact-V1 path, no table recreation or row mutation',()=>{
 const s=packet.units['adapt-v1.sql'];assert.match(s,/ADAPT_REQUIRES_EXACT_V1/);
 assert.doesNotMatch(s,/\b(?:DROP TABLE|CREATE TABLE|UPDATE airprop|DELETE FROM|INSERT INTO|TRUNCATE airprop|GRANT|ALTER DEFAULT PRIVILEGES)\b/i);
 assert.match(s,/CREATE OR REPLACE FUNCTION airprop.guard_listing_selected_binding_v1/i);
 assert.doesNotMatch(s,/CREATE OR REPLACE FUNCTION airprop.assert_listing_selected_binding_c03_v1/i);
});
check('adapt rechecks same complete before-image after ACCESS EXCLUSIVE wait',()=>{
 const s=packet.units['adapt-v1.sql'],lock=s.indexOf('LOCK TABLE'),recheck=s.indexOf("p->>'v1_before'",lock),edit=s.indexOf('DO $adapt$');
 assert.ok(lock>0&&recheck>lock&&edit>recheck);assert.match(s,/adapt_after/);
});
check('storage references/helpers and Core Party revision are explicit preconditions',()=>{
 const s=packet.units['preflight-adapt.sql'];assert.match(s,/STORAGE_DEPENDENCY_ABSENT/);assert.match(s,/CORE_PARTY_REVISION_REQUIRED/);assert.match(s,/portfolio.unit_specification_versions/);assert.match(s,/app_private.active_tenant_id/);
});
check('two exact historical CHECK names+expressions required, not guessed generated names',()=>{
 const s=packet.units['adapt-v1.sql'];assert.match(s,/V1_CONSTRAINT_MAPPING_REQUIRED/);assert.match(s,/V1_CONSTRAINT_IMAGE_DRIFT/);
 assert.match(s,/c\.contype='c' and c\.convalidated/);assert.match(s,/pg_get_expr\(c.conbin,c.conrelid\)/);
 assert.match(s,/format\('ALTER TABLE airprop.listing_selected_bindings_v1 DROP CONSTRAINT %I',n\)/);
});
check('legacy CHECK branch retains exact old root/selection whitelists with no new versions',()=>{
 const s=packet.units['adapt-v1.sql'],v1=readFileSync(Object.keys(INPUTS)[0],'utf8');
 const oldRoot=v1.slice(v1.indexOf(' check(binding-array'),v1.indexOf(" check((binding->'selection')-array")).trim().replace(/,$/,'').slice(6,-1);
 const oldSelection=v1.slice(v1.indexOf(" check((binding->'selection')-array"),v1.indexOf('\n);')).trim().slice(6,-1);
 assert.ok(s.includes(oldRoot)&&s.includes(oldSelection));assert.match(s,/NOT \(binding \? 'binding_version'\) AND NOT \(\(binding->'selection'\) \? 'source_versions'\)/);
});
check('canonical original invoker function bodies must match before adaptation',()=>{
 const s=packet.units['adapt-v1.sql'];assert.match(s,/V1_FUNCTION_SOURCE_DRIFT/);assert.doesNotMatch(s,/__V1_GUARD_HASH__|__V1_RECEIPT_HASH__/);assert.match(s,/and not prosecdef/);
});
check('new legacy INSERT refused by guard, while existing rows are never rewritten',()=>{
 for(const name of ['fresh.sql','adapt-v1.sql']){
  const s=packet.units[name];assert.match(s,/new\.binding->'binding_version' IS DISTINCT FROM '2'::jsonb/);
  assert.match(s,/listing_selected_binding_v2_new_insert_required/);assert.match(s,/p.native_revision_v1=/);
  assert.doesNotMatch(s,/SET\s+binding\s*=|backfill\s*\(/i);
 }
});
check('all original immutable generated/FK/index/C03 history preserved in adaptation source',()=>{
 const s=packet.units['adapt-v1.sql'];assert.doesNotMatch(s,/DROP (?:COLUMN|INDEX|TRIGGER)|DISABLE TRIGGER|ALTER COLUMN/i);
 assert.doesNotMatch(s,/UPDATE (?:platform\.idempotency_keys|audit\.events|platform\.outbox_events)/i);
 const f=packet.units['fresh.sql'];assert.match(f,/DEFERRABLE INITIALLY DEFERRED/i);assert.match(f,/force row level security/i);
});
check('V2 source tuple remains numeric/exact and invalid new versions cannot be treated as legacy',()=>{
 const s=packet.units['adapt-v1.sql'];assert.match(s,/binding->'binding_version'='2'::jsonb/);
 assert.match(s,/source_versions,version}'='2'::jsonb/);assert.match(s,/between 1 and 9007199254740991/);
 assert.match(s,/specification_id}'\)::uuid=spec_id/);assert.match(s,/resource_version}'\)::integer=spec_version/);
});
check('before/after projection includes owner/ACL/RLS/FK/body/roles/default/event closure without passwords',()=>{
 for(const n of ['preflight-adapt.sql','verify-adapt.sql','recovery.sql']){
  const s=packet.units[n];for(const key of ['table','columns','constraints','indexes','triggers','policies','rules','functions','schemas','dependencies','helpers','roles','memberships','default_acl','events'])assert.ok(s.includes("'"+key+"'"));
  assert.match(s,/'body_sha256'/);assert.match(s,/'owner',pg_get_userbyid/);assert.match(s,/to_jsonb\(r\)-'rolpassword'/);
 }
});
check('fresh logical postimage excludes newly allocated OIDs while adaptation pins old object identity',()=>{
 const f=packet.units['fresh.sql'],a=packet.units['adapt-v1.sql'];
 assert.doesNotMatch(f,/'oid',|to_jsonb\(p\)|to_jsonb\(c\)|to_jsonb\(t\)/);
 assert.doesNotMatch(f,/v1_table_oid/);assert.match(a,/v1_table_oid/);assert.match(a,/v1_guard_oid/);assert.match(a,/v1_receipt_guard_oid/);
 assert.match(a,/EXISTING_OBJECT_IDENTITY_DRIFT/);
});
check('no observed target/owner/compiled catalog facts are fabricated in template',()=>{
 const p=JSON.parse(packet.units['private-plan.template.json']);
 for(const k of ['mode','database_name','database_oid','executor','session','fresh_before','v1_before','fresh_after','adapt_after'])assert.equal(p[k],null);
 assert.equal(p.activation,null);assert.equal(p.v1_constraints.root_keys.name,null);
});
check('mode selection rejects unknown/partial before fresh or adaptation',()=>{
 const p={before:h(1),expectedFresh:h(1),expectedV1:h(2),expectedV2:h(3)};
 assert.equal(selectSourceMode({...p,presence:[false,false,false]}).status,'FRESH_SOURCE_CANDIDATE');
 assert.equal(selectSourceMode({...p,before:h(2),presence:[true,true,true]}).status,'V1_ADAPT_SOURCE_CANDIDATE');
 assert.equal(selectSourceMode({...p,presence:[true,false,true]}).status,'PARTIAL_INSTALL_STOP');
 assert.equal(selectSourceMode({...p,before:null,presence:[false,false,false]}).status,'BLOCKED_INPUT');
 assert.equal(selectSourceMode({...p,before:h(4),presence:[true,true,true]}).status,'PREIMAGE_UNKNOWN_OR_DRIFT_STOP');
 assert.equal(selectSourceMode({...p,before:h(3),presence:[true,true,true]}).status,'ALREADY_PRESENT_REVERIFY');
});
check('ACK lost + before/after comparisons never authorize retry or settle a business UNKNOWN',()=>{
 const p={before:h(1),after:h(2),expectedAfter:h(2)};
 const r=classifyRecovery(p);assert.equal(r.status,'POSTIMAGE_REVERIFY_REQUIRED');assert.equal(r.settlement,'unknown');assert.equal(r.repeat,false);assert.equal(r.business_unknown,'UNCHANGED');
 assert.equal(classifyRecovery({...p,after:h(1)}).status,'BEFORE_IMAGE_PRESERVED');assert.equal(classifyRecovery({...p,after:h(3)}).status,'DRIFT_STOP');
 assert.equal(classifyRecovery({...p,after:null}).status,'BLOCKED_INPUT');assert.equal(classifyRecovery({...p,settlement:'COMMITTED_FROM_METADATA'}).status,'BLOCKED_SETTLEMENT');
});
console.log(JSON.stringify({groups,layer:'SOURCE_AND_OFFLINE_BYTES_ONLY',SQL_PG_parse_compile_run:'NOT_RUN_NOT_PASS',native:'NOT_RUN_NOT_PASS',old_packet27_Core13_consumer14:'NOT_REPEATED'}));
