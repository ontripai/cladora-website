#!/usr/bin/env python3
"""Keep the EXACT Platform12 relay child inside a live execution session.
No new transport, port, shell, SQL selector, provider config or controller.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import time

REF='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
parser=argparse.ArgumentParser(allow_abbrev=False)
parser.add_argument('--platform-source',required=True)
parser.add_argument('--recover-confirmed-dead',action='store_true')
a=parser.parse_args()
root=Path(a.platform_source).resolve()
def need(ok,code):
 if not ok:raise RuntimeError(code)
need(subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==REF,'PLATFORM_PIN_MISMATCH')
for name in ['stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf']:
 path='scripts/functional-dev-stack-v1/'+name
 expected=subprocess.check_output(['git','show',REF+':'+path],cwd=root)
 need((root/path).read_bytes()==expected,'PLATFORM_SOURCE_DRIFT')
spec=importlib.util.spec_from_file_location('core15_pinned_platform12',root/'scripts/functional-dev-stack-v1/stack.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.state();record=m.PRIVATE/'gateway-process.json'
if record.exists():
 old=json.loads(record.read_text())
 need(a.recover_confirmed_dead,'EXPLICIT_DEAD_RECEIPT_RECOVERY_REQUIRED')
 need(not Path('/proc',str(old['pid'])).exists(),'EXISTING_OR_REUSED_PID_STOP')
 for port in (55421,55422):
  s=socket.socket();busy=s.connect_ex(('127.0.0.1',port))==0;s.close();need(not busy,'PORT_BUSY_STOP')
 # This narrow recovery is BEFORE signup/commands only. Unknown request/data
 # outcomes on an established instance require the responsible owner instead.
 need(not(m.PRIVATE/'users.json').exists() and not list(m.PRIVATE.glob('signup-*.private.json')),'EXISTING_USER_EXECUTION_REQUIRES_OWNER_RECOVERY')
 count=m.sql(b'SELECT count(*) FROM auth.users;').decode().strip()
 need(count=='0','AUTH_ROWS_PRESENT_NO_RECOVERY')
 archive=m.PRIVATE/('gateway-process-exited-core15-'+str(time.time_ns())+'.json')
 record.rename(archive)
 m.write(m.PRIVATE/'core15-relay-recovery.json',{'previous_receipt_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'process_absence_observed':True,'ports_free':True,'users_dispatched':False,'auth_user_count':0,'source':REF,'cause_of_exit':'UNKNOWN; no invented daemon-exit explanation'})
m.start_gateway_process();new=m.gateway_process()
print(json.dumps({'relay':'PINNED_PLATFORM12_CHILD_RUNNING','source':REF,'pid':new['pid'],'parent_lifetime':'LIVE_TOOL_SESSION','domain_execution':False}),flush=True)
# Deliberately keep the parent session alive; not an unobserved daemon replacement.
_,status=os.waitpid(new['pid'],0)
print(json.dumps({'relay':'CHILD_EXITED','wait_status':status,'automatic_retry':False}),flush=True)
raise SystemExit(1)
