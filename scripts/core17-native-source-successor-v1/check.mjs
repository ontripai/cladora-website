/** Source-history + exact successor only. Never an execution/native admission. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const HISTORY='bfadc5042cb00841dd605862a2a72ddc0dbafb87';
export const REVIEWED='67f17777f342c103e2588410949c0b32a104a37f';
const DIR='scripts/core17-native-cases-v3';
const MANIFEST_SHA='aaf72324eefc8a6dde5e3d10f6ad4cf51c3c8dcdbd3e1c132e15d29db197acae';
const PROFILE_SHA='09ad4bdd83cea119735ec555da3834ec290c75db263bedaa6e1fb55a5eed3682';
const digest=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const bytes=v=>Buffer.isBuffer(v)?v:Buffer.from(v);
function censusFactory(source,read,exists,ts){
 // Execute only the original pinned static census definition, with read-only IO.
 const at=source.indexOf('export const PRODUCT_ROOTS');assert.ok(at>=0);
 return new Function('assert','readFileSync','existsSync','resolve','relative','dirname','ts',source.slice(at).replaceAll('export ','')+'\nreturn productSourceClosure;')
  (assert,read,exists,resolve,relative,dirname,ts);
}
export async function validateSourceSuccessorV1(options={}){
 const root=resolve(options.root??process.cwd());
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:12*1024*1024});
 const readGit=options.readGit??((ref,path)=>git('show',ref+':'+path));
 const listGit=options.listGit??((ref,path)=>git('ls-tree','--name-only',ref+':'+path).toString().trim().split('\n'));
 const readCurrent=options.readCurrent??(path=>readFileSync(resolve(root,path)));
 const listCurrent=options.listCurrent??(path=>readdirSync(resolve(root,path)));
 const raw=bytes(readGit(HISTORY,DIR+'/manifest.json'));assert.equal(digest(raw),MANIFEST_SHA,'ORIGINAL_MANIFEST_IDENTITY');
 assert.deepEqual(bytes(readCurrent(DIR+'/manifest.json')),raw,'HISTORICAL_MANIFEST_MUST_NOT_BE_RESEALED');
 const m=JSON.parse(raw),profileRaw=bytes(options.profileBytes??readFileSync(new URL('./source-successor.json',import.meta.url)));
 assert.equal(digest(profileRaw),PROFILE_SHA,'EXACT_REVIEWED_SUCCESSOR_PROFILE');const profile=JSON.parse(profileRaw);
 assert.equal(profile.contract,'core17.source-successor-review.v1');assert.equal(profile.reviewed_source_head,REVIEWED);
 assert.equal(profile.historical_operator_source,HISTORY);assert.equal(profile.historical_App,m.App);
 assert.equal(profile.historical_manifest_sha256,MANIFEST_SHA);assert.equal(profile.source_only,true);
 assert.equal(profile.native_execution_eligible,false);assert.equal(profile.native_acceptance,'NOT_RUN_NOT_PASS');assert.equal(profile.runtime_activation,null);
 // Native operator scripts and helpers remain byte-identical. No exceptions for check.mjs.
 const operators=new Map(m.operator_sources.map(p=>[p.path,p]));
 for(const p of m.operator_sources){const historical=bytes(readGit(HISTORY,p.path)),current=bytes(readCurrent(p.path));
  assert.equal(historical.length,p.bytes);assert.equal(digest(historical),p.sha256,p.path);assert.equal(blob(historical),p.git_blob,p.path);
  assert.deepEqual(current,historical,'OPERATOR_CHANGED '+p.path);
 }
 const isProduct=new Set(m.product_sources.map(p=>p.path));
 const historicalRead=(p,encoding)=>{const path=relative(root,resolve(root,p));assert.ok(operators.has(path)||isProduct.has(path),'UNLISTED_HISTORICAL_SOURCE '+path);const b=bytes(readGit(operators.has(path)?HISTORY:m.App,path));return encoding?b.toString(encoding):b;};
 const historicalExists=p=>{try{historicalRead(p);return true;}catch{return false;}};
 const ts=createRequire(resolve(root,'package.json'))('typescript');
 const closureSource=historicalRead(DIR+'/source-closure.mjs','utf8');
 const historicalCensus=censusFactory(closureSource,historicalRead,historicalExists,ts);
 const contractSource=historicalRead(DIR+'/contract.mjs','utf8');
 const contract=await import('data:text/javascript;base64,'+Buffer.from(contractSource).toString('base64'));
 const checkSource=historicalRead(DIR+'/check.mjs','utf8'),start=checkSource.indexOf('function validate(x){'),end=checkSource.indexOf('\nvalidate(m);');
 assert.ok(start>=0&&end>start,'PINNED_LEGACY_VALIDATOR_BOUNDARY');
 // The original validator body runs UNCHANGED, against its original Git sources.
 // No historical assertion is deleted or reinterpreted as current native proof.
 const legacy=new Function('assert','readFileSync','readdirSync','productSourceClosure','execFileSync','hash','APP','INSTALLED','SOURCE_BASE','CASES','executionLimits','process','dir',checkSource.slice(start,end)+'\nreturn validate;')
  (assert,historicalRead,path=>listGit(HISTORY,path),historicalCensus,(_cmd,args)=>{assert.equal(_cmd,'git');assert.equal(args[0],'show');assert.ok(args[1].startsWith(m.App+':'));return bytes(readGit(m.App,args[1].slice(m.App.length+1)));},digest,contract.APP,contract.INSTALLED,contract.SOURCE_BASE,contract.CASES,contract.executionLimits,{cwd:()=>root},DIR);
 assert.equal(legacy(m),true);
 assert.deepEqual(listCurrent(DIR).sort(),listGit(HISTORY,DIR).sort(),'EXTRA_OR_MISSING_OPERATOR_SOURCE');
 const currentRead=p=>bytes(readCurrent(relative(root,resolve(root,p)))).toString();
 const currentExists=p=>{try{currentRead(p);return true;}catch{return false;}};
 const currentCensus=censusFactory(closureSource,currentRead,currentExists,ts)(root);
 const expected=profile.current_product_sources.map(p=>p.path).sort();assert.deepEqual(currentCensus,expected,'UNREVIEWED_PRODUCT_DEPENDENCY');
 assert.equal(new Set(expected).size,expected.length);
 for(const p of profile.current_product_sources){
  const reviewed=bytes(readGit(REVIEWED,p.path)),current=bytes(readCurrent(p.path));
  assert.equal(reviewed.length,p.bytes);assert.equal(digest(reviewed),p.sha256,p.path);assert.equal(blob(reviewed),p.git_blob,p.path);
  assert.deepEqual(current,reviewed,'CURRENT_PRODUCT_SOURCE_DRIFT '+p.path);
 }
 return Object.freeze({contract:'core17.source-successor-check.v1',historical_manifest:'ORIGINAL_IDENTITY_VERIFIED',historical_App:m.App,reviewed_source_head:REVIEWED,
  historical_product_sources:m.product_sources.length,current_product_sources:expected.length,operator_sources:m.operator_sources.length,
  historical_evidence_scope:'UNCHANGED_NOT_EXTENDED_TO_SUCCESSOR',source_successor:'EXACT_REVIEWED_SOURCE_ONLY',native_execution_eligible:false,runtime_activation:null,native:'NOT_RUN_NOT_PASS'});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await validateSourceSuccessorV1()));
