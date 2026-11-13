/** Narrow source proof only: CASE delimiter and exact parent reconstruction.
 * No SQL parser/PGlite/PG/compiler, Auth or native execution. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),parent='c39824bc0cd77cf52f8a831c14d4d186ca477b0a';
const hash=s=>createHash('sha256').update(s).digest('hex'),base='supabase/proposals/core-finance-invoice-decisions-v2/';
const before=path=>execFileSync('git',['show',parent+':'+path],{cwd:root,encoding:'utf8'}),current=path=>readFileSync(resolve(root,path),'utf8');
function unwrap(s){let count=0;const value=s.replace(/\(CASE\b[\s\S]*?\bEND\)/g,m=>{count++;return m.slice(1,-1);});return{value,count};}
// Delimiter source model only: PL/pgSQL IF scans SQL through THEN at parenthesis
// depth zero. This is not a SQL grammar implementation or compilation witness.
function firstThen(fragment){const text=fragment.replace(/'(?:''|[^'])*'/g,m=>' '.repeat(m.length)).replace(/--[^\n]*/g,m=>' '.repeat(m.length));let depth=0;for(const m of text.matchAll(/\(|\)|\bTHEN\b/g)){if(m[0]==='(')depth++;else if(m[0]===')')depth--;else if(depth===0)return m.index;}return-1;}
let groups=0;function check(name,fn){fn();console.log(`PASS ${++groups} ${name}`);}
const oldReader=before(base+'reader.sql'),reader=current(base+'reader.sql'),oldVerify=before(base+'verify.sql'),verify=current(base+'verify.sql');
check('actual reported parent source identity; whole reader restores by removing ONLY three CASE parentheses',()=>{assert.equal(hash(oldReader),'6eb71c153839f3774fb9a04930e30830c3c3e0fa816a69a793fe8465e56deaa8');const x=unwrap(reader);assert.equal(x.count,3);assert.equal(x.value,oldReader);});
check('42601 source counterexample: prior top-level CASE THEN precedes IF terminator; fixed cases remain nested',()=>{for(const s of[oldReader,oldVerify]){const b=s.slice(s.indexOf('   IF NOT FOUND OR policy.polcmd'));assert.ok(firstThen(b)<b.indexOf("THEN RAISE EXCEPTION"));}for(const s of[reader,verify]){const b=s.slice(s.indexOf('   IF NOT FOUND OR policy.polcmd'));assert.equal(firstThen(b),b.indexOf("THEN RAISE EXCEPTION"));}});
check('verifier same syntax family plus exactly the new reader-body hash; no policy weakening',()=>{const body=reader.match(/AS \$reader\$([\s\S]*?)\$reader\$/)[1],oldBody=oldReader.match(/AS \$reader\$([\s\S]*?)\$reader\$/)[1];assert.ok(verify.includes(hash(body)));const x=unwrap(verify);assert.equal(x.count,3);assert.equal(x.value.replace(hash(body),hash(oldBody)),oldVerify);});
check('ABI, RLS predicates/helper bodies, selector entry/restore and lock order unchanged',()=>{for(const tag of['origin_scope','decision_scope'])assert.equal(reader.match(new RegExp('AS \\$'+tag+'\\$([\\s\\S]*?)\\$'+tag+'\\$'))[1],oldReader.match(new RegExp('AS \\$'+tag+'\\$([\\s\\S]*?)\\$'+tag+'\\$'))[1]);for(const p of['rls-contract.json','preflight.sql','recovery.md'])assert.equal(current(base+p),before(base+p));assert.equal(reader.slice(0,reader.indexOf('AS $reader$')),oldReader.slice(0,oldReader.indexOf('AS $reader$')));});
check('negative: dropping a guard or returning before the last scope check cannot reconstruct the actual parent',()=>{for(const bad of[reader.replace('NOT row_security_active(rel.oid)','true'),reader.replace('FOREACH d IN ARRAY records LOOP RETURN NEXT d; END LOOP;','RETURN;')])assert.notEqual(unwrap(bad).value,oldReader);});
const m=JSON.parse(current('docs/core/domain-ports-01/finance-entry-contract-32/manifest.json'));
check('new seal and protected source pins match without rerunning accepted controls',()=>{for(const x of[...m.inventory,...m.unchanged_pins])assert.equal(hash(current(x.path)),x.sha256,x.path);assert.equal(m.runtime,null);assert.equal(m.entry.consumer_successor,null);});
console.log(JSON.stringify({new_source_groups:groups,ABI:'UNCHANGED',entry:'CONTRACT_SUPPLIED_REAL_FINANCE_SUCCESSOR_PENDING',compile_evidence:'SEE_ACTUAL_EMBEDDED_EVIDENCE',PostgreSQL_server_native:'NOT_RUN_NOT_PASS',runtime:null}));
