/** One exact reviewed Core15 unit via existing node-pg. No provisioning/controller,
 * auto-all, SQL selector, repair/retry, credential generation or target fallback.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {deriveCore15NativePayloadV1} from './lib/core15-install-payload.mjs';
const root=new URL('../',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
export function validateCore15InstallTarget(value){
 const keys=['contract','backend_id','platform_full_sha','purpose','host','port','database_name','database_oid','installer_role','connection_env'];
 if(!value||typeof value!=='object'||Object.keys(value).sort().join('|')!==keys.sort().join('|')
  ||value.contract!=='core15-platform12-install-target.v1'||value.purpose!=='owned-isolated-persistent-development'
  ||typeof value.backend_id!=='string'||!/^core15-dev:[A-Za-z0-9_.:-]{8,160}$/.test(value.backend_id)||!/^cladora_dev_[a-z0-9_]+$/.test(value.database_name)
  ||!/^[a-f0-9]{40}$/.test(value.platform_full_sha)||!['127.0.0.1','localhost','::1'].includes(value.host)
  ||!Number.isSafeInteger(value.port)||value.port<1||value.port>65535||!Number.isSafeInteger(value.database_oid)||value.database_oid<1
  ||value.installer_role!=='postgres'||!/^[A-Z][A-Z0-9_]{5,100}$/.test(value.connection_env))throw Error('CORE15_TARGET_CONTRACT_INVALID');
 return Object.freeze({...value});
}
export async function main(args){
 const apply=args[0]==='apply';if(!apply&&args[0]!=='inspect')throw Error('Use inspect|apply --unit UNIT [--target FILE --target-sha SHA256]');
 const flags={};for(let i=1;i<args.length;i+=2){if(!['--unit','--target','--target-sha'].includes(args[i])||!args[i+1]||Object.hasOwn(flags,args[i]))throw Error('CORE15_UNKNOWN_ARGUMENT');flags[args[i]]=args[i+1];}
 const manifest=JSON.parse(readFileSync(new URL('supabase/install/core-functional-runtime-v1/manifest.json',root),'utf8'));
 const unit=manifest.units.find(u=>u.id===flags['--unit']);if(!unit)throw Error('CORE15_UNKNOWN_UNIT');
 const source=readFileSync(new URL(unit.path,root));if(source.length!==unit.bytes||sha(source)!==unit.sha256)throw Error('CORE15_UNIT_IDENTITY_MISMATCH');
 const payload=unit.payload_transform?Buffer.from(deriveCore15NativePayloadV1(source.toString('utf8'),unit.entry_guc_unit)):source;
 if(payload.length!==unit.payload.bytes||sha(payload)!==unit.payload.sha256)throw Error('CORE15_PAYLOAD_IDENTITY_MISMATCH');
 if(!apply){console.log(JSON.stringify({operation:'inspect',unit:unit.id,bytes:payload.length,sha256:unit.payload.sha256,source_sha256:unit.sha256,execution:'NOT_RUN'}));return;}
 // Only a specific Platform12 handoff hash supplied by the authorized operator.
 // This consistency check is NOT itself owner authorization or custody evidence.
 if(!flags['--target']||!/^[a-f0-9]{64}$/.test(flags['--target-sha']??''))throw Error('CORE15_REVIEWED_PLATFORM_TARGET_REQUIRED');
 const targetBytes=readFileSync(resolve(flags['--target']));if(sha(targetBytes)!==flags['--target-sha'])throw Error('CORE15_TARGET_IDENTITY_MISMATCH');
 const target=validateCore15InstallTarget(JSON.parse(targetBytes));
 const secret=process.env[target.connection_env];if(!secret)throw Error('CORE15_PRIVATE_CONNECTION_BINDING_MISSING');
 const url=new URL(secret);if(!['postgres:','postgresql:'].includes(url.protocol)||url.search||url.hostname.replace(/^\[|\]$/g,'')!==target.host
  ||Number(url.port||5432)!==target.port||decodeURIComponent(url.pathname.slice(1))!==target.database_name||decodeURIComponent(url.username)!==target.installer_role)throw Error('CORE15_CONNECTION_SELECTOR_MISMATCH');
 const client=new pg.Client({connectionString:secret,connectionTimeoutMillis:5000,query_timeout:45000,statement_timeout:30000,lock_timeout:5000,application_name:'cladora-core15-install-consumer.v1'});
 let sent=false,commitAck=false;const receipt={contract:'core15-install-observation.v1',unit:unit.id,sha256:unit.payload.sha256,source_sha256:unit.sha256,platform_full_sha:target.platform_full_sha,state:'NOT_STARTED',error_code:null};
 const observe=async()=>{const r=await client.query(`select current_database() as database_name,(select oid::integer from pg_database where datname=current_database()) as database_oid,
  current_user::text as principal,session_user::text as login,pg_backend_pid() as backend_pid,current_setting('server_version_num')::integer as version,
  r.rolsuper,r.rolbypassrls from pg_roles r where r.rolname=current_user`);
  const x=r.rows[0];if(r.rowCount!==1||x.database_name!==target.database_name||x.database_oid!==target.database_oid||x.principal!=='postgres'||x.login!=='postgres'
   ||x.rolsuper!==false||x.rolbypassrls!==false||x.version<170000||x.version>=180000||!Number.isSafeInteger(x.backend_pid))throw Error('CORE15_TARGET_OBSERVATION_MISMATCH');return x;};
 try{
  await client.connect();const before=await observe();receipt.backend_pid=before.backend_pid;
  await client.query("select set_config('cladora.install.target',$1,false),set_config('cladora.install.target_oid',$2,false),set_config('cladora.install.unit',$3,false)",[target.backend_id,String(target.database_oid),unit.entry_guc_unit??unit.id]);
  sent=true;const answer=await client.query(payload.toString('utf8'));
  const last=Array.isArray(answer)?answer.at(-1):answer;commitAck=last?.command==='COMMIT';
  if(!commitAck)throw Error('CORE15_COMMIT_ACK_NOT_OBSERVED');
  const after=await observe();if(before.backend_pid!==after.backend_pid)throw Error('CORE15_BACKEND_CORRELATION_MISMATCH');
  receipt.state='COMMIT_ACK_OBSERVED_POSTSTATE_PENDING';
  receipt.driver_settlement='node-pg query completion; separate raw ReadyForQuery capture NOT_ASSERTED';
  receipt.next='STOP until independent per-unit poststate/ACL/default verification; no automatic next unit';
 }catch(error){receipt.state=sent?'UNKNOWN':'PRE_SEND_STOP';receipt.commit_ack_observed=commitAck;
  receipt.error_code=typeof error?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code)?error.code:null;
  // No blind resend, repair, claimed rollback or partial-state success.
 }finally{try{await client.end();}catch{receipt.cleanup='UNKNOWN';}}
 console.log(JSON.stringify(receipt));if(receipt.state!=='COMMIT_ACK_OBSERVED_POSTSTATE_PENDING')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main(process.argv.slice(2));
