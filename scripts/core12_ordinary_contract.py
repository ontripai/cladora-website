"""Exact inactive Core12 fixture contract. No SQL parsing or transport here."""
import datetime
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
DIRECTORY=ROOT/'supabase/local-profiles/core12-ordinary-v1'
PROFILE=ROOT/'supabase/local-profiles/runtime-pg-only-core12-ordinary-v1.json'
REQUEST=ROOT/'supabase/local-profiles/core12-ordinary.request.json'
REGISTRY=ROOT/'supabase/local-profiles/core12-ordinary-reviews-v1.json'
PROFILE_SHA='2456f87cfd1ce0064c90d2f4fe3327a18a44c2ca325093b4f5bcabb6b6714533'
SOURCE='1eb8b5a1e522a529b39af02e32748756ee04dfec'
WITNESS_SHA='07072fdae234825786709260befa0b2c5337b0379ce852f072fdbfb9d17a9158'
REUSED={
 'scripts/run-local-runtime-lane.py':'8f0a964041cb4c2a78ab37ec7fc5c36be817d106cb396f598e625ef62907068e',
 'scripts/local_runtime_consumer.py':'b240725de9119e0176e49fb0bc55f4917ef8df79a9383cb8d77ed97ca579d439',
 'scripts/run-acl02-pg-only.py':'bde75479e6b90c4ebec91742e19f8962d50b8842597b8362459d91dc0b5e5c4a',
 'scripts/acl02_pg_adapter.py':'72d7a69026cfe5d0dd15d6d5d4394ef62c4fced016919064150d3bc5ab5c361a',
 'scripts/acl02_pg_wire.py':'4fa852fbdb6047ec3c264e1fee53b6218d9db9abf8b462d29e10d24fc4b242c3',
 'supabase/local-profiles/runtime-pg-only-acl02-v1.json':'aa394a6068f75a438a3118f63c949984745d8ce46fc9cb69c525e51dd67cfaaa'}
OPERATIONS={
 'setup-roles':('setup-roles.sql',('custodian-root',),'COMMIT'),
 'setup-database':('setup-database.sql',('custodian-root',),'CREATE DATABASE'),
 'setup-access':('setup-access.sql',('custodian-root',),'COMMIT'),
 'setup-local':('setup-local.sql',('custodian-target',),'COMMIT'),
 'custodian-info':('custodian-identity.sql',('custodian-root',),'SELECT 1'),
 'identity':('ordinary-identity.sql',('executor','observer'),'SELECT 1'),
 'snapshot':('catalog-snapshot.sql',('observer',),'ROLLBACK'),
 'witness':(None,('executor',),'ROLLBACK')}
SETUP_ORDER=['setup-roles','setup-database','setup-access','setup-local']
SCOPES=['one-owned-pg17-fixture','exact-synthetic-role-db-setup','one-core12-boundary-witness',
        'correlated-custodian-metadata','independent-baseline-and-residue','owned-rollback-and-cleanup']

class Hold(ValueError): pass
def need(value,reason):
 if not value: raise Hold(reason)
def sha(raw): return hashlib.sha256(raw).hexdigest()
def canonical(v): return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def unique(pairs):
 out={}
 for k,v in pairs:
  need(k not in out,'CORE12_DUPLICATE_KEY');out[k]=v
 return out
def read_file(path,expected=None):
 path=Path(path);need(path.is_absolute() and path.resolve()==path and not path.is_symlink(),'CORE12_SOURCE_ALIAS')
 need(path.is_file() and path.stat().st_nlink==1,'CORE12_SOURCE_FILE')
 raw=path.read_bytes()
 if expected: need(len(raw)==expected['bytes'] and sha(raw)==expected['sha256'],'CORE12_SOURCE_DRIFT')
 return raw
def profile():
 raw=read_file(PROFILE);need(sha(raw)==PROFILE_SHA,'CORE12_PROFILE_DRIFT');return json.loads(raw)
def source_seal():
 p=profile();files={}
 for name,h in REUSED.items():need(sha(read_file(ROOT/name))==h,'CORE12_LEGACY_DRIFT');files[name]=h
 for name in ('core12_ordinary_contract.py','core12_ordinary_wire.py','run-core12-ordinary.py'):
  files['scripts/'+name]=sha(read_file(ROOT/'scripts'/name))
 files[str(PROFILE.relative_to(ROOT))]=PROFILE_SHA
 for name,pin in p['sql_pins'].items():files[str((DIRECTORY/name).relative_to(ROOT))]=sha(read_file(DIRECTORY/name,pin))
 return {'files':files,'sha256':sha(canonical(files))}
def load_module(name,path):
 path=Path(path);current=sys.modules.get(name)
 if current:
  need(Path(current.__file__).resolve()==path,'CORE12_FOREIGN_MODULE');return current
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
def legacy():
 for name,h in REUSED.items():need(sha(read_file(ROOT/name))==h,'CORE12_LEGACY_DRIFT')
 for name in ('local_runtime_consumer','acl02_pg_wire','acl02_pg_adapter'):load_module(name,ROOT/'scripts'/(name+'.py'))
 return load_module('core12_legacy_pg_lane',ROOT/'scripts/run-acl02-pg-only.py')
