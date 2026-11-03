/** Text/JSON/hash/contract tests only. No SQL parser/compiler, database or subprocess runner. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='supabase/install/v14-operations/',read=p=>readFileSync(p,'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
const ident=s=>({bytes:Buffer.byteLength(s),sha256:sha(s),git_blob:createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex')});
const manifest=JSON.parse(read(root+'manifest.json'));
const files=Object.fromEntries(manifest.units.map(u=>[u.unit,read(u.payload.path)]));
let checks=0;const ok=(condition,reason)=>{checks++;assert.ok(condition,reason);};
// Narrow statement-boundary invariants, NOT a PostgreSQL grammar/parser.
function observationDeadlines(s){
 const begin=s.indexOf('begin isolation level repeatable read read only;');
 const first=s.indexOf('select jsonb_build_object(');
 ok(begin>=0&&first>begin,'observation transaction');
 for(const [name,value] of [['lock_timeout','5s'],['statement_timeout','60s']]){
  const pattern=new RegExp("^set local "+name+"='"+value+"';$",'gm');
  const matches=[...s.matchAll(pattern)];
  ok(matches.length===1&&matches[0].index>begin&&matches[0].index<first,'bounded early '+name);
  ok([...s.matchAll(new RegExp('^set(?: local)? '+name+'\\b','gm'))].length===1,'no deadline reset '+name);
 }
}
function transformedStatementBoundaries(m,f){
 let narrowed=0;
 for(const u of m.units){
  const s=f[u.unit];
  ok(!/alter\s+table[^;]*enable\s+row\s+level\s+security\s+where\b/i.test(s),'RLS statement must not have WHERE');
  for(const o of u.source_origins){
   if(o.kind!=='canonical_selected_compatibility_rows')continue;
   narrowed++;
   const raw=read(o.source).split(/(?<=\n)/).slice(o.lines[0]-1,o.lines[1]).join('');
   ok(raw.match(/;/g)?.length===1&&/^insert into platform\.module_(property_profile|operating_model)_compatibilities/.test(raw)&&raw.trimEnd().endsWith(';'),'single canonical INSERT range');
   const expected=raw.trimEnd().slice(0,-1)+"\nwhere m.code='maintenance';\n";
   const actual=Buffer.from(s).subarray(o.output_byte_start,o.output_byte_start+o.output_byte_length).toString();
   ok(actual===expected,'WHERE remains inside selected INSERT');
  }
 }
 ok(narrowed===2,'all narrowed compatibility transformations enumerated');
}
function verify(m,f){
 transformedStatementBoundaries(m,f);
 ok(m.base==='8c8225fb3297035a2349357bd968d60779388063','BASE');
 ok(m.default_no_execute&&m.EXECUTION_HOLD&&['native_binding','execution_binding','operator_binding'].every(k=>m[k]===null),'execution hold');
 ok(JSON.stringify(m.order)===JSON.stringify(['foundation','assets','maintenance-procurement','building-provisioning']),'unit order');
 for(const u of m.units){
  const s=f[u.unit],i=ident(s);ok(['bytes','sha256','git_blob'].every(k=>i[k]===u.payload[k]),'payload identity');
  ok(!/alter\s+default\s+privileges/i.test(s),'ND0 no default mutation');
  ok(s.startsWith('-- Operations independent inactive install unit: '+u.unit),'unit identity');
  ok(s.includes('\nbegin;\n')&&s.includes('\ncommit;\n'),'explicit transaction source');
  ok(s.indexOf('pg_advisory_xact_lock')<s.indexOf('-- COMPLETE CATALOG OBSERVATION'),'single writer before observation/effects');
  ok(s.includes('operations_install_external_binding_or_prestate_required')&&s.includes('cladora.install.prestate_sha256'),'fresh prestate binding');
  ok(s.includes('operations_managed_complete_delta')&&s.includes('operations_unmapped_managed_trigger'),'managed boundary');
  for(const field of ['columns','constraints','indexes','policies','triggers_both_FK_sides','types','enum_order','routines','sequences','rewrite','dependencies','shared_dependencies','default_acl'])ok(s.includes("'"+field+"'"),'catalog field '+field);
  ok(s.includes('reltoastrelid')&&s.includes('confkey=array[')&&s.includes("x.tgrelid='auth.users'::regclass"),'TOAST and referenced-side FK closure');
  const close=s.lastIndexOf('end; $oc1$;'),commit=s.lastIndexOf('\ncommit;');
  ok(close>0&&close<commit&&s.includes('operations_default_acl_delta')&&s.includes('operations_unexpected_column_acl'),'OC1 and ND0 closure-before-commit');
  ok(!/\bgrant\s+(?:execute|select|usage|all|insert|update|delete)/i.test(s.slice(close)),'no late positive grant');
  ok(s.indexOf('operations_routine_catalog_identity_mismatch')>close&&s.indexOf('operations_routine_catalog_identity_mismatch')<commit&&(!u.declarations.enums.length||s.includes('operations_enum_order_mismatch')),'source catalog assertion before commit');
  ok(s.includes("'commit_acknowledged',false,'runtime_active',false"),'precommit result is not COMMIT/activation');
  for(const o of u.source_origins){
   const fragment=Buffer.from(s).subarray(o.output_byte_start,o.output_byte_start+o.output_byte_length);
   ok(fragment.length===o.output_byte_length&&sha(fragment)===o.output_sha256,'selected effect output bytes');
   if(o.source){const raw=readFileSync(o.source);ok(sha(raw)===o.source_sha256,'pinned physical source');
    if(o.kind==='accepted_effect')ok(sha(raw.subarray(o.byte_start,o.byte_start+o.byte_length))===o.sha256,'accepted effect range');
    if(o.kind==='canonical_range')ok(sha(raw.toString().split(/(?<=\n)/).slice(o.lines[0]-1,o.lines[1]).join(''))===o.sha256,'canonical range');
    if(o.kind==='canonical_declaration')ok(sha(raw.subarray(o.byte_start,o.byte_start+o.byte_length))===o.sha256,'canonical declaration');
   }
  }
  for(const r of u.ordered_routine_declarations){const [start,length]=r.source_bytes;ok(sha(Buffer.from(s).subarray(start,start+length))===r.declaration_sha256,'ordered declaration identity');}
  // Declaration-name census only: it is not a SQL AST or a catalog closure proof.
  const names=[...s.matchAll(/^create (?:or replace )?function\s+([a-z0-9_.]+)\s*\(/gim)].map(x=>x[1]);
  ok(JSON.stringify(names)===JSON.stringify(u.ordered_routine_declarations.map(r=>r.name)),'no extra/missing routine effect');
 }
 const a=f['maintenance-procurement'];
 ok(a.includes("'context_id',(e->>'context_id')::uuid,'state'")&&a.includes("before_c-'authority_revision' is distinct from (pending.response_ref->'authority_at_reservation')-'authority_revision'"),'OPEN original Context and full current tuple');
 for(const required of ['platform.idempotency_keys','audit.events','platform.outbox_events',"'operations-command-receipt.v1'",'operations_domain_receipt_invariant',"p_phase in ('reserve','execute') and pending.key",'operations_resource_unresolved_command',"'infinity'",'operations_unresolved_command'])ok(a.includes(required),'C03 invariant '+required);
 ok(!/create\s+table[^;]*(?:operations_command|operations_receipt)/i.test(a),'no parallel command ledger');
 ok(a.includes("current_setting('transaction_isolation') is distinct from 'read committed'"),'currentness snapshot');
 ok(a.includes('for update;\n  perform app_private.require_request_session_current_at_v1(clock_timestamp());'),'legacy admission serialized before pending scan');
 ok(!/exception\s+when\s+others/i.test(a.slice(a.indexOf('create function app_private.operations_command_v1'))),'no adapter catchall');
 ok(m.owner_decisions.length===2&&m.owner_decisions.every(d=>d.status==='PROPOSED_NOT_APPROVED'),'owner decisions not auto-approved');
 for(const p of [...m.source_dependencies,...m.protected_proof,...m.support])ok(JSON.stringify(ident(readFileSync(p.path)))===JSON.stringify({bytes:p.bytes,sha256:p.sha256,git_blob:p.git_blob}),'dependency/support immutable identity');
}
verify(manifest,files);
for(const name of ['preflight.sql','verify.sql'])observationDeadlines(read(root+name));
const negative=[];
function reject(name,unit,change,reason){
 const m=structuredClone(manifest),f={...files};f[unit]=change(f[unit]);assert.ok(f[unit]!==files[unit],'negative mutation anchor must exist: '+name);
 // Reseal all payload identities: rejection must be the targeted invariant, not a stale file hash.
 Object.assign(m.units.find(u=>u.unit===unit).payload,ident(f[unit]));
 assert.throws(()=>verify(m,f),new RegExp(reason));negative.push(name);
}
reject('coherent-default-mutation','assets',s=>s.replace('\ncommit;',"\nalter default privileges grant execute on functions to public;\ncommit;"),'ND0 no default mutation');
reject('coherent-late-active-grant','assets',s=>s.replace('\ncommit;',"\ngrant execute on all functions in schema customer_api to authenticated;\ncommit;"),'no late positive grant');
reject('coherent-transaction-closure-gap','assets',s=>s.replace('end; $oc1$;','end; $not_closed$;'),'OC1 and ND0 closure-before-commit');
reject('coherent-missing-managed-assertion','assets',s=>s.replaceAll('operations_managed_complete_delta','unbounded'),'managed boundary');
reject('coherent-missing-dependency-observation','assets',s=>s.replaceAll("'shared_dependencies'","'discarded'"),'catalog field shared_dependencies');
reject('coherent-extra-routine-effect','assets',s=>s.replace('\ncommit;',"\ncreate function customer_api.unapproved() returns integer language sql as $$select 1$$;\ncommit;"),'no extra/missing routine effect');
reject('coherent-canonical-effect-change','assets',s=>s.replace('asset_hard_delete_prohibited','changed_hard_delete_prohibited'),'selected effect output bytes');
// An unresealed wrong hash is independently rejected.
const wrong=structuredClone(manifest);wrong.units[0].payload.sha256='0'.repeat(64);assert.throws(()=>verify(wrong,files),/payload identity/);negative.push('unresealed-wrong-hash');
reject('coherent-ALTER-WHERE-boundary','maintenance-procurement',s=>s.replace('alter table platform.module_dependencies enable row level security;',"alter table platform.module_dependencies enable row level security where m.code='maintenance';"),'RLS statement must not have WHERE');
const contaminated=structuredClone(manifest);const operating=contaminated.units.find(u=>u.unit==='maintenance-procurement').source_origins.find(o=>o.kind==='canonical_selected_compatibility_rows'&&o.lines[0]===1431);operating.lines=[1431,1443];assert.throws(()=>verify(contaminated,files),/single canonical INSERT range/);negative.push('coherent-source-range-contains-following-ALTERs');
for(const name of ['preflight.sql','verify.sql'])for(const deadline of ['lock_timeout','statement_timeout']){
 const original=read(root+name),value=deadline==='lock_timeout'?'5s':'60s',line=`set local ${deadline}='${value}';\n`;
 for(const [label,change] of [
  ['missing',s=>s.replace(line,'')],
  ['zero',s=>s.replace(line,`set local ${deadline}='0';\n`)],
  ['late',s=>s.replace(line,'').replace('rollback;',line+'rollback;')],
  ['nonlocal',s=>s.replace(line,`set ${deadline}='${value}';\n`)],
  ['reset',s=>s.replace('rollback;',`set local ${deadline}='0';\nrollback;`)],
 ]){const mutated=change(original);assert.ok(mutated!==original);assert.throws(()=>observationDeadlines(mutated),new RegExp('bounded early '+deadline+'|no deadline reset '+deadline));negative.push(name+':'+deadline+':'+label);}
}
const p=JSON.parse(read('package.json')),l=JSON.parse(read('package-lock.json'));
ok(p.dependencies.next==='16.4.1'&&p.dependencies.zod==='4.6.6','patched direct dependency pins');
for(const [path,entry] of Object.entries(l.packages))if(path==='node_modules/next'||path==='node_modules/@next/env'||path.startsWith('node_modules/@next/swc-'))ok(entry.version==='16.4.1'&&entry.integrity&&entry.resolved.endsWith('-16.4.1.tgz'),'coherent Next env SWC lock');
ok(l.packages['node_modules/zod'].version==='4.6.6'&&l.packages['node_modules/zod'].integrity,'Zod exact lock');
console.log(JSON.stringify({task:'236-1',result:'PASS',checks,negative_tests:negative,scope:'text/JSON/hash/selected-source/contract only; not SQL syntax or PG compiled catalog',SQL_parser_compile_execute:'NOT_RUN_NOT_PASS',new_dependency_clean_install_audit_build:'NOT_RUN_NOT_PASS'},null,2));
