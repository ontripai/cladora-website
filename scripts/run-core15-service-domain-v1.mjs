/** One exact domain unit, ordinary installer, owned relay; NEVER auto-next/retry. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {loadInstallerCredentialBindingV1,installerTargetV1,readOwnedInstallerFileV1} from './lib/core-installer-credential-binding-v1.mjs';
import {deriveDomainUnitV1} from './prepare-core15-service-domain-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),root=new URL('../',import.meta.url),p='/workspace/private/cladora-functional-dev-v1';
const manifest=JSON.parse(readFileSync(new URL('supabase/install/core-functional-runtime-v1/service-native-v3/domain-manifest.json',root)));
const unit=manifest.units.find(x=>x.id===process.argv[2]);assert.ok(unit);
const custodian=['session-authority-delegation','owner-execute-bindings'].includes(unit.id);
const correction=custodian?undefined:process.argv[5],afterPrerequisite=correction==='--after-prerequisite',afterConfig=correction==='--after-exact-config',afterSyntax=correction==='--after-guard-syntax';assert.equal(process.argv.length,custodian?3:(correction?6:5));
if(correction)assert.ok(['--after-prerequisite','--after-exact-config','--after-guard-syntax'].includes(correction),'unknown correction flag');
const read=x=>JSON.parse(readFileSync(x));
assert.equal(read(p+'/core15/service-native-v3/foundation-committed.json').state,'COMMIT_ACK_RFQ_I_AND_POSTSTATE_OBSERVED');
const dir=p+'/core15/service-domain-v1';if(!existsSync(dir))mkdirSync(dir,{mode:0o700});
if(afterPrerequisite){assert.equal(unit.id,'request');const old=read(dir+'/request.json');assert.equal(old.settlement,'ROLLBACK_ACK_RFQ_I');assert.equal(old.error_message,'relation "platform.module_dependencies" does not exist');assert.equal(read(dir+'/module-registry-committed.json').state,'COMMIT_AND_RFQ_I');}
if(afterConfig){assert.equal(unit.id,'canonical-sqlstate');const old=read(dir+'/canonical-sqlstate.json');assert.equal(old.settlement,'ROLLBACK_ACK_RFQ_I');assert.equal(old.error_message,'core12_preimage_mismatch');}
if(afterSyntax){assert.equal(unit.id,'canonical-sqlstate');const old=read(dir+'/canonical-sqlstate-after-exact-config.json');assert.equal(old.settlement,'ROLLBACK_ACK_RFQ_I');assert.equal(old.error_code,'42601');}
const receiptPath=dir+'/'+unit.id+(afterPrerequisite?'-after-prerequisite':afterConfig?'-after-exact-config':afterSyntax?'-after-guard-syntax':'')+'.json';assert.equal(existsSync(receiptPath),false,'STOP existing dispatch receipt');
const i=manifest.units.indexOf(unit);if(i>0){const previous=dir+'/'+manifest.units[i-1].id;assert.equal(read(existsSync(previous+'-committed.json')?previous+'-committed.json':previous+'.json').state,'COMMIT_AND_RFQ_I');}
const source=readFileSync(new URL(unit.path,root),'utf8');assert.equal(sha(source),unit.source_sha256);const payload=deriveDomainUnitV1(source,unit.id);assert.equal(sha(payload),unit.payload_sha256);
const secret=custodian?{password:read(p+'/secrets.json').database_password}:loadInstallerCredentialBindingV1({privateRoot:p,generation:process.argv[3],bindingPath:process.argv[4],expectedTarget:{backend_id:JSON.parse(readOwnedInstallerFileV1(p+'/core15/session-bootstrap-receipt.json',p)).backend_id,database_oid:Number(JSON.parse(readOwnedInstallerFileV1(p+'/core15/session-bootstrap-receipt.json',p)).database_oid),database_name:'postgres',host:'127.0.0.1',port:55422,principal:'cladora_core_installer'}});
const actor=custodian?'postgres':'cladora_core_installer';
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const c=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:actor,password:secret.password,connectionTimeoutMillis:5000,query_timeout:45000});
const tags=[],ready=[];c.connection.on('commandComplete',x=>tags.push(x.text));c.connection.on('readyForQuery',x=>ready.push(x.status));
let sent=false;const r={contract:'core15-domain-native-observation.v1',unit:unit.id,source_sha256:unit.source_sha256,payload_sha256:sha(payload),state:'PRE_SEND',settlement:'NOT_SENT'};
const save=()=>writeFileSync(receiptPath,JSON.stringify(r,null,2)+'\n',{mode:0o600});
try{
 await c.connect();const profile=await c.query("select current_user::text actor,session_user::text login,pg_backend_pid() pid,(select oid::int from pg_database where datname=current_database()) oid,r.rolsuper,r.rolbypassrls from pg_roles r where rolname=current_user");const x=profile.rows[0];
 assert.equal(x.actor,actor);assert.equal(x.login,x.actor);assert.equal(x.rolsuper,custodian);assert.equal(x.rolbypassrls,custodian);assert.equal(x.oid,Number(read(p+'/core15/session-bootstrap-receipt.json').database_oid));r.backend_pid=x.pid;
 r.state='DISPATCHED_NO_RETRY';save();sent=true;const start=tags.length;await c.query(payload);assert.ok(tags.slice(start).includes('COMMIT'));assert.equal(ready.at(-1),'I');r.state='COMMIT_AND_RFQ_I';r.settlement='COMMIT';save();writeFileSync(dir+'/'+unit.id+'-committed.json',JSON.stringify(r,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({unit:unit.id,state:r.state,payload_sha256:r.payload_sha256,runtime_ready:false}));
}catch(e){r.state=sent?'FAILED_OR_UNKNOWN_STOP':'PRE_SEND_STOP';r.error_code=e.code??'LOCAL_OR_TRANSPORT';r.error_message=e.message?.slice(0,300);r.error_position=e.position??null;
 if(sent&&!tags.includes('COMMIT'))try{const b=await c.query('rollback');r.settlement=b.command==='ROLLBACK'&&ready.at(-1)==='I'?'ROLLBACK_ACK_RFQ_I':'UNKNOWN';}catch{r.settlement='UNKNOWN';}save();
 console.error(JSON.stringify({unit:unit.id,state:r.state,error_code:r.error_code,settlement:r.settlement,private_diagnostic:true}));process.exitCode=1;
}finally{await c.end();}