def witness(raw):need(type(raw) is bytes and len(raw)==20744 and sha(raw)==WITNESS_SHA,'CORE12_WITNESS_BYTES')
def payload(operation,witness_bytes):
 need(operation in OPERATIONS,'CORE12_UNKNOWN_OPERATION')
 name=OPERATIONS[operation][0]
 if name is None:witness(witness_bytes);return witness_bytes
 return read_file(DIRECTORY/name,profile()['sql_pins'][name])
def expected_request():
 p=profile()
 return {'format':'core12-ordinary-fixture-request.v1','source_commit':SOURCE,
  'source_seal':source_seal(),'profile_sha256':PROFILE_SHA,'witness':{'bytes':20744,'sha256':WITNESS_SHA,'query_frame_bytes':20750},
  'setup_order':SETUP_ORDER,'operations':{k:{'file':v[0],'actors':list(v[1]),'terminal_tag':v[2]} for k,v in OPERATIONS.items()},
  'sql_pins':p['sql_pins'],'actors':p['actors'],'scope':SCOPES,'planned_calls':176,'executed_calls':None,
  'target':None,'executor':None,'observer':None,'authority':None,'execution_binding':None,'registry':'EMPTY','live':'HOLD',
  'setup_transactions':'roles/access/local commit separately; CREATE DATABASE alone; all synthetic resources die with owned CID',
  'baseline':'independent read-only snapshot after setup before witness; persist before dispatch, never derive expected from candidate',
  'system_identity':'custodian actual pg_control_system + actual pg_stat_activity PID/datid/app/backend_start, same owned CID; no ordinary grant/SECURITY DEFINER',
  'wire':'same existing bounded PG reader/capture; closed versioned startup/query specialization; 20744 exact bytes in one20750-byte frame',
  'deadlines_seconds':p['deadlines_seconds'],'wire_limits':p['wire_limits'],'retry':False,
  'terminal':'error-free same connection final DO,ROLLBACK and ReadyForQuery I; ACK after durable raw capture',
  'recovery':'only same known non-quarantined T/E stream ROLLBACK and bounded owned read-only observation; never replay witness',
  'residue':'complete snapshot and exact pre/post protected hash equality; zero witness functions/matrix; no temp-namespace exclusion',
  'cleanup':'existing Lane cleanup/finalizer; all owned resources accounted; partial/unknown/duplicate/skip is not success',
  'proof_scope':'synthetic exception clauses only; no canonical authorization or genuine SSI','historical_slots':'BLOCKED'}
def request_bytes():return (json.dumps(expected_request(),indent=2)+'\n').encode()
def inspect(raw,witness_bytes):
 need(type(raw) is bytes and len(raw)<65536,'CORE12_REQUEST_BOUND')
 value=json.loads(raw,object_pairs_hook=unique);need(value==expected_request() and raw==request_bytes(),'CORE12_EXACT_REQUEST')
 witness(witness_bytes);return {'status':'SOURCE_VALID_LIVE_HOLD','source_seal':source_seal()['sha256'],'request_sha256':sha(raw),'planned_calls':176,'executed_calls':None}
def admit(raw,out):
 need(raw==request_bytes(),'CORE12_EXACT_REQUEST')
 registry=json.loads(read_file(REGISTRY),object_pairs_hook=unique)
 need(set(registry)=={'format','reviews'} and registry['format']=='core12-ordinary-curated-reviews.v1','CORE12_REGISTRY_SHAPE')
 record=registry['reviews'].get(sha(raw));need(isinstance(record,dict),'HOLD_CORE12_NO_CURATED_EXECUTION_REVIEW')
 keys={'request_sha256','source_seal_sha256','profile_sha256','source_commit','review','single_use','expires_at','scope','run_directory_sha256'}
 need(set(record)==keys and record['request_sha256']==sha(raw) and record['source_seal_sha256']==source_seal()['sha256']
  and record['profile_sha256']==PROFILE_SHA and record['source_commit']==SOURCE and record['scope']==SCOPES
  and record['single_use'] is True and re.fullmatch(r'https://github.com/ontripai/cladora-website/issues/463#issuecomment-[0-9]+',str(record['review'])),'CORE12_REVIEW_BINDING')
 now=datetime.datetime.now(datetime.timezone.utc);expiry=datetime.datetime.fromisoformat(record['expires_at'])
 need(expiry.tzinfo is not None and now<expiry<=now+datetime.timedelta(hours=1),'CORE12_REVIEW_EXPIRED')
 out=Path(out);need(out.is_absolute() and out.resolve()==out and record['run_directory_sha256']==sha(str(out).encode()),'CORE12_APPROVED_RUN_DIRECTORY')
 return sha(raw+canonical(record))
