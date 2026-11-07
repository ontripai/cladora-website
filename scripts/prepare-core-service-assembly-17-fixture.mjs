/** Extend only the existing owned synthetic fixture with canonical catalog read.
 * No user/signup, public caller grant, command receipt or business request seed.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {loadInstallerCredentialBindingV1,installerTargetV1,readOwnedInstallerFileV1} from './lib/core-installer-credential-binding-v1.mjs';
assert.equal(process.argv.length,4);
const p='/workspace/private/cladora-functional-dev-v1',read=n=>JSON.parse(readFileSync(p+'/'+n)),file=p+'/core17-fixture-addon.json';assert.equal(existsSync(file),false,'existing dispatch STOP');
const f=read('core15/service-fixture-private.json'),secret=loadInstallerCredentialBindingV1({privateRoot:p,generation:process.argv[2],bindingPath:process.argv[3],expectedTarget:installerTargetV1(JSON.parse(readOwnedInstallerFileV1(p+'/core15/service-runtime-binding.json',p)).target)});assert.equal(read('core17-install-receipt.json').state,'COMMIT_AND_READYFORQUERY_I');
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const c=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:5000,query_timeout:15000}),r={state:'DISPATCHED_NO_RETRY',fixture:'existing owned synthetic only'};const save=()=>writeFileSync(file,JSON.stringify(r,null,2)+'\n',{mode:0o600});
try{await c.connect();await c.query('begin');await c.query("set local lock_timeout='5s'");await c.query("set local statement_timeout='10s'");save();
 const catalogModule=(await c.query("select id from platform.module_definitions where code='services_catalog' and version=1 and is_active and lifecycle_status='published'")).rows;assert.equal(catalogModule.length,1);
 for(const i of [0,1]){
  const role=i===0?f.roles[0]:f.roles[2];
  const inserted=await c.query("insert into identity.role_permissions(role_id,permission_id,effect) select $1,id,'allow' from identity.permissions where code='services.catalog.read' returning role_id",[role]);assert.equal(inserted.rowCount,1);
  await c.query("insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,activated_by,reason) values($1,$2,$3,'services_catalog','active',$4,'Core17 owned synthetic assembly fixture only')",[f.tenants[i],f.workspaces[i],catalogModule[0].id,f.actors[0]]);
  await c.query("insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value) values($1,'module.services_catalog','boolean',true)",[f.workspaces[i]]);
 }
 const ack=await c.query('commit');assert.equal(ack.command,'COMMIT');r.state='COMMIT_TAG_OBSERVED';save();console.log(JSON.stringify(r));
}catch(e){r.state='FAILED_OR_UNKNOWN_STOP';r.code=e.code??e.name;r.message=e.message;try{r.cleanup=(await c.query('rollback')).command;}catch{r.cleanup='UNKNOWN';}save();console.error(JSON.stringify({state:r.state,code:r.code,private_diagnostic:true}));process.exitCode=1;}finally{await c.end();}
