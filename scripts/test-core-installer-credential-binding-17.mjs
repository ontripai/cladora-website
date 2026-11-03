/** Synthetic files + controlled transport; not a fresh native installation. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,symlinkSync,linkSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {issueInstallerCredentialBindingV1,loadInstallerCredentialBindingV1} from './lib/core-installer-credential-binding-v1.mjs';
let n=0;function check(name,fn){fn();console.log('PASS '+(++n)+' '+name);}
const root=mkdtempSync(join(tmpdir(),'core17-installer-binding-'));chmodSync(root,0o700);const target={backend_id:'core15-dev:'+'a'.repeat(32),database_oid:1234,database_name:'postgres',host:'127.0.0.1',port:55422,principal:'cladora_core_installer'};
const write=(p,v)=>writeFileSync(p,JSON.stringify(v)+'\n',{mode:0o600});
mkdirSync(root+'/core15',{mode:0o700});for(const g of ['v2','v3'])mkdirSync(root+'/core15/service-native-'+g,{mode:0o700});
const session={state:'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED',platform:'794f5a12c3928ae0a3585ab679a3cbe60aab49a3',backend_id:target.backend_id,database_oid:target.database_oid};write(root+'/core15/session-bootstrap-receipt.json',session);
const producer={unit:'prerequisites',state:'COMMIT_ACK_RFQ_I_AND_POSTSTATE_OBSERVED',settlement:'COMMIT',command_complete_commit:true,readyforquery:'I',poststate:{ordinary_installer:true}};
for(const g of ['v2','v3']){const dir=root+'/core15/service-native-'+g;write(dir+'/installer-secret.json',{password:(g==='v3'?'b':'c').repeat(64)});write(dir+(g==='v3'?'/prerequisites-committed.json':'/prerequisites.json'),producer);}
const fresh=issueInstallerCredentialBindingV1({privateRoot:root,generation:'v3',target}),historic=issueInstallerCredentialBindingV1({privateRoot:root,generation:'historical-v2',target});
const opts={privateRoot:root,generation:'v3',bindingPath:fresh.path,expectedTarget:target};let connects=0;
function consume(o=opts){const selected=loadInstallerCredentialBindingV1(o);connects++;return{password:selected.password,generation:selected.generation,visible:JSON.stringify(selected)};}
const pristine=readFileSync(fresh.path);function reject(name,change,restore=()=>{}){check(name,()=>{const before=connects;try{change();assert.throws(()=>consume());assert.equal(connects,before,'must fail before transport');}finally{restore();writeFileSync(fresh.path,pristine,{mode:0o600});chmodSync(fresh.path,0o600);}});}
try{
 check('fresh v3 producer binding drives fresh consumer, no secret in enumerable metadata',()=>{const c=consume();assert.equal(c.password,'b'.repeat(64));assert.equal(c.generation,'v3');assert.equal(c.visible.includes(c.password),false);});
 check('accepted historical v2 selected explicitly, independent of fresh credential existence',()=>{const c=consume({...opts,generation:'historical-v2',bindingPath:historic.path});assert.equal(c.password,'c'.repeat(64));assert.equal(c.generation,'historical-v2');});
 reject('wrong generation rejected before connection',()=>{const b=JSON.parse(pristine);b.generation='historical-v2';write(fresh.path,b);});
 reject('wrong contract version rejected before connection',()=>{const b=JSON.parse(pristine);b.contract='core-installer-credential-binding.v2';write(fresh.path,b);});
 reject('unapproved producer profile rejected before connection',()=>{const b=JSON.parse(pristine);b.profile='another-install-profile';write(fresh.path,b);});
 reject('foreign target rejected before connection',()=>{const b=JSON.parse(pristine);b.target.backend_id='core15-dev:'+'d'.repeat(32);write(fresh.path,b);});
 reject('unapproved principal rejected before connection',()=>{const b=JSON.parse(pristine);b.target.principal='postgres';write(fresh.path,b);});
 reject('credential path cannot switch to historical file',()=>{const b=JSON.parse(pristine);b.credential.path=root+'/core15/service-native-v2/installer-secret.json';write(fresh.path,b);});
 reject('missing v3 credential does not fall back to available historical v2',()=>unlinkSync(root+'/core15/service-native-v3/installer-secret.json'),()=>write(root+'/core15/service-native-v3/installer-secret.json',{password:'b'.repeat(64)}));
 reject('binding readable by others fails custody',()=>chmodSync(fresh.path,0o644));
 const credential=root+'/core15/service-native-v3/installer-secret.json';
 reject('credential readable by others fails custody',()=>chmodSync(credential,0o644),()=>chmodSync(credential,0o600));
 reject('symlink cannot stand in for binding',()=>{unlinkSync(fresh.path);symlinkSync(historic.path,fresh.path);},()=>unlinkSync(fresh.path));
 const linked=root+'/duplicate';reject('hardlink count cannot bypass custody',()=>linkSync(fresh.path,linked),()=>unlinkSync(linked));
 const receipt=root+'/core15/service-native-v3/prerequisites-committed.json',receiptBytes=readFileSync(receipt);
 reject('unknown producer settlement rejected',()=>write(receipt,{...producer,state:'UNKNOWN'}),()=>writeFileSync(receipt,receiptBytes));
 const sessionFile=root+'/core15/session-bootstrap-receipt.json',sessionBytes=readFileSync(sessionFile);
 reject('session provenance belongs to the same target',()=>write(sessionFile,{...session,database_oid:5678}),()=>writeFileSync(sessionFile,sessionBytes));
 reject('credential bytes cannot be silently replaced',()=>write(credential,{password:'e'.repeat(64)}),()=>write(credential,{password:'b'.repeat(64)}));
 check('foreign file owner rejected by actual validator before transport (controlled stat)',()=>{
  const require=createRequire(import.meta.url),fs=require('node:fs'),m={exports:{}};
  const source=readFileSync(new URL('./lib/core-installer-credential-binding-v1.mjs',import.meta.url),'utf8');
  new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>name==='node:fs'?{...fs,fstatSync(fd){const s=fs.fstatSync(fd);return{...s,uid:process.getuid()+1,isFile:()=>s.isFile()};}}:require(name),m,m.exports);
  const before=connects;assert.throws(()=>m.exports.loadInstallerCredentialBindingV1(opts),/INSTALLER_BINDING_FILE_CUSTODY/);assert.equal(connects,before);
 });
 check('fresh source never chooses a historical secret by file existence',()=>{const s=readFileSync(new URL('./run-core15-service-native-v3.mjs',import.meta.url),'utf8');assert.match(s,/generation:'v3'/);assert.match(s,/loadInstallerCredentialBindingV1/);assert.doesNotMatch(s,/readPrivate\(existsSync\(dir\+'\/installer-secret/);});
 check('legacy domain fixture body is byte-identical; new wrapper binds before importing it',()=>{const file='scripts/prepare-core15-service-synthetic-fixture-v1.mjs',old=execFileSync('git',['show','29ed18541c602dae4e6db5c98a96201250af630b:'+file],{encoding:'utf8'}),now=readFileSync(new URL('../'+file,import.meta.url),'utf8');const body=s=>s.slice(s.indexOf("try{\n await c.connect();"),s.indexOf('}finally{await c.end();}')+'}finally{await c.end();}'.length);assert.ok(body(old).length>1000);assert.equal(body(now),body(old));assert.match(now,/prepareCore15ServiceSyntheticFixtureV1\(\{legacy:true\}\)/);const wrapper=readFileSync(new URL('./prepare-core-service-synthetic-fixture-v2.mjs',import.meta.url),'utf8');assert.ok(wrapper.indexOf('loadInstallerCredentialBindingV1({')<wrapper.indexOf("await import('./prepare-core15"));});
 const {prepareCore15ServiceSyntheticFixtureV1}=await import('./prepare-core15-service-synthetic-fixture-v1.mjs');
 await assert.rejects(prepareCore15ServiceSyntheticFixtureV1({legacy:true,generation:'v3'}),/explicit fixture credential profile required/);n++;console.log('PASS '+n+' mixed legacy/fresh fixture selection rejected before network');
 console.log(JSON.stringify({new_binding_checks:n,controlled_transport:true,fresh_native_install:'NOT_RUN_NOT_PASS'}));
}finally{rmSync(root,{recursive:true,force:true});}
