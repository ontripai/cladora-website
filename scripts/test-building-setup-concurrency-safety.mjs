import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {copySnapshot, loadFixture, observeProcess, safeFailure, succeeded, validateCi} from './run-building-setup-concurrency-ci.mjs';
import {cleanupOwnedDatabase, parseProofFailureRecord, proofFailureRecord, validateProofTarget, withProofCleanup} from './test-building-workspace-onboarding-postgres.mjs';

// Offline: only isolated Node child processes/streams and mocked DB clients.
// No Docker, PostgreSQL, Auth, HTTP, remote service, server or runtime startup.
const sha='a'.repeat(40), source='cladora_setup_fixture_'+'b'.repeat(32);
const env={GITHUB_ACTIONS:'true',BUILDING_SETUP_CI_OWNS_FRESH_DAEMON:'1',BUILDING_SETUP_TEST_LEASE:'building-12-1-'+sha,
 BUILDING_SETUP_EPHEMERAL:'1',BUILDING_SETUP_TEST_DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:54322/'+source,
 BUILDING_SETUP_ACCEPTED_FIXTURE:JSON.stringify({actor:'c2200000-0000-4000-8000-000000000001',context:'c2200000-0000-4000-8000-000000000100',workspace:'c2200000-0000-4000-8000-000000000050'})};
const info={Config:{Labels:{'com.supabase.cli.project':'cladora-local'},Image:'public.ecr.aws/supabase/postgres:17.6.1.095'}};
const secret='DO_NOT_EMIT_TOKEN_COOKIE_SQL_OR_ROW';

function node(code){return spawn(process.execPath,['-e',code],{stdio:['pipe','pipe','pipe']});}
async function snapshot(dumpCode,restoreCode,options={}){
 const children=[],commands=[];
 const spawnProcess=(command,args)=>{
  commands.push([command,args]);
  if(options.throwRestore&&commands.length===2)throw Error(secret);
  const child=node(commands.length===1?dumpCode:restoreCode);
  if(commands.length===2)child.stdout.resume();
  children.push(child);
  return child;
 };
 try{await copySnapshot({spawnProcess,docker:['--host=unix:///var/run/docker.sock'],dockerEnv:{},container:'supabase_db_cladora-local',source});return {children,commands};}
 catch(error){
  // If copySnapshot returned early this check detects a live/unclosed child.
  assert.ok(children.every(child=>child.exitCode!==null||child.signalCode!==null),'all owned processes settled before return');
  assert.ok(!error.message.includes(secret));
  error.commands=commands;
  throw error;
 }
}

test('accept exact official image, full-SHA lease and loopback fixture',()=>{
 for(const registry of ['public.ecr.aws/supabase/','ghcr.io/supabase/','supabase/'])validateCi(env,sha,{Config:{...info.Config,Image:registry+'postgres:17.6.1.095'}});
 assert.equal(validateProofTarget(env,sha).target.pathname,'/'+source);
 const alias={...env,BUILDING_SETUP_TEST_DATABASE_URL:env.BUILDING_SETUP_TEST_DATABASE_URL.replace('127.0.0.1','[::1]')};
 assert.equal(validateProofTarget(alias,sha).target.hostname,'[::1]');
});

test('reject missing CI/daemon, mismatched/partial lease, project and image before work',()=>{
 for(const delta of [{GITHUB_ACTIONS:'false'},{BUILDING_SETUP_CI_OWNS_FRESH_DAEMON:'0'},{BUILDING_SETUP_TEST_LEASE:'building-12-1-'+'c'.repeat(40)},{BUILDING_SETUP_TEST_LEASE:'building-12-1-'+sha+'junk'}]) assert.throws(()=>validateCi({...env,...delta},sha,info));
 assert.throws(()=>validateCi(env,sha.slice(0,7),info));
 for(const Config of [{...info.Config,Image:'attacker.example/supabase/postgres:17.6.1.095'},{...info.Config,Image:'supabase/postgres:latest'},{...info.Config,Image:'ghcr.io/attacker/postgres:17.6.1.095'},{...info.Config,Image:'ghcr.io/supabase/postgres:latest'},{...info.Config,Image:'ghcr.io/supabase/postgres:17.6.1.095-extra'},{...info.Config,Labels:{'com.supabase.cli.project':'foreign'}}]) assert.throws(()=>validateCi(env,sha,{Config}));
});

