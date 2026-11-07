#!/usr/bin/env python3
"""One bounded host-relay transition, no backend/container/SQL lifecycle.

Owner authorization is external and exact. A matching digest is not approval.
No binding is issued here. Missing/unreviewed caller pins remain HOLD.
"""
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
import relay_v2 as v2


def old_identity(record):
 root=Path('/proc')/str(record['pid'])
 if not root.exists():return 'ALREADY_ABSENT'
 identity=v2.process_identity(record['pid']);v2.need(identity['ticks']==record['start_ticks'],'LEGACY_PID_REUSED')
 argv=identity['argv'];v2.need(len(argv)==5 and argv[-1]==b'serve' and argv[1:3]==[b'-I',b'-B'],'LEGACY_PROCESS_ARGV')
 source=Path(os.fsdecode(argv[3]))
 for name,pin in v2.PROFILE['legacy_files'].items():v2.need(v2.digest(v2.safe(source.with_name(name)))==pin,'LEGACY_RUNNING_SOURCE_DRIFT')
 v2.need(record['source_seal']==v2.PROFILE['legacy_files'],'LEGACY_RECORDED_SEAL')
 return 'ALREADY_EXITED' if identity['state']=='Z' else 'KNOWN_RUNNING'


def activate(expected):
 legacy,b=v2.load_binding(expected)
 with socket.socket() as s:v2.need(s.connect_ex(('127.0.0.1',3008))!=0,'STOP_OWNED_APP_BEFORE_RELAY_TRANSITION')
 directory=legacy.PRIVATE/'relay-cors-v2'
 v2.need(directory.is_dir() and directory.resolve()==directory and not directory.stat().st_mode&0o077,'PRIVATE_TRANSITION_DIRECTORY')
 v2.need(not (directory/'transition.claim.json').exists(),'TRANSITION_ALREADY_ATTEMPTED_NO_RETRY')
 original=legacy.PRIVATE/'gateway-process.json';raw=v2.safe(original,True);old=json.loads(raw);observed=old_identity(old)
 v2.write_raw_new(directory/'prior-gateway-process.json',raw)
 # Keep the original pointer UNCHANGED. The legacy launcher must fail on its
 # dead PID rather than silently accepting no record or relabeling v2 as v1.
 v2.write_new(directory/'transition.claim.json',{'run_id':b['run_id'],'binding_sha256':expected,'relay_seal_sha256':b['relay_seal_sha256'],
  'old_record_sha256':v2.digest(raw),'backend':b['backend'],'scope':'same host HTTP/PG relay only; no SQL/Auth/containers','old_observed':observed})
 primary=None;child=None;result={'state':'CLAIMED','first_error':None,'old_stop':'NOT_RUN','new_start':'NOT_RUN','cleanup':'NOT_REQUIRED'}
 try:
  if observed=='KNOWN_RUNNING':
   v2.need(old_identity(old)=='KNOWN_RUNNING','OLD_PROCESS_CHANGED_BEFORE_EFFECT')
   result['old_stop']='ATTEMPTED';os.kill(old['pid'],signal.SIGTERM)
   deadline=time.monotonic()+10
   while (Path('/proc')/str(old['pid'])).exists() and v2.process_identity(old['pid'])['state']!='Z':
    v2.need(time.monotonic()<deadline,'OLD_STOP_UNKNOWN_NO_NEW_PROCESS');time.sleep(.1)
   result['old_stop']='ACK_PROCESS_ENDED'
  else:result['old_stop']='SKIPPED_ALREADY_ABSENT_OR_EXITED_NOT_AN_ACK'
  held=[]
  try:
   for port in (55421,55422):
    sock=socket.socket();held.append(sock);sock.bind(('127.0.0.1',port))
   v2.need(v2.safe(original,True)==raw,'LEGACY_POINTER_REWRITTEN')
   # Check exact caller/target/source again at process-creation boundary.
   v2.load_binding(expected)
  finally:
   for sock in held:sock.close()
  log=os.open(directory/'process.private.log',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  try:
   result['new_start']='ATTEMPTED'
   child=subprocess.Popen([sys.executable,'-I','-B',str(v2.HERE/'relay_v2.py'),'serve',expected],
    env=v2.relay_environment(),stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
  finally:os.close(log)
  deadline=time.monotonic()+20
  while not (directory/'process.json').exists():
   v2.need(child.poll() is None,'NEW_RELAY_EXITED_BEFORE_STARTUP_ACK')
   v2.need(time.monotonic()<deadline,'NEW_RELAY_STARTUP_ACK_UNKNOWN');time.sleep(.1)
  ready=v2.assert_ready(expected);record=json.loads(v2.safe(directory/'process.json',True))
  v2.need(record['pid']==child.pid,'STARTUP_PID_NOT_CHILD')
  v2.need(v2.safe(original,True)==raw,'LEGACY_HISTORY_NOT_PRESERVED')
  result.update(state='ACK_VERSIONED_RELAY_STARTED_SAME_BACKEND',new_start='ACK_BOTH_LISTENERS_PROCESS_SOURCE_BINDING',ready=ready)
 except BaseException as error:
  primary=error;result['state']='FAILED_OR_UNKNOWN_STOP';result['first_error']=type(error).__name__+':'+str(error)
  if child is not None and child.poll() is None:
   try:
    # Only the actual Popen child; never kill by a guessed record/name.
    child.terminate();child.wait(timeout=10);result['cleanup']='ACK_OWN_NEW_CHILD_ENDED'
   except BaseException:result['cleanup']='UNKNOWN_OWNER_PLATFORM_NO_RETRY'
  result['old_relay_restore']='NOT_ATTEMPTED_NO_AUTOMATIC_FALLBACK'
 finally:
  try:v2.write_new(directory/'transition.result.json',result)
  except BaseException as error:primary=primary or error
 if primary:raise primary
 return result


if __name__=='__main__':
 parser=argparse.ArgumentParser(allow_abbrev=False);parser.add_argument('operation',choices=['activate','preflight']);parser.add_argument('binding_sha256');a=parser.parse_args()
 try:
  r=activate(a.binding_sha256) if a.operation=='activate' else v2.preflight(a.binding_sha256)
  print(json.dumps({'state':r.get('state','PREFLIGHT_READY'),'ABI':v2.PROFILE['compatible_launcher_abi']}))
 except Exception as error:print(json.dumps({'state':'HOLD_OR_UNKNOWN','first_error':type(error).__name__,'private_diagnostic':True}));sys.exit(1)
