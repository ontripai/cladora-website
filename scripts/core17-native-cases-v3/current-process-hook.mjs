'use strict';
/** Reviewed test-only driver probe. No framework/node_modules file is patched.
 * Installed only by an exact private Node preload on a separately admitted
 * next-start lifecycle. Unselected pools/scopes delegate to original pg. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const sourcePath=fileURLToPath(import.meta.url);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalize=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
function privateRead(p,pin){const st=fs.lstatSync(p);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.uid===process.getuid()&&(st.mode&0o077)===0&&st.size<=65536);const parent=fs.lstatSync(path.dirname(p));assert.ok(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===process.getuid()&&(parent.mode&0o077)===0);const b=fs.readFileSync(p);if(pin)assert.equal(hash(b),pin);return b;}
function exclusive(p,value){const fd=fs.openSync(p,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{const b=Buffer.from(JSON.stringify(value)+'\n');assert.equal(fs.writeSync(fd,b),b.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
const pending=new WeakMap();
export function install(expected){
 // The generated wrapper has already excluded launcher/build/other processes.
 const cfg=JSON.parse(privateRead(expected.config_file,expected.config_sha256));
 assert.equal(cfg.contract,'core17.current-process-pg-probe.v3');assert.equal(cfg.App,'fd7bc8799ce8aba970bb74e2a9035d4ee41e5119');assert.equal(cfg.installed,'ee883b62cf4a318af3450c506931a969623b8987');
 assert.match(cfg.request_sha256,/^[a-f0-9]{64}$/);assert.equal(cfg.target.host,'127.0.0.1');assert.equal(cfg.target.port,55422);assert.equal(cfg.target.database_name,'postgres');assert.ok(Array.isArray(cfg.scopes)&&cfg.scopes.length>0&&cfg.scopes.length<=10);
 for(const s of cfg.scopes){assert.ok(['observe','precommit','precommit-disconnect','post-commit-ack'].includes(s.fault));assert.ok(s.keys.length>=1&&s.keys.length<=2&&s.keys.every(k=>typeof k==='string'&&k.startsWith('core-tx.v1:'+s.workspace+':')));}
 assert.equal(fs.realpathSync(process.cwd()),cfg.app_root);assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:cfg.app_root,encoding:'utf8'}).trim(),cfg.App);
 assert.equal(cp.execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:cfg.app_root,encoding:'utf8'}).trim(),'6a660dc056e73dc547d9fd6b12fc0d83eca66ea2');cp.execFileSync('git',['diff','--quiet','HEAD','--'],{cwd:cfg.app_root});
 assert.equal(fs.readFileSync(path.join(cfg.app_root,'.next/BUILD_ID'),'utf8').trim(),'AupRkr1rvWViv-w3ffC4f');assert.equal(hash(fs.readFileSync(sourcePath)),expected.hook_sha256);
 const req=createRequire(path.join(cfg.app_root,'package.json'));
 assert.equal(req('next/package.json').version,'16.4.1');assert.equal(req('zod/package.json').version,'4.6.6');assert.equal(req('pg/package.json').version,cfg.pg_version);
 const pg=req('pg'),original=pg.Pool.prototype.connect;
 const journal=path.join(cfg.output,'app-journal.private.ndjson');const fd=fs.openSync(journal,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 let seq=0,ioError=null,used=0;
 function emit(value){try{const b=Buffer.from(JSON.stringify({seq:++seq,node_pid:process.pid,...value})+'\n');used+=b.length;assert.ok(used<=32*1024*1024,'PROBE_JOURNAL_BOUND');assert.equal(fs.writeSync(fd,b),b.length);fs.fsyncSync(fd);}catch(e){ioError??=e;}}
 pg.Pool.prototype.connect=function(...args){
  const o=this.options;if(o.host!==cfg.target.host||Number(o.port)!==cfg.target.port||o.database!==cfg.target.database_name||o.user!=='cladora_core_runtime')return original.apply(this,args);
  assert.equal(args.length,0,'CORE_PROBE_PROMISE_LEASE_ONLY');
  return original.apply(this,args).then(client=>{
   if(pending.has(client))return client;
   const state={pid:client.processID,scope:null,physical:false,history:[],stages:new Set(),ledger:null,receipt:null};pending.set(client,state);
   function event(v){const entry={backend_pid:client.processID,...v};if(state.scope)emit({case:state.scope.case,...entry});else{state.history.push(entry);if(state.history.length>64)state.history.shift();}}
   client.connection.on('commandComplete',v=>event({type:'CommandComplete',tag:v.text}));
   client.connection.on('readyForQuery',v=>event({type:'ReadyForQuery',status:v.status}));
   client.connection.on('errorMessage',v=>event({type:'errorMessage',code:v.code}));
   const query=client.query.bind(client);
   client.query=async(text,values=[])=>{
    assert.equal(typeof text,'string');const q=normalize(text);
    if(q.startsWith("select set_config('request.jwt.claims',")){
     const claims=JSON.parse(values[0]);const found=cfg.scopes.find(s=>claims.sub===cfg.actor&&values[2]===s.context&&values[3]===s.workspace&&claims.active_tenant_id===s.tenant&&claims.active_membership_id===s.membership);
     if(found&&state.physical&&!state.scope){state.scope=found;emit({case:found.case,backend_pid:client.processID,type:'admitted',history:state.history,scope:{actor:cfg.actor,context:found.context,workspace:found.workspace,tenant:found.tenant,membership:found.membership}});}
    }
    if(state.scope&&q!=='rollback'&&fs.existsSync(path.join(cfg.output,'halt-'+state.scope.case+'.json'))){const stop=JSON.parse(privateRead(path.join(cfg.output,'halt-'+state.scope.case+'.json')));assert.equal(stop.case,state.scope.case);assert.equal(stop.request_sha256,cfg.request_sha256);const e=Error('CORE17_GROUP_ABORT_PREWRITE');e.code='CORE17_GROUP_ABORT_PREWRITE';throw e;}
    // A known journal failure must stop selected work BEFORE raw dispatch.
    // Rollback may still reach PG; its lost evidence is never a claimed ACK.
    if(state.scope&&ioError&&q!=='rollback')throw ioError;
    event({type:'query',sql:q,...(q==='select pg_advisory_xact_lock(hashtextextended($1,0))'?{label:values[0]}:{})});
    if(state.scope&&ioError&&q!=='rollback')throw ioError;
    try{
     const result=await query(text,values);
     if(q.startsWith('select pg_backend_pid() as backend_pid,current_user::text as principal')){
      const p=result.rows[0];assert.ok(result.rowCount===1&&p.database_oid===cfg.target.database_oid&&p.database_name===cfg.target.database_name&&p.backend_marker===cfg.target.backend_id&&p.principal==='cladora_core_runtime'&&p.login==='cladora_core_runtime'&&!p.rolsuper&&!p.rolbypassrls);state.physical=true;
     }
     if(state.scope){
      if(q==="select txid_current()::text as id, clock_timestamp()::text as now"){assert.match(result.rows[0].id,/^[1-9][0-9]*$/);state.database_transaction_id=result.rows[0].id;event({type:'database-transaction',value:state.database_transaction_id});}
      if(q.startsWith('insert into platform.idempotency_keys')){state.stages.add('reservation');state.ledger={tenant_id:values[0],actor_id:values[1],canonical_key:values[2],request_hash:values[3]};event({type:'ledger',value:state.ledger});}
      if(q.startsWith('select app_private.apply_service_v14_execution_v1('))state.stages.add('mutation');
      if(q.startsWith('insert into audit.events'))state.stages.add('audit');
      if(q.startsWith('insert into platform.outbox_events'))state.stages.add('outbox');
      if(q==='update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200 where tenant_id=$1 and key=$2'){state.receipt=JSON.parse(values[2]);event({type:'receipt',value:state.receipt});}
      const approved=state.ledger&&state.scope.keys.includes(state.ledger.canonical_key)&&state.ledger.actor_id===cfg.actor&&state.ledger.tenant_id===state.scope.tenant;
      if(approved&&state.scope.fault==='precommit'&&q==='update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200 where tenant_id=$1 and key=$2'){
       assert.deepEqual([...state.stages].sort(),['audit','mutation','outbox','reservation']);exclusive(path.join(cfg.output,'precommit.consumed.json'),{case:state.scope.case,node_pid:process.pid,backend_pid:client.processID,key:state.ledger.canonical_key});event({type:'fault',kind:'precommit',stages:[...state.stages]});
       await query('select 1 / $1::integer as core17_precommit_fault',[0]);assert.fail('PG_FAULT_NOT_FIRED');
      }
      if(approved&&state.scope.fault==='precommit-disconnect'&&q==='update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200 where tenant_id=$1 and key=$2'){
       assert.deepEqual([...state.stages].sort(),['audit','mutation','outbox','reservation']);assert.match(state.database_transaction_id,/^[1-9][0-9]*$/);
       exclusive(path.join(cfg.output,'precommit-disconnect.consumed.json'),{node_pid:process.pid,backend_pid:client.processID,xid:state.database_transaction_id});event({type:'fault',kind:'precommit-disconnect',stages:[...state.stages]});
       await client.end();const e=Error('CORE17_CONTROLLED_PRECOMMIT_DISCONNECT');e.code='CORE17_PRECOMMIT_DISCONNECT';throw e;
      }
      if(approved&&state.scope.fault==='post-commit-ack'&&q==='commit'){
       // Actual CommandComplete COMMIT/RFQ I is durably journaled BEFORE the
       // controlled driver ACK fault. This is not a fabricated HTTP response.
       exclusive(path.join(cfg.output,'ack.consumed.json'),{case:state.scope.case,node_pid:process.pid,backend_pid:client.processID,key:state.ledger.canonical_key});event({type:'fault',kind:'post-commit-ack'});
       const e=Error('CORE17_CONTROLLED_ACK_FAULT');e.code='CORE17_CONTROLLED_ACK_FAULT';throw e;
      }
     }
     if(state.scope&&ioError)throw ioError;return result;
    }finally{event({type:'query-finished'});}
   };
   return client;
  });
 };
 const ticks=fs.readFileSync('/proc/self/stat','utf8').split(') ')[1].split(' ')[19];
 exclusive(path.join(cfg.output,'hook-ready.private.json'),{contract:cfg.contract,node_pid:process.pid,start_ticks:ticks,App:cfg.App,build:cfg.build,config_sha256:expected.config_sha256,hook_sha256:expected.hook_sha256,mode:'SCOPED_PG_DRIVER_OBSERVER_AND_FAULT; NO_SQL_DISPATCH_AT_PRELOAD'});
 return{restore(){pg.Pool.prototype.connect=original;}};
}
