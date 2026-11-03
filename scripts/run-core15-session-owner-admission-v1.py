#!/usr/bin/env python3
"""Fresh exact Platform12 owner admission, not runtime principal selection.
Existing executions must use their preserved receipt; never repeat setup.
"""
import hashlib, importlib.util, json, subprocess
from pathlib import Path
root=Path('/workspace/work/platform12-core15-input-794f5a1')
ref='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==ref
for name in ['stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf']:
 path='scripts/functional-dev-stack-v1/'+name
 assert (root/path).read_bytes()==subprocess.check_output(['git','show',ref+':'+path],cwd=root)
spec=importlib.util.spec_from_file_location('p12',root/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
_,d=m.state();m.cid('pg');m.gateway_process()
private=m.PRIVATE/'core15';receipt=private/'session-owner-repair.json'
assert not receipt.exists(),'ALREADY_DISPATCHED_STOP'
assert json.loads((private/'session-bootstrap-receipt.json').read_text())['state']=='COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED'
sql=(Path(__file__).resolve().parents[1]/'supabase/install/core-functional-runtime-v1/05-session-auth-owner.sql').read_bytes()
expected=subprocess.check_output(['git','show','a0a37f3c573558d14be2e62ba27e6e5475b9c4fe:supabase/install/core-functional-runtime-v1/05-session-auth-owner.sql'],cwd=Path(__file__).resolve().parents[1])
assert sql==expected,'ACCEPTED_SESSION_SOURCE_CHANGED'
m.write(receipt,{'state':'DISPATCHED_NO_RETRY','source_sha256':hashlib.sha256(sql).hexdigest(),'platform':ref})
try:
 payload=("SELECT set_config('cladora.core15.owned_backend','core15-dev:"+d['instance']+"',false);\n").encode()+sql
 output=m.sql(payload);m.write(private/'session-owner-admission.private.log',output)
 observed=json.loads(m.sql(b"SELECT json_build_object('owners',(SELECT count(*) FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace AND proowner='supabase_auth_admin'::regrole),'runtime_auth_select',has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT'),'auth_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='auth.sessions'::regclass));"))
 assert observed=={'owners':2,'runtime_auth_select':False,'auth_rls':True}
 m.write(receipt,{'state':'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED','source_sha256':hashlib.sha256(sql).hexdigest(),'platform':ref,'raw_readyforquery':'NOT_CAPTURED','observed':observed})
 print(json.dumps({'state':'COMMIT_TAG_AND_CATALOG_OBSERVED','raw_readyforquery':'NOT_CAPTURED'}))
except Exception:
 print(json.dumps({'state':'FAILED_OR_UNKNOWN_STOP','automatic_retry':False}));raise
