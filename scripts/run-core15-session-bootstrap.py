#!/usr/bin/env python3
"""Fixed Core15 session bootstrap on the EXACT locally owned Platform12 only.
No generic SQL, role selection, target fallback, application install or replay.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess

REF='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
p=argparse.ArgumentParser(allow_abbrev=False);p.add_argument('--platform-source',required=True);a=p.parse_args()
root=Path(a.platform_source).resolve();own=Path(__file__).resolve().parents[1]
def need(ok,code):
 if not ok:raise RuntimeError(code)
need(subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==REF,'PLATFORM_INPUT_MISMATCH')
for name in ['stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf']:
 path='scripts/functional-dev-stack-v1/'+name
 need((root/path).read_bytes()==subprocess.check_output(['git','show',REF+':'+path],cwd=root),'PLATFORM_SOURCE_DRIFT')
spec=importlib.util.spec_from_file_location('core15_p12',root/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
_,d=m.state();m.cid('pg');m.gateway_process()
private=m.PRIVATE/'core15';need(not private.exists(),'CORE15_SESSION_BOOTSTRAP_ALREADY_DISPATCHED_NO_REPLAY');private.mkdir(mode=0o700)
source=(own/'supabase/install/core-functional-runtime-v1/04-session-bootstrap.sql').read_text()
marker='-- CORE15_PRIVATE_RUNTIME_PASSWORD_BINDING';need(source.count(marker)==1,'CORE15_PASSWORD_MARKER_MISMATCH')
password=secrets.token_hex(32);need(len(password)==64 and all(c in '0123456789abcdef' for c in password),'PASSWORD_FORMAT')
backend='core15-dev:'+d['instance'];m.write(private/'runtime-secret.json',{'role':'cladora_core_runtime','password':password})
source_hash=hashlib.sha256(source.encode()).hexdigest();m.write(private/'session-bootstrap-receipt.json',{'state':'DISPATCHED_NO_RETRY','source_sha256':source_hash,'backend_id':backend,'platform':REF})
payload=("SELECT set_config('cladora.core15.owned_backend','"+backend+"',false);\n"+source.replace(marker,"ALTER ROLE cladora_core_runtime PASSWORD '"+password+"';")).encode()
try:
 output=m.sql(payload);m.write(private/'session-bootstrap-output.private.log',output)
 # Independent, data-free catalog observation, NOT a psql exit => RFQ claim.
 observed=m.sql(b"SELECT json_build_object('database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),'functions',(SELECT count(*) FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace),'roles',(SELECT count(*) FROM pg_roles WHERE rolname IN ('cladora_core_runtime','cladora_core_session_owner') AND NOT rolsuper AND NOT rolbypassrls));")
 state=json.loads(observed);need(state['functions']==2 and state['roles']==2,'CATALOG_POSTSTATE_MISMATCH')
 m.write(private/'session-bootstrap-receipt.json',{'state':'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED','source_sha256':source_hash,'backend_id':backend,'platform':REF,'database_oid':state['database_oid'],'raw_readyforquery':'NOT_CAPTURED_FOR_BOOTSTRAP','native_session_cases':'NOT_RUN'})
 print(json.dumps({'session_schema':'INSTALLED_INDEPENDENT_CATALOG_OBSERVED','ordinary_roles':2,'canonical_session_functions':2,'Context_authority_C03_S01':'NOT_INSTALLED','source_sha256':source_hash}))
except Exception:
 print(json.dumps({'state':'UNKNOWN_OR_FAILED','automatic_retry':False,'private_receipt_preserved':True}));raise