test('reject remote, alternate port/user, shared DB, query/fragment and encoded endpoint overrides',()=>{
 for(const url of ['https://127.0.0.1:54322/'+source,env.BUILDING_SETUP_TEST_DATABASE_URL.replace('127.0.0.1','remote.example'),env.BUILDING_SETUP_TEST_DATABASE_URL.replace('54322','5432'),env.BUILDING_SETUP_TEST_DATABASE_URL.replace('postgres:postgres','other:postgres'),env.BUILDING_SETUP_TEST_DATABASE_URL.replace(source,'postgres'),env.BUILDING_SETUP_TEST_DATABASE_URL+'?host=remote.example',env.BUILDING_SETUP_TEST_DATABASE_URL+'#fragment',env.BUILDING_SETUP_TEST_DATABASE_URL.replace(source,'%63'+source.slice(1)),secret]){
  assert.throws(()=>validateProofTarget({...env,BUILDING_SETUP_TEST_DATABASE_URL:url},sha));
 }
 for(const delta of [{BUILDING_SETUP_EPHEMERAL:'0'},{BUILDING_SETUP_TEST_LEASE:'building-12-1-'+'c'.repeat(40)},{BUILDING_SETUP_ACCEPTED_FIXTURE:secret},{BUILDING_SETUP_ACCEPTED_FIXTURE:JSON.stringify({actor:'-'.repeat(36)})}]) assert.throws(()=>validateProofTarget({...env,...delta},sha));
});

test('successful streaming copy preserves exact command safety and awaits both processes',async()=>{
 const {children,commands}=await snapshot("process.stdout.write('synthetic');", "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.exit(s==='synthetic'?0:7));");
 assert.ok(children.every(child=>child.exitCode===0));
 assert.equal(commands[0][0],'docker');
 assert.ok(commands[0][1].includes('pg_dump'));
 assert.ok(commands[0][1].includes('--clean')&&commands[0][1].includes('--if-exists'));
 assert.equal(commands[0][1][commands[0][1].indexOf('-d')+1],'postgres');
 assert.equal(commands[1][1][commands[1][1].indexOf('-d')+1],source);
 assert.ok(commands[1][1].includes('ON_ERROR_STOP=1')&&commands[1][1].includes('VERBOSITY=sqlstate'));
});

test('restore SQLSTATE survives induced dump SIGTERM/EPIPE; no raw stderr emitted',async()=>{
 await assert.rejects(snapshot("setInterval(()=>process.stdout.write('x'.repeat(65536)),2);", "process.stderr.write('ERROR: 42501 '+"+JSON.stringify(secret)+"+'\\n');process.exit(3);"),error=>{
  assert.equal(error.diagnostic.stage,'snapshot');
  assert.ok(error.diagnostic.failedStages.includes('restore'));
  assert.equal(error.diagnostic.restore.exitCode,3);
  assert.equal(error.diagnostic.restore.sqlstate,'42501');
  assert.ok(error.diagnostic.dump.signal||error.diagnostic.dump.exitCode!==0);
  assert.ok(error.diagnostic.pipeError);
  return true;
 });
});

test('dump failure remains failed even when restore consumes EOF and exits zero',async()=>{
 await assert.rejects(snapshot("process.stderr.write('pg_dump: permission denied '+"+JSON.stringify(secret)+");process.exit(2);", "process.stdin.resume();"),error=>{
  assert.deepEqual(error.diagnostic.failedStages,['dump']);
  assert.equal(error.diagnostic.dump.category,'permission-denied');
  assert.equal(error.diagnostic.dump.exitCode,2);
  assert.equal(error.diagnostic.restore.exitCode,0);
  return true;
 });
});

test('independent dump/restore failures retain both exit codes without claiming root cause',async()=>{
 await assert.rejects(snapshot("process.stdout.write('synthetic');process.exitCode=2;", "process.stdin.resume();process.stdin.on('end',()=>{process.stderr.write('ERROR: 42601\\n');process.exitCode=3;});"),error=>{
  assert.equal(error.diagnostic.dump.exitCode,2);
  assert.equal(error.diagnostic.restore.exitCode,3);
  assert.equal(error.diagnostic.restore.sqlstate,'42601');
  assert.deepEqual(error.diagnostic.failedStages,['dump','restore']);
  assert.equal(error.diagnostic.primary,undefined);
  return true;
 });
});

