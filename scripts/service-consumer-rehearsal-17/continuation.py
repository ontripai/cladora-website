#!/usr/bin/env python3
"""Fixed API/restart continuation; never bootstrap, re-install or kill by name."""
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
APP=Path('/workspace/work/platform-service-app-ee883b6')
LAUNCH=['node','scripts/run-core-service-app-assembly-17.mjs','start']


def proc_identity(pid):
 p=Path('/proc')/str(pid)
 raw=lane.read(p/'stat').decode().split(') ',1)[1].split()
 return {'start_ticks':raw[19],'state':raw[0],
  'argv':lane.read(p/'cmdline').split(b'\0')[:-1]}


def owned_app(record):
 info=proc_identity(record['pid'])
 lane.need(info['start_ticks']==record['start_ticks'],'APP_PID_REUSED')
 lane.need(info['argv']==[x.encode() for x in LAUNCH],'APP_ARGV_DRIFT')
 lane.need(record['source']==lane.CORE,'APP_SOURCE_DRIFT')
 lane.need((APP/'.next/BUILD_ID').read_text().strip()==record['build_id'],'BUILD_ID_DRIFT')
 return info


def app_source():
 lane.need(subprocess.check_output(['git','rev-parse','HEAD'],cwd=APP,text=True).strip()==lane.CORE,'APP_NOT_ACCEPTED_CORE')
 subprocess.run(['git','diff','--quiet',lane.CORE,'--'],cwd=APP,check=True)
 # This uses the already built cache; no npm/build invocation.
 for package,version in [('next','16.4.1'),('zod','4.6.6')]:
  lane.need(json.loads((APP/'node_modules'/package/'package.json').read_text())['version']==version,'APP_DEPENDENCY_DRIFT')
 builds=[json.loads(x) for x in (Path('/workspace/private/cladora-functional-dev-v1')/'core17-build-attempts.private.ndjson').read_text().splitlines()]
 lane.need(builds[-1]['state']=='EXIT_0','BUILD_NOT_ACKNOWLEDGED')
 for rel,pin in builds[-1]['sourcePins'].items():lane.need(lane.sha(lane.read(APP/rel))==pin,'BUILT_SOURCE_DRIFT')


def parse_identity(raw):
 lines=raw.decode().splitlines()
 lane.need(len(lines)==3 and lines[0]=='BEGIN' and lines[2]=='ROLLBACK','IDENTITY_TERMINAL_TAG_MISMATCH')
 value=json.loads(lines[1]);lane.need(value['version']=='170011','PG_VERSION_DRIFT')
 return value


def db_identity(stack):
 # Custodian observation only: no broad grant to product/observer roles.
 raw=stack.sql(b"BEGIN READ ONLY; SELECT json_build_object('version',current_setting('server_version_num'),'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),'postmaster_start',pg_postmaster_start_time()); ROLLBACK;")
 return parse_identity(raw)


def api(phase):
 _,stack=lane.gate();app_source();stack.gateway_process()
 name='app-process-after-backup.private.json' if phase=='after-backup' else 'app-process-after-restart.private.json' if phase=='after-restart' else 'app-process.private.json'
 owned_app(lane.load(lane.PRIVATE/name))
 result=subprocess.run(['node',str(lane.HERE/'api-continuation.mjs'),phase],cwd=lane.ROOT,env=lane.clean_env(),timeout=150,capture_output=True)
 lane.write(lane.PRIVATE/('api-'+phase+'.process.json'),{'returncode':result.returncode,'stdout':result.stdout.decode(),'stderr':result.stderr.decode()})
 lane.need(result.returncode==0,'API_CONTINUATION_FAILED_OR_UNKNOWN')
 print(result.stdout.decode().strip())


def restart_backend():
 _,s=lane.gate();app_source()
 before=lane.load(lane.PRIVATE/'api-before-restart.result.json')
 lane.need(before['state']=='PASS_EXACT_PRE_RESTART_SNAPSHOT','PRE_RESTART_PROOF_MISSING')
 app=lane.load(lane.PRIVATE/'app-process.private.json');owned_app(app)
 container,inspect=s.cid('pg');identity=db_identity(s)
 lane.write(lane.PRIVATE/'restart-current.claim.json',{'state':'ONE_ATTEMPT_NO_RETRY','pg_cid':container,'identity':identity,'app':app,
  'scope':'same PG container, same volume and same built app; no initialization, login, migration, user repair or Storage ACL'})
 state={'state':'IN_PROGRESS','before':identity,'pg_cid':container,'app_stop':'NOT_RUN','pg_restart':'NOT_RUN'}
 primary=None
 try:
  owned_app(app) # PID/start identity immediately before signal
  os.kill(app['pid'],signal.SIGTERM)
  deadline=time.monotonic()+30
  stopped=False
  while time.monotonic()<deadline:
   p=Path('/proc')/str(app['pid'])
   exited=not p.exists() or proc_identity(app['pid'])['state']=='Z'
   with socket.socket() as probe:free=probe.connect_ex(('127.0.0.1',3008))!=0
   if exited and free:stopped=True;break
   time.sleep(0.2)
  lane.need(stopped,'APP_STOP_UNKNOWN_NO_REPLACEMENT');state['app_stop']='ACK_PROCESS_ENDED_AND_PORT_FREE'
  state['pg_restart']='DISPATCHED_ACK_PENDING'
  ack=s.docker(['restart','--time','20',container],timeout=60)
  lane.write(lane.PRIVATE/'restart-command-ack.private.json',{'stdout_hex':ack.hex(),'command_exit':0})
  if ack.decode().strip()!=container:
   state['pg_restart']='ATTEMPTED_ACK_UNKNOWN'
   raise RuntimeError('PG_RESTART_ACK_UNKNOWN')
  state['pg_restart']='ACK_SAME_CID'
  s.health();same,observed=s.cid('pg');after=db_identity(s)
  lane.need(same==container and observed['Image']==inspect['Image'] and observed['Mounts']==inspect['Mounts'],'RESTART_RESOURCE_DRIFT')
  for k in ('version','system_identifier','database_oid'):lane.need(after[k]==identity[k],'RESTART_TARGET_IDENTITY_DRIFT')
  lane.need(after['postmaster_start']!=identity['postmaster_start'],'NO_ACTUAL_PG_RESTART')
  state['after']=after;state['state']='PASS_SAME_PG_CONTAINER_VOLUME_SYSTEM_DATABASE_RESTART'
 except BaseException as error:
  primary=error;state['state']='FAILED_OR_UNKNOWN_STOP';state['first_error']=str(error)
 finally:
  lane.write(lane.PRIVATE/'restart-current.result.json',state)
 if primary:raise primary
 print(json.dumps({'state':state['state'],'app':'STOPPED; separate exact official start required'}))


if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['withheld','retry','retry-observer-format-fixed','before-restart','after-restart','after-backup','restart-backend']);args=parser.parse_args()
 try:
  if args.phase=='restart-backend':restart_backend()
  else:api(args.phase)
 except BaseException as error:
  print(json.dumps({'state':'STOP','error':type(error).__name__,'private_diagnostic':True}));sys.exit(1)
