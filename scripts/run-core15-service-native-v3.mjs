/** Fixed, per-unit real developer install consumer. No generic endpoint/SQL/retry. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {resolve} from 'node:path';
import {deriveOrdinaryInstallerV3} from './lib/core15-ordinary-installer-profile-v3.mjs';
const root=new URL('../',import.meta.url),privateRoot='/workspace/private/cladora-functional-dev-v1',platform='/workspace/work/platform12-core15-input-794f5a1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const unit=process.argv[2],correctedBinding=false;assert.equal(process.argv[3],'--accepted-source');assert.equal(process.argv.length,5);const accepted=resolve(process.argv[4]);assert.ok(['prerequisites','foundation','assets','maintenance-procurement','building-provisioning'].includes(unit));
execFileSync('python3',['-I','-B','-c',`import importlib.util,subprocess;from pathlib import Path
p=Path('${platform}');assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=p,text=True).strip()=='794f5a12c3928ae0a3585ab679a3cbe60aab49a3';s=importlib.util.spec_from_file_location('p12',p/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()`],{stdio:'pipe'});
const readPrivate=p=>{const s=statSync(p);assert.equal(s.mode&0o077,0);assert.equal(s.isFile(),true);return JSON.parse(readFileSync(p));};
const secret=readPrivate(privateRoot+'/secrets.json'),descriptor=readPrivate(privateRoot+'/descriptor.json');
const session=readPrivate(privateRoot+'/core15/session-bootstrap-receipt.json');assert.equal(session.state,'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED');
const dir=privateRoot+'/core15/service-native-v3';if(!existsSync(dir))mkdirSync(dir,{mode:0o700});
const firstReceiptPath=dir+'/'+unit+'.json';
if(correctedBinding){assert.notEqual(unit,'prerequisites');const prior=readPrivate(firstReceiptPath);assert.equal(prior.settlement,'ROLLBACK_ACK_RFQ_I');assert.equal(prior.commit_observed,false);assert.equal(prior.error_message,'operations_install_external_binding_or_prestate_required');}
const receiptPath=dir+'/'+unit+(correctedBinding?'-corrected-binding':'')+'.json';assert.equal(existsSync(receiptPath),false,'existing dispatch receipt STOP; no blind retry');
const m=JSON.parse(readFileSync(new URL('supabase/install/core-functional-runtime-v1/service-native-v3/manifest.json',root)));
assert.equal(m.adapter.sha256,sha(readFileSync(new URL(m.adapter.path,root))));
let source,payload,metadata,credential;
if(unit==='prerequisites')assert.equal(existsSync(privateRoot+'/core15/service-native-v2/prerequisites.json'),false,'existing predecessor prerequisite: NEVER provision again');
const role=unit==='prerequisites'?'postgres':'cladora_core_installer';
if(unit==='prerequisites'){
 const p='supabase/install/core-functional-runtime-v1/service-native-v3/installer-prerequisites.sql';source=readFileSync(new URL(p,root),'utf8');
 assert.equal(m.prerequisite.sha256,sha(source));const password=randomBytes(32).toString('hex');
 assert.equal(existsSync(dir+'/installer-secret.json'),false);writeFileSync(dir+'/installer-secret.json',JSON.stringify({password})+'\n',{mode:0o600});
 const marker='-- CORE15_PRIVATE_INSTALLER_PASSWORD';assert.equal(source.split(marker).length,2);
 payload=source.replace(marker,()=>`ALTER ROLE cladora_core_installer PASSWORD '${password}';`);credential=secret.database_password;metadata={source_sha256:sha(source),bytes:Buffer.byteLength(source)};
}else{
 const index=m.units.findIndex(x=>x.unit===unit);assert.ok(index>=0);
 const previous=index===0?'prerequisites':m.units[index-1].unit;
 const predecessor=previous==='prerequisites'?(existsSync(dir+'/prerequisites-committed.json')?dir+'/prerequisites-committed.json':privateRoot+'/core15/service-native-v2/prerequisites.json'):dir+'/'+previous+'-committed.json';
 assert.equal(readPrivate(predecessor).state,'COMMIT_ACK_RFQ_I_AND_POSTSTATE_OBSERVED');
 source=readFileSync(resolve(accepted,m.units[index].path),'utf8');const derived=deriveOrdinaryInstallerV3(source,unit);payload=derived.payload;metadata=derived.metadata;
 assert.equal(sha(payload),m.units[index].payload_sha256);credential=readPrivate(existsSync(dir+'/installer-secret.json')?dir+'/installer-secret.json':privateRoot+'/core15/service-native-v2/installer-secret.json').password;
}
const client=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:role,password:credential,connectionTimeoutMillis:5000,query_timeout:90000,application_name:'cladora-core15-native-install.v2'});
const tags=[],ready=[];let sent=false,commit=false;
client.connection.on('commandComplete',x=>tags.push(x.text));client.connection.on('readyForQuery',x=>ready.push(x.status));
const receipt={contract:'core15-native-unit-observation.v2',unit,source_sha256:metadata.source_sha256,payload_sha256:sha(payload),private_password_binding:unit==='prerequisites',state:'PRE_SEND',role,settlement:'NOT_SENT'};
const save=()=>writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
async function observe(c){const r=await c.query("select current_user::text principal,session_user::text login,pg_backend_pid() pid,(select oid::int from pg_database where datname=current_database()) oid,current_setting('server_version_num')::int version,r.rolsuper,r.rolbypassrls,r.rolcreaterole from pg_roles r where rolname=current_user");
 const p=r.rows[0];assert.equal(r.rowCount,1);assert.equal(p.principal,role);assert.equal(p.login,role);assert.equal(p.oid,Number(session.database_oid));assert.equal(p.version,170011);assert.equal(p.rolsuper,unit==='prerequisites');assert.equal(p.rolbypassrls,unit==='prerequisites');if(unit!=='prerequisites')assert.equal(p.rolcreaterole,true);return p;}
try{
 await client.connect();const before=await observe(client);receipt.backend_pid=before.pid;
 if(unit!=='prerequisites'){
  // The EXACT accepted catalog observation runs on the real ordinary principal;
  // it is not reconstructed from JSON or a claimed profile/GUC.
  const start=payload.indexOf("select set_config('cladora.install.catalog_before',");
  const end=payload.indexOf('\ndo $catalog_entry$',start);assert.ok(start>0&&end>start);
  await client.query('begin isolation level repeatable read read only');
  await client.query(payload.slice(start,end));
  const observed=await client.query("select encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_before'),'UTF8'),'sha256'),'hex') hash");
  const rb=await client.query('rollback');assert.equal(rb.command,'ROLLBACK');assert.equal(ready.at(-1),'I');
  const prestate=observed.rows[0].hash;assert.match(prestate,/^[a-f0-9]{64}$/);
  if(correctedBinding){const absent=await client.query("select to_regnamespace('app_private') is null absent,not exists(select 1 from pg_roles where rolname='cladora_rpc_owner') no_owner_role");assert.deepEqual(absent.rows,[{absent:true,no_owner_role:true}]);}
  receipt.prestate_sha256=prestate;
  const native={contract:'core15-real-development-profile-observation.v2',platform:m.platform,adapter_sha256:m.adapter.sha256,payload_sha256:sha(payload),database_oid:before.oid,PG:before.version,ordinary_installer:role,backend_pid:before.pid,compiled_oracle:'NOT_CLAIMED'};
  const operator={task:'CORE-FUNCTIONAL-RUNTIME-15/SERVICE-FIRST-NATIVE-CUT',authority:'explicit user development execution authorization',target:'owned synthetic local development only',staging_production:false};
  const execution={attempt:randomUUID(),unit,payload_sha256:sha(payload),same_backend_pid:before.pid,mode:'independent per-unit COMMIT; UNKNOWN stops'};
  writeFileSync(dir+'/'+unit+'-'+execution.attempt+'-bindings.private.json',JSON.stringify({native,operator,execution,prestate})+'\n',{mode:0o600});
  await client.query("select set_config('cladora.install.native_binding',$1,false),set_config('cladora.install.operator_binding',$2,false),set_config('cladora.install.execution_binding',$3,false),set_config('cladora.install.prestate_sha256',$4,false)",[JSON.stringify(native),JSON.stringify(operator),JSON.stringify(execution),prestate]);
 }
 await client.query("select set_config('cladora.install.target',$1,false),set_config('cladora.install.target_oid',$2,false),set_config('cladora.install.unit',$3,false)",['core15-dev:'+descriptor.instance,String(before.oid),unit]);
 receipt.state='DISPATCHED_NO_RETRY';save();sent=true;
 const start=tags.length;await client.query(payload);commit=tags.slice(start).includes('COMMIT');assert.ok(commit);assert.equal(ready.at(-1),'I');
 const after=await observe(client);assert.equal(after.pid,before.pid);
 const observer=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:'postgres',password:secret.database_password,connectionTimeoutMillis:5000,query_timeout:10000});
 try{await observer.connect();const q=await observer.query("select exists(select 1 from pg_roles where rolname='cladora_core_installer' and not rolsuper and not rolbypassrls) ordinary_installer,exists(select 1 from pg_extension where extname='btree_gist' and extversion='1.7') extension_ok,to_regnamespace('app_private') is not null app_schema");assert.equal(q.rows[0].ordinary_installer,true);assert.equal(q.rows[0].extension_ok,true);assert.equal(q.rows[0].app_schema,unit!=='prerequisites');receipt.poststate=q.rows[0];}finally{await observer.end();}
 receipt.state='COMMIT_ACK_RFQ_I_AND_POSTSTATE_OBSERVED';receipt.settlement='COMMIT';receipt.command_complete_commit=true;receipt.readyforquery='I';save();
 writeFileSync(dir+'/'+unit+'-committed.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({unit,state:receipt.state,source_sha256:metadata.source_sha256,payload_sha256:sha(payload),readyforquery:'I',runtime_ready:false}));
}catch(e){
 receipt.state=sent?'FAILED_OR_UNKNOWN_STOP':'PRE_SEND_STOP';receipt.commit_observed=commit;receipt.error_code=typeof e.code==='string'?e.code:'LOCAL_OR_TRANSPORT';
 // Keep only non-secret diagnostic location, never SQL rows or query payload.
 receipt.error_position=e.position??null;receipt.error_routine=e.routine??null;receipt.error_message=typeof e.message==='string'?e.message.slice(0,300):null;
 if(sent&&!commit){try{const q=await client.query('rollback');if(q.command==='ROLLBACK'&&ready.at(-1)==='I')receipt.settlement='ROLLBACK_ACK_RFQ_I';else receipt.settlement='UNKNOWN';}catch{receipt.settlement='UNKNOWN';}}
 save();console.error(JSON.stringify({unit,state:receipt.state,error_code:receipt.error_code,settlement:receipt.settlement,private_diagnostic:true}));process.exitCode=1;
}finally{try{await client.end();}catch{receipt.cleanup='UNKNOWN';save();}}