test('snapshot rejects foreign destination before spawning any process',async()=>{
 await assert.rejects(copySnapshot({source:'postgres',spawnProcess:()=>assert.fail('must not spawn')}));
});

test('zero-exit incomplete restore is never accepted after dump start failure',async()=>{
 const missing=spawn(process.execPath+'-does-not-exist',[],{stdio:['pipe','pipe','pipe']});
 let calls=0;
 await assert.rejects(copySnapshot({spawnProcess:()=>++calls===1?missing:node('process.stdin.resume();'),docker:[],dockerEnv:{},container:'unused',source}),error=>{
  assert.equal(error.diagnostic.dump.startError,'ENOENT');
  return true;
 });
});

test('synchronous restore spawn failure terminates and awaits dump',async()=>{
 await assert.rejects(snapshot("setInterval(()=>process.stdout.write('x'),2);",'',{throwRestore:true}),error=>{
  assert.equal(error.diagnostic.restore.category,'process-start-failed');
  return true;
 });
});

test('asynchronous restore spawn error is recorded and both processes settle',async()=>{
 let calls=0;const children=[];
 await assert.rejects(copySnapshot({spawnProcess:()=>{
  const child=++calls===1?node("setInterval(()=>process.stdout.write('x'.repeat(65536)),2);"):spawn(process.execPath+'-does-not-exist',[],{stdio:['pipe','pipe','pipe']});
  children.push(child);return child;
 },docker:[],dockerEnv:{},container:'unused',source}),error=>{
  assert.equal(error.diagnostic.restore.startError,'ENOENT');
  assert.ok(children.every(child=>child.exitCode!==null||child.signalCode!==null||child.pid===undefined));
  return true;
 });
});

test('fixture load success/failure uses actual stdin stream and redacted SQLSTATE',async()=>{
 const good=node("let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.exit(s==='begin;\\nselect 1;\\ncommit;\\n'?0:4));");good.stdout.resume();
 await loadFixture(good,'select 1;');
 const bad=node("process.stderr.write('ERROR: 42601 '+"+JSON.stringify(secret)+");process.exit(3);");bad.stdout.resume();
 await assert.rejects(loadFixture(bad,secret.repeat(100000)),error=>{
  assert.equal(error.diagnostic.process.sqlstate,'42601');
  assert.ok(!error.message.includes(secret));return true;
 });
});

test('bounded diagnostics drain noisy stderr and do not serialize arbitrary error text/codes',async()=>{
 const child=node("process.stderr.write('FATAL: 53100 '+"+JSON.stringify(secret)+"+'\\n'+'z'.repeat(200000));process.exitCode=1;");child.stdout.resume();
 const result=await observeProcess(child,'restore');
 assert.equal(result.sqlstate,'53100');
 assert.ok(JSON.stringify(result).length<300&&!JSON.stringify(result).includes(secret));
 const error=Object.assign(Error(secret),{code:secret});
 assert.ok(!safeFailure(secret,error).message.includes(secret));
});

test('signal failure remains failure and cleanup cannot target source postgres or foreign DB',async()=>{
 const child=node('setInterval(()=>{},1000);');child.stdout.resume();
 const done=observeProcess(child,'dump');child.kill('SIGTERM');
 assert.equal((await done).signal,'SIGTERM');
 for(const name of ['postgres','foreign','cladora_setup_fixture_bad','cladora_setup_proof_'+secret]) await assert.rejects(cleanupOwnedDatabase({admin:{query:()=>assert.fail('no DB query allowed')},name,created:true}));
 let queries=0;await cleanupOwnedDatabase({admin:{query:()=>{queries++;}},name:source,created:false});assert.equal(queries,0);
});

test('graceful cleanup attempts all owned ends before drop, verifies absence, never forces',async()=>{
 const events=[];
 await cleanupOwnedDatabase({admin:{query:async(sql,values)=>{events.push(sql);if(values)assert.deepEqual(values,[source]);return {rows:[{n:0}]};}},name:source,created:true,clients:[{end:async()=>events.push('end1')},{end:async()=>events.push('end2')}]});
 assert.deepEqual(events.slice(0,2),['end1','end2']);
 assert.equal(events[2],'drop database "'+source+'"');
 assert.ok(!events.join(' ').match(/force|terminate/i));
});

