#!/usr/bin/env python3
"""Exact versioned app adoption. Installed Core identity is never relabeled."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import lane
import continuation
HERE=Path(__file__).resolve().parent
APP=Path('/workspace/work/platform17-integrated-app-5aa951bf')
RUN=lane.PRIVATE/'integrated-app-adoption-01'
APP_SHA='5aa951bfbe8b1254b81212aa248f51a13179f890'
APP_TREE='9332b0ce424439a67b2c47e50bf61895383d8fda'
INSTALLED='ee883b62cf4a318af3450c506931a969623b8987'
LAUNCH='scripts/run-core-service-app-assembly-17.mjs'


def validate_identity(head,tree,contract):
 lane.need(contract['contract']=='platform17.integrated-app-adoption.v1','ADOPTION_CONTRACT')
 lane.need(contract['installed_Core_base']==INSTALLED,'INSTALLED_CORE_RELABEL_FORBIDDEN')
 lane.need(contract['app_source']==APP_SHA and contract['app_tree']==APP_TREE,'EXACT_APP_PROFILE')
 lane.need(head==APP_SHA and tree==APP_TREE,'EXACT_APP_SHA_TREE_REQUIRED')
 lane.need(contract['app_origin']=='http://localhost:3008','OFFICIAL_ORIGIN_REQUIRED')
 lane.need(contract['official_launcher']==LAUNCH,'OFFICIAL_LAUNCHER_REQUIRED')


def gate():
 _,stack=lane.gate() # original sealed Platform/Core contract, unchanged
 contract=lane.load(HERE/'integrated-app-adoption.json')
 seal=lane.load(HERE/'integrated-app-adoption.seal.json')
 for rel,pin in seal['files'].items():lane.need(lane.sha(lane.read(lane.ROOT/rel))==pin,'ADOPTION_SOURCE_DRIFT')
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=APP,text=True).strip()
 tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=APP,text=True).strip()
 validate_identity(head,tree,contract)
 subprocess.run(['git','diff','--quiet',APP_SHA,'--'],cwd=APP,check=True)
 before=lane.load(RUN/'source-prestate.private.json')
 lane.need(before['app_source']==APP_SHA and before['installed_Core_base']==INSTALLED,'PRESTATE_SOURCE_BINDING')
 for rel,pin in before['source_before'].items():
  b=lane.read(APP/rel);lane.need(len(b)==pin['bytes'] and lane.sha(b)==pin['sha256'],'APP_SOURCE_DRIFT')
 for rel,pin in lane.load(lane.HERE/'profile.json')['core_source_pins'].items():
  b=lane.read(APP/rel);lane.need(len(b)==pin['bytes'] and lane.sha(b)==pin['sha256'],'INSTALLED_CORE_COMPATIBILITY_DRIFT')
 lane.need(not any((APP/n).exists() for n in ('.env','.env.local','.env.production','.env.production.local')),'UNREVIEWED_DOTENV')
 for name,version in contract['versions'].items():
  lane.need(json.loads((APP/'node_modules'/name/'package.json').read_text())['version']==version,'APP_DEPENDENCY_VERSION_DRIFT')
 lane.need(lane.sha((APP/'node_modules/.package-lock.json').read_bytes())==before['cache_lock_sha256'],'CACHE_IDENTITY_DRIFT')
 for rel in ('package.json','package-lock.json',LAUNCH):
  expected=subprocess.check_output(['git','show',INSTALLED+':'+rel],cwd=lane.ROOT)
  lane.need(lane.read(APP/rel)==expected,'INSTALLED_CORE_LAUNCH_OR_PACKAGE_DRIFT')
 stack.gateway_process()
 return contract,stack


def old_process_state():
 before=lane.load(RUN/'source-prestate.private.json');path=lane.PRIVATE/'app-process-after-backup.private.json'
 lane.need(lane.sha(lane.read(path))==before['old_process_record_sha256'],'OLD_PROCESS_RECORD_CHANGED')
 record=lane.load(path)
 lane.need(record['source']==INSTALLED,'OLD_APP_SOURCE_IDENTITY')
 if not (Path('/proc')/str(record['pid'])).exists():
  with socket.socket() as probe:lane.need(probe.connect_ex(('127.0.0.1',3008))!=0,'OLD_PID_ABSENT_PORT_OCCUPIED')
  return record,'ALREADY_ABSENT_AND_OFFICIAL_PORT_FREE'
 continuation.owned_app(record)
 return record,'EXACT_OWNED_PROCESS_PRESENT'


def recover_relay():
 # This restores the same owned, sealed host transport only. No Docker restart,
 # new backend, bootstrap, SQL, users, credentials or legacy claim replay.
 _,stack=lane.gate();path=stack.PRIVATE/'gateway-process.json';record=lane.load(path)
 lane.need(not (Path('/proc')/str(record['pid'])).exists(),'RELAY_PID_NOT_ABSENT_NO_REPLACEMENT')
 lane.need(record['source_seal']==stack.source_seal(),'RELAY_SOURCE_DRIFT')
 archive=stack.PRIVATE/'gateway-process-before-integrated-app-adoption-01.json'
 lane.need(not archive.exists(),'RELAY_RECOVERY_ALREADY_RECONCILED')
 held=[]
 try:
  for port in (55421,55422):
   sock=socket.socket();held.append(sock);sock.bind(('127.0.0.1',port))
  lane.write(RUN/'relay-recovery.claim.json',{'state':'ONE_ATTEMPT','old_record_sha256':lane.sha(lane.read(path)),'scope':'same sealed fixed loopback relay only; no backend replacement','historical_relay_recovery':'NOT_REPLAYED'})
  raw=lane.read(path);path.rename(archive);lane.need(lane.read(archive)==raw,'RELAY_HISTORY_NOT_PRESERVED')
 finally:
  for sock in held:sock.close()
 result={'state':'RELAY_START_ATTEMPTED'}
 try:
  stack.start_gateway_process();current=stack.gateway_process()
  lane.need(current is not None,'RELAY_PROCESS_UNKNOWN')
  deadline=time.monotonic()+15
  while True:
   with socket.socket() as probe:ready=probe.connect_ex(('127.0.0.1',55421))==0
   if ready:break
   lane.need(time.monotonic()<deadline,'RELAY_BIND_TIMEOUT_NO_RETRY');time.sleep(.1)
  status,body=stack.http('/auth/v1/health')
  lane.need(status==200 and stack.PROFILE['versions']['auth'] in body.decode(),'RELAY_TARGET_AUTH_IDENTITY_NOT_MATCH')
  result={'state':'SAME_SEALED_RELAY_CURRENT_PROCESS_AND_AUTH_HEALTH_OBSERVED','process':current,'Auth_health':200,'database_restart':'NOT_RUN','prior_record_sha256':lane.sha(lane.read(archive))}
 except BaseException as error:result['state']='UNKNOWN_STOP_NO_RETRY';result['first_error']=str(error);raise
 finally:lane.write(RUN/'relay-recovery.result.json',result)
 print(json.dumps({'state':result['state'],'database_restart':'NOT_RUN'}))


def build():
 contract,_=gate();old,old_state=old_process_state()
 ledger=Path('/workspace/private/cladora-functional-dev-v1/core17-build-attempts.private.ndjson');prefix=lane.read(ledger)
 lane.write(RUN/'build.claim.json',{'state':'ONE_ATTEMPT','app_source':APP_SHA,'installed_Core_base':INSTALLED,'argv':['node',LAUNCH,'build'],'cwd':str(APP),'prior_Core_build_ledger_sha256':lane.sha(prefix),'source_seal':lane.sha(lane.read(HERE/'integrated-app-adoption.seal.json'))})
 result={'state':'BUILD_DISPATCHED','app_source':APP_SHA,'installed_Core_base':INSTALLED,'old_process_before':old_state};primary=None;child=None
 try:
  child=subprocess.Popen(['node',LAUNCH,'build'],cwd=APP,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  lane.write(RUN/'build-process.private.json',{'pid':child.pid,'argv':['node',LAUNCH,'build'],'cwd':str(APP),'app_source':APP_SHA})
  stdout,stderr=child.communicate(timeout=480)
  for name,b in [('build.stdout.private.log',stdout),('build.stderr.private.log',stderr)]:
   fd=os.open(RUN/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
   with os.fdopen(fd,'wb') as stream:stream.write(b);stream.flush();os.fsync(stream.fileno())
  result['exit']=child.returncode;lane.need(child.returncode==0,'OFFICIAL_BUILD_FAILED_NO_PROCESS_REPLACEMENT')
  gate();post=lane.read(ledger);lane.need(post.startswith(prefix),'HISTORICAL_BUILD_LEDGER_REWRITTEN')
  result['new_official_ledger_entries']=[json.loads(x) for x in post[len(prefix):].decode().splitlines()]
  lane.need(result['new_official_ledger_entries'][-1]['state']=='EXIT_0','BUILD_LEDGER_ACK_MISSING')
  result['build_id']=(APP/'.next/BUILD_ID').read_text().strip()
  result['build_files']={rel:lane.sha(lane.read(APP/rel)) for rel in ['.next/BUILD_ID','.next/build-manifest.json','.next/routes-manifest.json','.next/server/app-paths-manifest.json']}
  result['state']='PASS_EXACT_INTEGRATED_SOURCE_OFFICIAL_BUILD'
 except BaseException as error:
  primary=error;result['state']='FAILED_OR_UNKNOWN_STOP_OLD_APP_PRESERVED';result['first_error']=type(error).__name__+':'+str(error)
  if child is not None and child.poll() is None:
   try:child.terminate();child.wait(timeout=20);result['build_cleanup']='OWN_BUILD_LAUNCHER_TERMINATED'
   except BaseException:result['build_cleanup']='UNKNOWN_NO_REPLACEMENT'
 finally:lane.write(RUN/'build.result.json',result)
 if primary:raise primary
 print(json.dumps({'state':result['state'],'app_source':APP_SHA,'installed_Core_base':INSTALLED,'old_app':'PRESERVED'}))


def require_build():
 result=lane.load(RUN/'build.result.json');lane.need(result['state']=='PASS_EXACT_INTEGRATED_SOURCE_OFFICIAL_BUILD','BUILD_NOT_PASS')
 lane.need(result['app_source']==APP_SHA and result['installed_Core_base']==INSTALLED,'BUILD_SOURCE_IDENTITY')
 for rel,pin in result['build_files'].items():lane.need(lane.sha(lane.read(APP/rel))==pin,'BUILT_FILE_DRIFT')
 return result


def stop_old():
 gate();require_build();before=lane.load(RUN/'source-prestate.private.json')
 path=lane.PRIVATE/'app-process-after-backup.private.json'
 lane.need(lane.sha(lane.read(path))==before['old_process_record_sha256'],'OLD_PROCESS_RECORD_CHANGED')
 record,observed=old_process_state()
 lane.write(RUN/'stop-old.claim.json',{'state':'ONE_ATTEMPT_EXACT_OWNED_LAUNCHER','old':record,'new_app_source':APP_SHA,'database_restart':'NOT_AUTHORIZED_NOT_RUN'})
 if observed=='ALREADY_ABSENT_AND_OFFICIAL_PORT_FREE':
  lane.write(RUN/'stop-old.result.json',{'state':'SKIPPED_ALREADY_EXITED_OBSERVED_PORT_FREE','signal':'NOT_RUN','stop_ACK':'NOT_CLAIMED'})
  print(json.dumps({'state':'SKIPPED_ALREADY_EXITED_OBSERVED_PORT_FREE','signal':'NOT_RUN'}));return
 result={'state':'SIGNAL_NOT_RUN','first_error':None}
 try:
  continuation.owned_app(record);result['state']='SIGNAL_DISPATCHED'
  os.kill(record['pid'],signal.SIGTERM)
  deadline=time.monotonic()+30;stopped=False
  while time.monotonic()<deadline:
   p=Path('/proc')/str(record['pid']);exited=not p.exists() or continuation.proc_identity(record['pid'])['state']=='Z'
   with socket.socket() as probe:free=probe.connect_ex(('127.0.0.1',3008))!=0
   if exited and free:stopped=True;break
   time.sleep(.2)
  lane.need(stopped,'OLD_APP_STOP_UNKNOWN_NO_START')
  result['state']='ACK_OLD_PROCESS_ENDED_AND_OFFICIAL_PORT_FREE'
 except BaseException as error:result['first_error']=str(error);result['state']='UNKNOWN_STOP_NO_REPLACEMENT';raise
 finally:lane.write(RUN/'stop-old.result.json',result)
 print(json.dumps(result))


def start_claim():
 gate();require_build()
 lane.need(lane.load(RUN/'stop-old.result.json')['state'] in ['ACK_OLD_PROCESS_ENDED_AND_OFFICIAL_PORT_FREE','SKIPPED_ALREADY_EXITED_OBSERVED_PORT_FREE'],'OLD_PROCESS_NOT_CONFIRMED_ENDED')
 with socket.socket() as probe:lane.need(probe.connect_ex(('127.0.0.1',3008))!=0,'PORT_NOT_FREE_NO_START')
 lane.write(RUN/'start.claim.json',{'state':'ONE_START_AUTHORIZED_BY_OWNER_ADOPTION_SCOPE','argv':['node',LAUNCH,'start'],'cwd':str(APP),'app_source':APP_SHA,'app_tree':APP_TREE,'installed_Core_base':INSTALLED})
 print(json.dumps({'state':'EXACT_START_CLAIMED','app_source':APP_SHA,'installed_Core_base':INSTALLED}))


if __name__=='__main__':
 parser=argparse.ArgumentParser(allow_abbrev=False);parser.add_argument('phase',choices=['recover-relay','build','stop-old','claim-start']);a=parser.parse_args()
 try:{'recover-relay':recover_relay,'build':build,'stop-old':stop_old,'claim-start':start_claim}[a.phase]()
 except BaseException as error:
  print(json.dumps({'state':'STOP','reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__,'private_diagnostic':True}));sys.exit(1)
