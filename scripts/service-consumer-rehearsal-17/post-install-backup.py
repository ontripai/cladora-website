#!/usr/bin/env python3
"""One new data-bearing backup, not a replay of pre-install backup13/proof."""
import json
import os
from pathlib import Path
import signal
import socket
import sys
import time
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import lane
import continuation


def main():
 lane.need(len(sys.argv)==1,'NO_ARBITRARY_BACKUP_TARGET')
 _,stack=lane.gate();continuation.app_source()
 proof=lane.load(lane.PRIVATE/'api-after-restart.result.json')
 lane.need(proof['state']=='PASS_SAME_REQUESTS_RECEIPTS_AFTER_RESTART','POST_RESTART_READBACK_REQUIRED')
 app=lane.load(lane.PRIVATE/'app-process-after-restart.private.json');continuation.owned_app(app)
 lane.write(lane.PRIVATE/'post-install-backup.claim.json',{'state':'ONE_ATTEMPT','scope':'new post-install data-bearing backup; stop own app, same sealed Platform12 backup; preserve all original volumes/accounts/data','app':app})
 result={'state':'IN_PROGRESS','first_error':None,'app_stop':'NOT_RUN','backup':'NOT_RUN','resume':'NOT_RUN'}
 primary=None
 try:
  continuation.owned_app(app);os.kill(app['pid'],signal.SIGTERM)
  deadline=time.monotonic()+30;stopped=False
  while time.monotonic()<deadline:
   proc=Path('/proc')/str(app['pid']);exited=not proc.exists() or continuation.proc_identity(app['pid'])['state']=='Z'
   with socket.socket() as probe:free=probe.connect_ex(('127.0.0.1',3008))!=0
   if exited and free:stopped=True;break
   time.sleep(.2)
  lane.need(stopped,'APP_STOP_UNKNOWN_NO_BACKUP');result['app_stop']='ACK_PROCESS_ENDED_PORT_FREE'
  result['backup']='ATTEMPTED'
  output=stack.backup();directory=stack.PRIVATE/output['backup']
  receipt=lane.load(directory/'receipt.json')
  lane.need(receipt['state']=='ACKNOWLEDGED' and lane.sha(lane.read(directory/'receipt.json'))==output['receipt_sha256'],'BACKUP_ACK_UNKNOWN')
  for name,pin in receipt['files'].items():
   raw=lane.read(directory/name);lane.need(len(raw)==pin['bytes'] and lane.sha(raw)==pin['sha256'],'BACKUP_FILE_DRIFT')
  cid,_=stack.cid('pg');toc=stack.docker(['exec','-i','--user','999:999',cid,'pg_restore','--list'],lane.read(directory/'database.dump'),60)
  for required in [b'TABLE DATA auth users ',b'TABLE DATA platform_dev notes ',b'TABLE DATA service_catalog requests ',b'TABLE DATA platform idempotency_keys ']:
   lane.need(required in toc,'POST_INSTALL_BACKUP_REQUIRED_CONTENT_MISSING')
  lane.write(lane.PRIVATE/'post-install-backup-toc.private.json',{'toc_hex':toc.hex()})
  result['backup']='HASHES_AND_PG_RESTORE_TOC_VALIDATED';result['output']=output;result['toc_sha256']=lane.sha(toc)
  result['restore']='NOT_RUN; no destructive restore on original volume; restore13 historical evidence is separate'
  result['Storage']='archive inventory only; not proof of restored real document/scanner'
 except BaseException as error:primary=error;result['first_error']=str(error)
 finally:
  # Existing lifecycle is authoritative. Resume only same registered resources.
  # If stopping the app was unknown, never use cleanup to force a replacement.
  if result['app_stop']=='ACK_PROCESS_ENDED_PORT_FREE':
   try:
    stack.compose(['start','auth','rest','storage','gateway'])
    stack.start_gateway_process();stack.health();result['resume']='ACK_SAME_CONTAINERS_RELAY'
   except BaseException as error:
    result['resume']='FAILED_OR_UNKNOWN';primary=primary or error;result['first_error']=result['first_error'] or str(error)
  else:result['resume']='SKIPPED_NOT_REQUIRED_NO_REPLACEMENT'
  result['app']='STOPPED; same official built-source start required, not auto-retry'
  result['state']='PASS_BACKUP_INTEGRITY_TOC_ONLY' if primary is None else 'FAILED_OR_UNKNOWN_STOP'
  lane.write(lane.PRIVATE/'post-install-backup.result.json',result)
 if primary:raise primary
 print(json.dumps({'state':result['state'],'resume':result['resume'],'app':'STOPPED','native_restore':'NOT_RUN'}))


if __name__=='__main__':
 try:main()
 except BaseException:
  print(json.dumps({'state':'STOP','private_diagnostic':True}));sys.exit(1)