test('one end failure does not skip other owned ends/drop; foreign session drop refusal stays failed',async()=>{
 const events=[];
 await assert.rejects(cleanupOwnedDatabase({admin:{query:async()=>{events.push('drop');throw Error(secret);}},name:source,created:true,clients:[{end:async()=>{events.push('end1');throw Error(secret);}},{end:async()=>events.push('end2')}]}),error=>!error.message.includes(secret));
 assert.deepEqual(events,['end1','end2','drop']);
 await assert.rejects(cleanupOwnedDatabase({admin:{query:async()=>({rows:[{n:1}]})},name:source,created:true}));
 await assert.rejects(cleanupOwnedDatabase({admin:{query:async()=>{throw Object.assign(Error(secret),{code:'55006'});}},name:source,created:true}),error=>{
  assert.equal(safeFailure('cleanup',error).diagnostic.sqlstate,'55006');
  assert.ok(!safeFailure('cleanup',error).message.includes(secret));
  return true;
 });
});

test('entrypoint refusal before Docker/DB and retained actual-role concurrency/no-write assertions',async()=>{
 const child=spawn(process.execPath,['scripts/run-building-setup-concurrency-ci.mjs'],{env:{...process.env,GITHUB_ACTIONS:'false'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
 const [exit]=await once(child,'close');assert.equal(exit,1);assert.ok(output.includes('preflight')&&!output.includes(secret));
 const proof=await readFile(new URL('./test-building-workspace-onboarding-postgres.mjs',import.meta.url),'utf8');
 for(const marker of ["set local role authenticated","role:'authenticated',aal:'aal2'","both creation sessions complete","payload collision is zero-write", "a prior creation receipt cannot bypass Context revoke","source fixture has no active sessions", "source fixture lease must match before clone"])assert.ok(proof.includes(marker));
 const g2Start=proof.indexOf("if(commandProof==='g2'){",proof.indexOf('const race='));
 const g2End=proof.indexOf('} else {',g2Start);
 assert.ok(g2Start>0&&g2End>g2Start,'separate G2 replay branch remains explicit');
 assert.equal((proof.slice(g2Start,g2End).match(/checks\+\+/g)??[]).length,3,'three additional G2-only checks retained');
 const baselineProof=proof.slice(0,g2Start)+proof.slice(g2End);
 assert.equal((baselineProof.match(/checks\+\+/g)??[]).length,15,'all original baseline assertion counter sites retained');
 assert.ok(!proof.match(/pg_terminate_backend|drop database[^\n]*force|disable trigger|session_replication_role\s*=/i));
});

const legacyRecord=sqlstate=>({suite:'building-setup-postgres',result:'FAIL',sqlstate,detail:'proof or cleanup failed; sensitive output withheld'});
async function childDiagnostic(record,{exit=1,split=false,prefix='',suffix=''}={}){
 const wire=prefix+(typeof record==='string'?record:JSON.stringify(record))+suffix;
 const code=split?
  'const s='+JSON.stringify(wire)+';let i=0;const timer=setInterval(()=>{if(i<s.length)process.stderr.write(s[i++]);else{clearInterval(timer);process.exitCode='+exit+';}},1);':
  'process.stderr.write('+JSON.stringify(wire)+');process.exitCode='+exit+';';
 const child=node(code);child.stdout.resume();
 return observeProcess(child,'concurrency-proof');
}

for(const sqlstate of ['42501','40001'])test('R1 forwards only validated real-child JSON SQLSTATE '+sqlstate,async()=>{
 for(const record of [legacyRecord(sqlstate),proofFailureRecord(Object.assign(Error(secret),{code:sqlstate}))]){
  const result=await childDiagnostic(record,{suffix:'\n'});
  assert.equal(result.sqlstate,sqlstate);assert.deepEqual(result.proofFailure,record);
  assert.equal(result.category,'proof-failed');assert.equal(succeeded(result),false);
 }
 assert.equal(safeFailure('concurrency-proof',{code:sqlstate}).diagnostic.sqlstate,sqlstate);
});

test('R1 bounded line buffering accepts split safe JSON and rejects FAIL even at exit zero',async()=>{
 const result=await childDiagnostic(legacyRecord('40001'),{exit:0,split:true});
 assert.equal(result.sqlstate,'40001');assert.equal(result.exitCode,0);assert.equal(succeeded(result),false);
});

test('R1 rejects unknown schema/values and does not parse noise as a psql error',async()=>{
 const invalid=[{...legacyRecord('42501'),token:secret},{...legacyRecord(secret)},
  {...legacyRecord('42501'),detail:secret},{...legacyRecord('42501'),suite:'foreign'},
  {...legacyRecord('42501'),result:'PASS'},['ERROR: 42501 '+secret],
  {noise:'ERROR: 42501 '+secret},JSON.stringify(legacyRecord('42501'))+secret];
 for(const record of invalid){
  const result=await childDiagnostic(record,{suffix:'\n'});
  assert.equal(result.sqlstate,null);assert.equal(result.proofFailure,undefined);assert.equal(succeeded(result),false);
  assert.ok(!JSON.stringify(result).includes(secret));
 }
});

test('R1 rejects oversized records/noisy lines and resumes only at a clean record boundary',async()=>{
 const oversized=JSON.stringify({...legacyRecord('42501'),noise:secret.repeat(2000)});
 const rejected=await childDiagnostic(oversized,{suffix:'\n'});
 assert.equal(rejected.proofFailure,undefined);assert.equal(rejected.sqlstate,null);
 assert.ok(!JSON.stringify(rejected).includes(secret));
 const recovered=await childDiagnostic(legacyRecord('40001'),{prefix:secret.repeat(200)+'\n',suffix:'\n'});
 assert.equal(recovered.sqlstate,'40001');assert.ok(!JSON.stringify(recovered).includes(secret));
});

test('R2 preserves SQL primary, owned close/drop and admin end failures separately',async()=>{
 const events=[];
 let failure;
 try{await withProofCleanup(async()=>{throw Object.assign(Error(secret),{code:'42501'});},[
  {stage:'owned-database',run:()=>cleanupOwnedDatabase({name:source,created:true,clients:[
   {end:async()=>{events.push('end1');throw Error(secret);}},{end:async()=>events.push('end2')}],
   admin:{query:async()=>{events.push('drop');throw Object.assign(Error(secret),{code:'55006'});}}})},
  {stage:'admin-end',run:async()=>{events.push('admin-end');throw Object.assign(Error(secret),{code:'08006'});}}
 ]);}catch(error){failure=error;}
 const record=proofFailureRecord(failure);
 assert.deepEqual(events,['end1','end2','drop','admin-end']);
 assert.deepEqual(record.primary,{category:'sql-error',sqlstate:'42501'});
 assert.deepEqual(record.cleanup,[{stage:'owned-database',category:'sql-error',sqlstate:'55006'},
  {stage:'admin-end',category:'sql-error',sqlstate:'08006'}]);
 assert.equal(record.sqlstate,'42501');assert.ok(!JSON.stringify(record).includes(secret));
 const result=await childDiagnostic(record,{suffix:'\n'});
 assert.deepEqual(result.proofFailure,record);assert.equal(result.sqlstate,'42501');assert.equal(succeeded(result),false);
});

test('R2 assertion primary survives admin end failure; no assertion payload forwarded',async()=>{
 let failure;
 try{await withProofCleanup(async()=>assert.equal(secret,'different'),[
  {stage:'admin-end',run:async()=>{throw Error(secret);}}
 ]);}catch(error){failure=error;}
 const record=proofFailureRecord(failure);
 assert.deepEqual(record.primary,{category:'assertion-failed',sqlstate:null});
 assert.deepEqual(record.cleanup,[{stage:'admin-end',category:'operation-failed',sqlstate:null}]);
 assert.ok(!JSON.stringify(record).includes(secret));assert.ok(!JSON.stringify(record).includes('different'));
 const result=await childDiagnostic(record,{suffix:'\n'});assert.deepEqual(result.proofFailure,record);
});

test('R2 successful proof plus end/absence failure stays failed; all-success result survives',async()=>{
 const events=[];
 await assert.rejects(withProofCleanup(async()=>({result:'PASS'}),[
  {stage:'owned-database',run:async()=>{events.push('drop');throw Error(secret);}},
  {stage:'admin-end',run:async()=>{events.push('end');throw Error(secret);}}
 ]),error=>{
  const record=proofFailureRecord(error);assert.equal(record.primary,null);assert.equal(record.cleanup.length,2);
  assert.ok(parseProofFailureRecord(record));assert.ok(!JSON.stringify(record).includes(secret));return true;
 });
 assert.deepEqual(events,['drop','end']);
 assert.deepEqual(await withProofCleanup(async()=>({result:'PASS'}),[{stage:'admin-end',run:async()=>{}}]),{result:'PASS'});
});

test('R2 nested client failures retain primary and every later cleanup outcome',async()=>{
 const events=[];
 await assert.rejects(withProofCleanup(()=>withProofCleanup(async()=>{throw Object.assign(Error(secret),{code:'40001'});},[
  {stage:'rollback',run:async()=>{events.push('rollback');throw Error(secret);}},
  {stage:'client-end',run:async()=>{events.push('client-end');throw Error(secret);}}
 ]),[{stage:'owned-database',run:async()=>events.push('owned-database')},
  {stage:'admin-end',run:async()=>{events.push('admin-end');throw Error(secret);}}]),error=>{
   const record=proofFailureRecord(error);assert.equal(record.primary.sqlstate,'40001');
   assert.deepEqual(record.cleanup.map(item=>item.stage),['rollback','client-end','admin-end']);
   assert.ok(!JSON.stringify(record).includes(secret));return true;
  });
 assert.deepEqual(events,['rollback','client-end','owned-database','admin-end']);
});

test('R2 source lease-read failure survives source end and later admin end failure',async()=>{
 const events=[];
 await assert.rejects(withProofCleanup(()=>withProofCleanup(async()=>assert.equal(secret,'expected-lease'),[
  {stage:'source-end',run:async()=>{events.push('source-end');throw Error(secret);}}
 ]),[{stage:'owned-database',run:async()=>events.push('owned-database')},
  {stage:'admin-end',run:async()=>{events.push('admin-end');throw Error(secret);}}]),error=>{
   const record=proofFailureRecord(error);assert.equal(record.primary.category,'assertion-failed');
   assert.deepEqual(record.cleanup.map(item=>item.stage),['source-end','admin-end']);
   assert.ok(!JSON.stringify(record).includes(secret));return true;
  });
 assert.deepEqual(events,['source-end','owned-database','admin-end']);
});

test('R2 pure SQL denials retain original predicates; cleanup failure cannot count as an expected denial',async()=>{
 for(const code of ['42501','23505','40001']){
  await assert.rejects(withProofCleanup(async()=>{throw Object.assign(Error(secret),{code});},[
   {stage:'client-end',run:async()=>{}}
  ]),error=>error.code===code);
  await assert.rejects(withProofCleanup(async()=>{throw Object.assign(Error(secret),{code});},[
   {stage:'client-end',run:async()=>{throw Error(secret);}}
  ]),error=>{
   assert.equal(error.code,undefined);assert.equal(proofFailureRecord(error).primary.sqlstate,code);
   assert.equal(proofFailureRecord(error).cleanup[0].stage,'client-end');return true;
  });
 }
});

test('R1 rejects arbitrary nested cleanup fields and inconsistent SQLSTATE forwarding',async()=>{
 const valid={...legacyRecord('42501'),primary:{category:'sql-error',sqlstate:'42501'},cleanup:[]};
 assert.deepEqual(parseProofFailureRecord(valid),valid);
 for(const record of [{...valid,primary:{...valid.primary,query:secret}},
  {...valid,cleanup:[{stage:'admin-end',category:'operation-failed',sqlstate:null,token:secret}]},
  {...valid,cleanup:[{stage:secret,category:'operation-failed',sqlstate:null}]},
  {...valid,sqlstate:'40001'},
  {...valid,cleanup:Array.from({length:9},()=>({stage:'admin-end',category:'operation-failed',sqlstate:null}))}]){
  assert.equal(parseProofFailureRecord(record),null);
  const result=await childDiagnostic(record,{suffix:'\n'});assert.equal(result.proofFailure,undefined);assert.equal(result.sqlstate,null);
  assert.ok(!JSON.stringify(result).includes(secret));
 }
});
