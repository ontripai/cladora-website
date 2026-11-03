#!/usr/bin/env python3
"""Closed SERVICE17 consumer rehearsal. Never a generic SQL/target runner.

Existing Platform12 custody and Core15 installers own transport and SQL. This
adapter preserves their source, per-unit receipts and no-replay boundaries.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import socket
import shutil

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PRIVATE = Path('/workspace/private/platform-service-consumer-rehearsal-17')
P12 = Path('/workspace/work/platform12-core15-input-794f5a1')
P12_REF = '794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
BASE = '29ed18541c602dae4e6db5c98a96201250af630b'
CORE = 'ee883b62cf4a318af3450c506931a969623b8987'
FIVE = ('stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf')
DOMAIN_ORDER = ['catalog','module-registry','request','service-v14','subject-validity','request-version','s01-store',
 'canonical-sqlstate','session-authority-delegation','owner-execute-bindings','runtime-access']


def need(ok, why):
 if not ok: raise RuntimeError(why)


def sha(b): return hashlib.sha256(b).hexdigest()


def read(path):
 need(path.resolve()==path and path.is_file() and not path.is_symlink() and path.stat().st_nlink==1,'FILE_ALIAS_OR_CUSTODY')
 return path.read_bytes()


def load(path): return json.loads(read(path))


def write(path, value):
 raw=(json.dumps(value,indent=2)+'\n').encode()
 fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'wb') as f:
  need(f.write(raw)==len(raw),'PRIVATE_SHORT_WRITE');f.flush();os.fsync(f.fileno())


def clean_env():
 # Reuse accepted F01 filtering; do NOT erase inherited proxy/CA/host guards.
 code="import {coreServiceAssemblyChildEnvironmentV1 as filter} from './scripts/lib/core-service-assembly-environment-v1.mjs';process.stdout.write(JSON.stringify(filter(process.env,'start')));"
 value=subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,timeout=10)
 return json.loads(value)


def validate_profile(p):
 need(p['base']==BASE and p['authority']=='owner TASK PLATFORM-SERVICE-CONSUMER-REHEARSAL-17; synthetic owned development only','CLOSED_PROFILE')
 need(p['minimal_native_units']==['foundation'] and p['domain_order']==DOMAIN_ORDER,'EXACT_SERVICE_CLOSURE_ONLY')
 need(p['target']=='existing owned Platform12, private identity revalidated at each effect' and p['host_ports']==[],'NO_HOSTED_OR_EXTERNAL_TARGET')
 need(p['accepted_core_successor']==CORE and p['installer_generation']=='v3','EXACT_ACCEPTED_CORE_AND_V3_REQUIRED')


def gate():
 need(PRIVATE.resolve()==PRIVATE and PRIVATE.stat().st_uid==os.getuid() and PRIVATE.stat().st_mode&0o077==0,'RUN_PRIVATE_CUSTODY')
 p=load(HERE/'profile.json')
 validate_profile(p)
 subprocess.run(['git','merge-base','--is-ancestor',BASE,'HEAD'],cwd=ROOT,check=True,capture_output=True)
 subprocess.run(['git','merge-base','--is-ancestor',CORE,'HEAD'],cwd=ROOT,check=True,capture_output=True)
 for rel,pin in p['core_source_pins'].items():
  b=read(ROOT/rel);need(len(b)==pin['bytes'] and sha(b)==pin['sha256'],'CORE_SOURCE_DRIFT')
 seal=load(HERE/'source-seal.json')
 need(sha(json.dumps(seal['files'],sort_keys=True,separators=(',',':')).encode())==seal['sha256'],'SEAL_ENCODING')
 for rel,pin in seal['files'].items(): need(sha(read(ROOT/rel))==pin,'SOURCE_SEAL_DRIFT')
 for name,selected in {'node':shutil.which('node'),'python':sys.executable}.items():
  need(selected is not None,'TOOL_MISSING')
  b=read(Path(selected).resolve());pin=p['toolchain'][name]
  need(len(b)==pin['bytes'] and sha(b)==pin['sha256'],'TOOLCHAIN_DRIFT')
 need(subprocess.check_output(['git','rev-parse','HEAD'],cwd=P12,text=True).strip()==P12_REF,'EXACT_PLATFORM_INPUT')
 for name in FIVE:
  rel='scripts/functional-dev-stack-v1/'+name
  need(read(P12/rel)==read(ROOT/rel),'PLATFORM_SOURCE_DRIFT')
 spec=importlib.util.spec_from_file_location('service17_p12',P12/'scripts/functional-dev-stack-v1/stack.py')
 stack=importlib.util.module_from_spec(spec);spec.loader.exec_module(stack)
 _,d=stack.state();previous=load(PRIVATE/'custody-before.private.json')
 need(d['instance']==previous['descriptor_instance'],'FOREIGN_INSTANCE')
 current=stack.status()
 for name,observed in current['services'].items():
  before=previous['status']['services'][name]
  need(observed['cid']==before['cid'] and observed['image_id']==before['image_id'],'FOREIGN_CID_OR_IMAGE')
 need(current['internal_network'],'NETWORK_NOT_INTERNAL')
 return p,stack




def prepare():
 p,s=gate()
 need(not (PRIVATE/'prepared.json').exists(),'PREPARATION_EXISTS_NO_OVERWRITE')
 source=Path('/workspace/work/platform-bound-contract-302-1/core300')
 source_manifest=Path('/workspace/work/platform-bound-contract-302-1/inputs/CORE300.manifest.json')
 need(sha(read(source_manifest))==p['core300_manifest_sha256'],'CORE300_MANIFEST_DRIFT')
 entry=next(x for x in load(source_manifest)['all48_source_outputs'] if x['path']=='supabase/install/v14-operations/foundation.sql')
 b=read(source/entry['path']);need(len(b)==entry['identity']['bytes'] and sha(b)==entry['identity']['sha256'],'CORE300_FOUNDATION_DRIFT')
 dest=PRIVATE/'source300'/entry['path'];dest.parent.mkdir(parents=True,mode=0o700,exist_ok=False)
 fd=os.open(dest,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'wb') as f: f.write(b);f.flush();os.fsync(f.fileno())
 runtime=load(PRIVATE/'runtime-materials.private.json')
 need(sha(read(PRIVATE/'runtime-materials.private.json'))==p['runtime_closure_sha256'],'RUNTIME_CLOSURE_DRIFT')
 for item in runtime['files']:
  b=read(ROOT/'node_modules'/item['path']);need(len(b)==item['bytes'] and sha(b)==item['sha256'],'RUNTIME_FILE_DRIFT')
 write(PRIVATE/'prepared.json',{'source_seal':load(HERE/'source-seal.json')['sha256'],'base':BASE,'foundation':entry['identity'],
  'native':'NOT_DISPATCHED','runtime_files':len(runtime['files']),'runtime_closure_sha256':p['runtime_closure_sha256']})
 print(json.dumps({'prepared':'EXACT_MINIMAL_CORE_AND_PG_AUTH_CLOSURE','core_native_units':['foundation'],'excluded':['assets','maintenance','building','Storage ACL R2'],'runtime_files':len(runtime['files'])}))


def preserve_stale_relay(stack):
 """No PID kill. Preserve exact record only when PID absent and BOTH ports free."""
 path=stack.PRIVATE/'gateway-process.json';record=load(path)
 process=Path('/proc')/str(record['pid'])
 need(not process.exists(),'RECORDED_PID_PRESENT_DO_NOT_REPLACE')
 need(record['source_seal']==stack.source_seal(),'STALE_RELAY_SOURCE_DRIFT')
 archive=stack.PRIVATE/'gateway-process-stale-platform17.json'
 need(not archive.exists(),'STALE_RECORD_ALREADY_RECONCILED')
 held=[]
 try:
  for port in (55421,55422):
   sock=socket.socket();held.append(sock);sock.bind(('127.0.0.1',port))
  need(not process.exists(),'RECORDED_PID_REAPPEARED')
  raw=read(path);path.rename(archive)
  need(read(archive)==raw,'STALE_RECORD_PRESERVATION_MISMATCH')
  return {'original_sha256':sha(raw),'preserved_sha256':sha(read(archive)),
   'prestate':'PID_ABSENT_AND_BOTH_PORTS_EXCLUSIVELY_FREE','no_process_killed':True}
 finally:
  for sock in held:sock.close()


def recover_relay():
 _,s=gate()
 write(PRIVATE/'relay-recovery.claim.json',{'state':'ONE_ATTEMPT','scope':'same fixed sealed Platform12 loopback relay, no container replacement'})
 saved=preserve_stale_relay(s)
 write(PRIVATE/'stale-relay-preserved.json',saved)
 try:
  s.start_gateway_process()
  record=s.gateway_process();need(record is not None,'RELAY_PID_UNKNOWN')
  s.health()
  code,body=s.http('/auth/v1/health')
  need(code==200 and s.PROFILE['versions']['auth'] in body.decode(),'ACTUAL_AUTH_HEALTH_MISMATCH')
  write(PRIVATE/'relay-recovery.result.json',{'state':'PID_AND_REAL_AUTH_HEALTH_ACKNOWLEDGED','gateway_record':record,
   'Auth_version':s.PROFILE['versions']['auth'],'preserved':saved,'Core_install':'NOT_RUN'})
  print(json.dumps({'relay':'SAME_OWNED_TARGET_RECOVERED','Auth':s.PROFILE['versions']['auth'],'health':200,'Core_install':'NOT_RUN'}))
 except BaseException as error:
  write(PRIVATE/'relay-recovery.unknown.json',{'state':'UNKNOWN_STOP_NO_REPLACEMENT','first_error':type(error).__name__,'owner':'Platform'})
  raise


def backup():
 _,s=gate();need(not (PRIVATE/'backup.claim.json').exists(),'BACKUP_ALREADY_ATTEMPTED')
 # The existing relay is recognized by exact source bytes AND actual PID/start
 # ticks. It can originate at the old Platform worktree, never an arbitrary path.
 record=load(s.PRIVATE/'gateway-process.json');args=read(Path('/proc')/str(record['pid'])/'cmdline').split(b'\0')
 allowed=[P12/'scripts/functional-dev-stack-v1/stack.py',Path('/workspace/work/program-local-runtime-lane-01/scripts/functional-dev-stack-v1/stack.py')]
 owner=next((path for path in allowed if str(path).encode() in args),None)
 need(owner is not None,'RELAY_OWNER_NOT_RECOGNIZED')
 for name in FIVE:need(read(owner.with_name(name))==read(P12/'scripts/functional-dev-stack-v1'/name),'RELAY_OWNER_SOURCE_DRIFT')
 spec=importlib.util.spec_from_file_location('service17_existing_relay',owner)
 existing=importlib.util.module_from_spec(spec);spec.loader.exec_module(existing)
 existing.gateway_process()
 write(PRIVATE/'backup.claim.json',{'state':'DISPATCHED_NO_RETRY','scope':'one current pre-install backup; preserve original volumes and accepted backup13'})
 primary=None;result=None
 try:
  result=existing.backup()
  path=s.PRIVATE/result['backup'];receipt=load(path/'receipt.json')
  need(receipt['state']=='ACKNOWLEDGED' and sha(read(path/'receipt.json'))==result['receipt_sha256'],'BACKUP_RECEIPT_UNKNOWN')
  for name,pin in receipt['files'].items():
   b=read(path/name);need(len(b)==pin['bytes'] and sha(b)==pin['sha256'],'BACKUP_FILE_DRIFT')
  container,_=s.cid('pg')
  toc=s.docker(['exec','-i','--user','999:999',container,'pg_restore','--list'],read(path/'database.dump'),60)
  need(b'TABLE DATA platform_dev notes ' in toc and b'TABLE DATA auth users ' in toc,'REQUIRED_BACKUP_CONTENT_MISSING')
  fd=os.open(PRIVATE/'backup-toc.private.log',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  with os.fdopen(fd,'wb') as f:f.write(toc);f.flush();os.fsync(f.fileno())
  write(PRIVATE/'backup-integrity.json',{'state':'HASHES_AND_PG_RESTORE_TOC_VALIDATED',
   'required_content':['platform_dev.notes','auth.users'],'toc_sha256':sha(toc),
   'new_backup_native_restore':'NOT_RUN; no destructive test on original target','historical_restore13':'separate preserved infrastructure-only evidence'})
  write(PRIVATE/'backup.result.json',{'state':'ACKNOWLEDGED','backup':result,'restore':'NOT_RUN; existing restore13 is historical infrastructure-only proof'})
 except BaseException as error:
  primary=error
 finally:
  # Resume the SAME containers, no init/start compatibility SQL/users/reseed.
  try:
   s.compose(['start','auth','rest','storage','gateway'])
   s.start_gateway_process();s.health()
   write(PRIVATE/'backup-resume.json',{'state':'ACKNOWLEDGED_SAME_CONTAINERS','relay':'same sealed bytes, exact historical Core-compatible input path; new PID custody recorded by existing helper'})
  except BaseException as error:
   write(PRIVATE/'backup-resume-unknown.json',{'state':'UNKNOWN','first_error':type(primary or error).__name__,'owner':'Platform'})
   primary=primary or error
 if primary is not None:raise primary
 print(json.dumps({'backup':'ACKNOWLEDGED_PRIVATE_FILES_HASHED','writers':'RESUMED_SAME_RESOURCES','original_data':'PRESERVED'}))


def install():
 p,s=gate();validate_runtime();s.gateway_process()
 need(load(PRIVATE/'backup.result.json')['state']=='ACKNOWLEDGED','CURRENT_BACKUP_REQUIRED')
 need(not (s.PRIVATE/'core15').exists(),'EXISTING_CORE_INSTALL_OR_ATTEMPT_STOP')
 write(PRIVATE/'install.claim.json',{'state':'ONE_ATTEMPT','accepted_Core':CORE,'generation':'v3',
  'scope':'accepted minimum Service recipe; existing infrastructure/users/volumes retained; Storage R2 excluded'})
 for name,argv in installation_plan():
  gate();validate_runtime()
  write(PRIVATE/(name+'.claim.json'),{'state':'DISPATCHED_NO_RETRY','accepted_Core':CORE,'generation':'v3'})
  try:
   result=subprocess.run(argv,cwd=ROOT,env=clean_env(),capture_output=True,timeout=180)
   log=result.stdout+result.stderr
   fd=os.open(PRIVATE/(name+'.private.log'),os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
   with os.fdopen(fd,'wb') as f:f.write(log);f.flush();os.fsync(f.fileno())
   write(PRIVATE/(name+'.result.json'),{'exit':result.returncode,'log_sha256':sha(log),
    'scope':'process completion only; actual Core receipt separately required'})
   need(result.returncode==0,'CORE_UNIT_FAILED_OR_UNKNOWN:'+name)
   print(json.dumps({'completed_process':name,'generation':'v3','Core':CORE}),flush=True)
  except BaseException as error:
   write(PRIVATE/(name+'.stop.json'),{'state':'STOP_NO_RETRY','first_error':type(error).__name__,
    'scope':'no later unit; keep original Core receipt and earlier commits','owner':'Platform/Core/coordinator'})
   raise
 write(PRIVATE/'install.result.json',{'state':'ACCEPTED_CORE_RECIPE_PROCESSES_COMPLETED','accepted_Core':CORE,
  'generation':'v3','native_browser':'NOT_RUN_NOT_PASS','current_Source_native':'per-unit receipts must be inspected'})


def installation_plan():
 # Closed data plan, explicit generation and binding; no historical fallback.
 p=load(HERE/'profile.json');validate_profile(p)
 binding='/workspace/private/cladora-functional-dev-v1/core15/service-native-v3/installer-binding.json'
 commands=[('session-bootstrap',[sys.executable,'-B','scripts/run-core15-session-bootstrap.py','--platform-source',str(P12)]),
  ('session-owner',[sys.executable,'-B','scripts/run-core15-session-owner-admission-v1.py']),
  ('prerequisites',['node','scripts/run-core15-service-native-v3.mjs','prerequisites','--accepted-source',str(PRIVATE/'source300')]),
  ('foundation',['node','scripts/run-core15-service-native-v3.mjs','foundation','--accepted-source',str(PRIVATE/'source300'),'v3',binding])]
 commands += [('domain-'+unit,['node','scripts/run-core15-service-domain-v1.mjs',unit]+
  ([] if unit in ('session-authority-delegation','owner-execute-bindings') else ['v3',binding])) for unit in p['domain_order']]
 commands += [('private-binding',['node','scripts/write-core15-private-service-binding-v1.mjs'])]
 commands += [('verify-v3-binding',['node','scripts/verify-core-service-installer-binding-17.mjs','v3',binding])]
 commands += [('assembly-'+unit,['node','scripts/run-core-service-assembly-17-install.mjs',unit,'v3',binding])
  for unit in ('catalog-compatibility','read-access')]
 commands += [('real-MFA',['node','scripts/prepare-core15-native-synthetic-auth-v1.mjs']),
  ('fresh-v3-fixture',['node','scripts/prepare-core-service-synthetic-fixture-v2.mjs','v3',binding]),
  ('catalog-fixture-addon',['node','scripts/prepare-core-service-assembly-17-fixture.mjs','v3',binding])]
 return commands


def consumer_materials():
 raise RuntimeError('HOLD_ACCEPTED_CORE_RUNTIME_BINDING_REQUIRED')




def restart():
 raise RuntimeError('HOLD_CORE_PRODUCT_RESTART_REQUIRES_ACCEPTED_BINDING')


def infra_snapshot(stack):
 # Custodian metadata + existing synthetic fixture only; no product observer.
 q=b"SELECT json_build_object('version',current_setting('server_version_num'),'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),'postmaster_start',pg_postmaster_start_time(),'note',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]') FROM platform_dev.notes n),'core_schema',to_regnamespace('core_runtime') IS NOT NULL);"
 return json.loads(stack.sql(q))


def infra_materials():
 _,s=gate();s.gateway_process()
 secret,_=s.state();users=load(s.PRIVATE/'users.json')
 need(users['state']=='CREATED_BY_REAL_AUTH' and len(users['users'])==2,'EXISTING_SYNTHETIC_USERS_REQUIRED')
 snapshot=infra_snapshot(s);need(snapshot['core_schema'] is False,'UNEXPECTED_CORE_INSTALL_NO_INFRA_SUBSTITUTE')
 (PRIVATE/'infra-output').mkdir(mode=0o700)
 write(PRIVATE/'infra-input.private.json',{'contract':'platform17-existing-infrastructure-probe.v1','origin':s.PROFILE['origin'],
  'public_key':secret['anon_key'],'users':[{'id':u['id'],'email':u['email'],'password':secret[u['password_key']]} for u in users['users']],
  'source_seal':load(HERE/'source-seal.json')['sha256'],'expected_note':snapshot['note'],'product_runtime':'NOT_ADMITTED'})
 write(PRIVATE/'infra-baseline.private.json',snapshot)
 print(json.dumps({'consumer_input':'PRIVATE_SYNTHETIC_LOGIN_AND_ANON_KEY_ONLY','database_or_management_credentials':False,
  'AAL2_and_Core':'NOT_RUN_NOT_PASS'}))


def validate_runtime():
 manifest=PRIVATE/'runtime-materials.private.json'
 p=load(HERE/'profile.json');need(sha(read(manifest))==p['runtime_closure_sha256'],'RUNTIME_MANIFEST_DRIFT')
 for item in load(manifest)['files']:
  b=read(ROOT/'node_modules'/item['path'])
  need(len(b)==item['bytes'] and sha(b)==item['sha256'],'RUNTIME_MODULE_DRIFT')


def infra_probe(mode):
 need(mode in ('before','after'),'FIXED_PROBE_PHASE')
 gate();validate_runtime()
 output=PRIVATE/'infra-output';need(not (output/(mode+'.receipt.json')).exists(),'PROBE_ATTEMPT_ALREADY_EXISTS')
 write(output/(mode+'.launch-claim.json'),{'state':'DISPATCHED_NO_RETRY','source_seal':load(HERE/'source-seal.json')['sha256'],
  'role':'real synthetic authenticated Auth session, no DB/installer/service-role credential'})
 argv=['node','--permission','--allow-fs-read='+str(ROOT),'--allow-fs-read='+str(PRIVATE/'infra-input.private.json'),
  '--allow-fs-read='+str(output),'--allow-fs-write='+str(output),str(HERE/'infra-probe.mjs'),mode]
 # All source/cache reads and intent fsync precede the last custody check.
 gate();validate_runtime()
 try:
  result=subprocess.run(argv,cwd=ROOT,env=clean_env(),capture_output=True,timeout=75)
  fd=os.open(output/(mode+'.launch.private.log'),os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  with os.fdopen(fd,'wb') as f:f.write(result.stdout+result.stderr);f.flush();os.fsync(f.fileno())
  value=load(output/(mode+'.receipt.json'))
  need(result.returncode==0 and value['status']=='PASS_INFRASTRUCTURE_ONLY','PROBE_FAILED_OR_UNKNOWN')
  validate_runtime();gate()
  write(output/(mode+'.launcher-result.json'),{'state':'ACKNOWLEDGED','exit':result.returncode,
   'receipt_sha256':sha(read(output/(mode+'.receipt.json'))),'source_cache_poststate':'UNCHANGED',
   'child_creation_and_addons':'DENIED_BY_NODE_PERMISSIONS','credential_scope':'synthetic login+anon only'})
  print(json.dumps({'probe':mode,'status':value['status'],'real_auth':'AAL1_ONLY','Core_AAL2_PRODUCT':'NOT_RUN_NOT_PASS'}))
 except BaseException as error:
  write(output/(mode+'.launch-unknown.json'),{'state':'FAILED_OR_UNKNOWN_NO_RETRY','error':type(error).__name__,'owner':'Platform'})
  raise


def infra_before():infra_probe('before')


def infra_after():infra_probe('after')


def own_session_observer(stack, phase):
 import uuid
 result=load(PRIVATE/'infra-output'/('before.receipt.json' if phase=='before' else 'after.receipt.json'))
 need(result['status']=='PASS_INFRASTRUCTURE_ONLY' and len(result['actors'])==2,'ACTUAL_INFRA_PROBE_REQUIRED')
 pairs=[(str(uuid.UUID(x['actor'])),str(uuid.UUID(x['session_id']))) for x in result['actors']]
 expected=[x['id'] for x in load(stack.PRIVATE/'users.json')['users']]
 need([a for a,_ in pairs]==expected,'SYNTHETIC_ACTOR_CUSTODY_MISMATCH')
 values=','.join("('%s'::uuid,'%s'::uuid)" % (a,b) for a,b in pairs)
 q=("SELECT json_build_object('own_sessions',(SELECT count(*) FROM auth.sessions s JOIN (VALUES %s) e(actor,sid) ON s.id=e.sid AND s.user_id=e.actor),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()));" % values).encode()
 observed=json.loads(stack.sql(q));need(observed['own_sessions']==(2 if phase=='before' else 0),'OWN_SESSION_PERSISTENCE_OR_CLEANUP_UNKNOWN')
 return {'scope':'two exact owned synthetic sessions only; not a product observer','query_sha256':sha(q),'result':observed}


def infra_restart():
 _,s=gate()
 before=infra_snapshot(s);baseline=load(PRIVATE/'infra-baseline.private.json')
 need(before==baseline,'INFRA_BASELINE_CHANGED_BEFORE_RESTART')
 observer=own_session_observer(s,'before')
 write(PRIVATE/'infra-restart.claim.json',{'state':'DISPATCHED_NO_RETRY','scope':'same PG CID/volume, no data reset','before':before,'own_session_observer':observer})
 s.compose(['restart','--timeout','20','pg']);s.wait_pg();s.health()
 after=infra_snapshot(s)
 need(after['postmaster_start']!=before['postmaster_start'],'POSTMASTER_DID_NOT_RESTART')
 need({k:v for k,v in before.items() if k!='postmaster_start'}=={k:v for k,v in after.items() if k!='postmaster_start'},'INFRA_PERSISTENCE_DRIFT')
 observer_after=own_session_observer(s,'before')
 write(PRIVATE/'infra-restart.result.json',{'state':'ACKNOWLEDGED_SAME_DATABASE_SYSTEM_CID_VOLUME','before':before,'after':after,
  'two_real_Auth_sessions_persisted':observer_after,'product_request_or_AAL2':'NOT_RUN_NOT_PASS'})
 print(json.dumps({'restart':'SAME_PG_CID_VOLUME','existing_note_and_real_session_rows':'MATCH','product_runtime':'NOT_RUN_NOT_PASS'}))


def infra_closeout():
 _,s=gate();need(load(PRIVATE/'infra-restart.result.json')['state']=='ACKNOWLEDGED_SAME_DATABASE_SYSTEM_CID_VOLUME','RESTART_PROOF_REQUIRED')
 observer=own_session_observer(s,'after')
 snapshot=infra_snapshot(s);need(snapshot==load(PRIVATE/'infra-restart.result.json')['after'],'POST_READBACK_TARGET_OR_NOTE_DRIFT')
 write(PRIVATE/'infra-closeout.private.json',{'state':'INFRASTRUCTURE_ONLY_AUTH_RLS_PERSISTENCE_ACKNOWLEDGED',
  'owned_session_cleanup':observer,'persistent_product_data_and_accounts':'PRESERVED','Core_fixture_runtime_AAL2_observer':'NOT_RUN_NOT_PASS'})
 print(json.dumps({'infrastructure':'REAL_AUTH_AAL1_RLS_RESTART_READBACK','own_new_sessions':'ZERO_OBSERVED_AFTER_LOCAL_SIGNOUT',
  'SERVICE_Core_AAL2_product_observer':'NOT_RUN_NOT_PASS','task':'OPEN'}))




def main():
 parser=argparse.ArgumentParser(allow_abbrev=False)
 parser.add_argument('mode',choices=['inspect','prepare','recover-relay','backup','install','consumer-materials','restart',
  'infra-materials','infra-before','infra-after','infra-restart','infra-closeout'])
 mode=parser.parse_args().mode
 if mode=='inspect':
  p,s=gate();print(json.dumps({'owned_target':'MATCH','source':'PINNED','domain_order':p['domain_order'],'Storage_ACL_R2':'NOT_AUTHORIZED','cross_seat_localhost':'NOT_SHARED'}))
 else:globals()[mode.replace('-','_')]()


if __name__=='__main__':
 try:main()
 except BaseException as error:
  if isinstance(error,SystemExit):raise
  print(json.dumps({'state':'STOP_FAILED_OR_UNKNOWN','reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__,'no_retry':True}),file=sys.stderr)
  sys.exit(2)
