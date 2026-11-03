#!/usr/bin/env python3
"""Fixed, one-shot LOCAL compatibility delta; never a generic SQL transport."""
import hashlib,importlib.util,json,subprocess
from pathlib import Path
root=Path('/workspace/work/platform12-core15-input-794f5a1')
ref='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==ref
spec=importlib.util.spec_from_file_location('p12',root/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
_,d=m.state();m.cid('pg');m.gateway_process()
receipt=m.PRIVATE/'core15/session-owner-repair.json'
assert not receipt.exists(),'OWNER_REPAIR_ALREADY_DISPATCHED_NO_RETRY'
original=json.loads((m.PRIVATE/'core15/native-session-proof.json').read_text())
assert original['state']=='FAILED_OR_UNKNOWN_NO_AUTOMATIC_RETRY' and not original['checks']
sql=(Path(__file__).resolve().parents[1]/'supabase/install/core-functional-runtime-v1/05-session-auth-owner.sql').read_bytes()
sha=hashlib.sha256(sql).hexdigest();m.write(receipt,{'state':'DISPATCHED_NO_RETRY','source_sha256':sha,'platform':ref})
try:
 payload=("SELECT set_config('cladora.core15.owned_backend','core15-dev:"+d['instance']+"',false);\n").encode()+sql
 output=m.sql(payload);m.write(m.PRIVATE/'core15/session-owner-repair.private.log',output)
 observed=m.sql(b"SELECT json_build_object('owners',(SELECT count(*) FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace AND proowner='supabase_auth_admin'::regrole),'runtime_auth_select',has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT'),'auth_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='auth.sessions'::regclass));")
 observed=json.loads(observed);assert observed=={'owners':2,'runtime_auth_select':False,'auth_rls':True}
 m.write(receipt,{'state':'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED','source_sha256':sha,'platform':ref,'raw_readyforquery':'NOT_CAPTURED','observed':observed})
 print(json.dumps({'state':'COMMIT_AND_CATALOG_OBSERVED','source_sha256':sha,'runtime_auth_select':False,'Auth_RLS_unchanged':True,'native_session':'NOT_YET_PROVED'}))
except Exception:
 print(json.dumps({'state':'FAILED_OR_UNKNOWN_NO_RETRY','private_receipt_preserved':True}));raise
