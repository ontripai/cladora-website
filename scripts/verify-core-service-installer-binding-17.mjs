/** Explicit binding -> actual ordinary principal, read-only target verification. */
import assert from 'node:assert/strict';
import {writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {readOwnedInstallerFileV1,installerTargetV1,loadInstallerCredentialBindingV1} from './lib/core-installer-credential-binding-v1.mjs';
assert.equal(process.argv.length,4);const root='/workspace/private/cladora-functional-dev-v1',config=JSON.parse(readOwnedInstallerFileV1(root+'/core15/service-runtime-binding.json',root));
const credential=loadInstallerCredentialBindingV1({privateRoot:root,generation:process.argv[2],bindingPath:process.argv[3],expectedTarget:installerTargetV1(config.target)});
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const file=root+'/core17-installer-binding-native.json';assert.equal(existsSync(file),false,'existing observation receipt');
const c=new pg.Client({host:credential.target.host,port:credential.target.port,database:credential.target.database_name,user:credential.principal,password:credential.password,connectionTimeoutMillis:5000,query_timeout:10000});
try{await c.connect();const row=(await c.query("select current_user::text principal,session_user::text login,(select oid::int from pg_database where datname=current_database()) oid,(select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') marker,rolsuper,rolbypassrls from pg_roles where rolname=current_user")).rows[0];assert.equal(row.principal,credential.principal);assert.equal(row.login,credential.principal);assert.equal(row.oid,credential.target.database_oid);assert.equal(row.marker,credential.target.backend_id);assert.equal(row.rolsuper,false);assert.equal(row.rolbypassrls,false);
 const e={contract:'core17-installer-binding-native.v1',state:'PASS_EXPLICIT_BINDING_ACTUAL_OWNED_PRINCIPAL',generation:credential.generation,binding_sha256:credential.binding_sha256,observed:row,SQL_effect:'SELECT_ONLY_NO_PROVISIONING'};writeFileSync(file,JSON.stringify(e,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({state:e.state,generation:e.generation,private_receipt_sha256:createHash('sha256').update(readOwnedInstallerFileV1(file,root)).digest('hex')}));
}finally{await c.end();}
