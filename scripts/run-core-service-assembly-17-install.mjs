/** One fixed additive unit on the existing owned Platform12 only; no generic SQL. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {loadInstallerCredentialBindingV1,installerTargetV1,readOwnedInstallerFileV1} from './lib/core-installer-credential-binding-v1.mjs';
const unit=process.argv[2];assert.equal(process.argv.length,5);assert.ok(['read-access','catalog-compatibility'].includes(unit));
const root='/workspace/private/cladora-functional-dev-v1',file=root+(unit==='read-access'?'/core17-install-receipt.json':'/core17-catalog-compatibility-receipt.json');assert.equal(existsSync(file),false,'existing dispatch STOP');
const config=JSON.parse(readOwnedInstallerFileV1(root+'/core15/service-runtime-binding.json',root)),secret=loadInstallerCredentialBindingV1({privateRoot:root,generation:process.argv[3],bindingPath:process.argv[4],expectedTarget:installerTargetV1(config.target)});
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const sql=readFileSync(new URL('../supabase/install/core-service-app-assembly-v1/'+unit+'.sql',import.meta.url),'utf8');
const c=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:5000,query_timeout:30000});
const tags=[],ready=[];c.connection.on('commandComplete',x=>tags.push(x.text));c.connection.on('readyForQuery',x=>ready.push(x.status));
const receipt={contract:'core17-owned-unit.v1',state:'DISPATCHED_NO_RETRY',sha256:createHash('sha256').update(sql).digest('hex')};const save=()=>writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
try{await c.connect();const observed=(await c.query("select current_user::text principal,(select oid::int from pg_database where datname=current_database()) oid,(select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') marker")).rows[0];assert.equal(observed.principal,'cladora_core_installer');assert.equal(observed.oid,config.target.database_oid);assert.equal(observed.marker,config.target.backend_id);save();await c.query(sql);assert.ok(tags.includes('COMMIT'));assert.equal(ready.at(-1),'I');receipt.state='COMMIT_AND_READYFORQUERY_I';save();console.log(JSON.stringify({state:receipt.state,payload_sha256:receipt.sha256}));}
catch(e){receipt.state='FAILED_OR_UNKNOWN_STOP';receipt.code=e.code??e.name;receipt.message=e.message;receipt.position=e.position;try{const ack=await c.query('rollback');receipt.cleanup=ack.command==='ROLLBACK'&&ready.at(-1)==='I'?'ROLLBACK_ACK_I':'UNKNOWN';}catch{receipt.cleanup='UNKNOWN';}save();console.error(JSON.stringify({state:receipt.state,code:receipt.code,private_diagnostic:true}));process.exitCode=1;}finally{await c.end();}
