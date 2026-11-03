#!/usr/bin/env python3
"""Closed native ABI15 harness. Default inspect; curated registry EMPTY in R1.

prepare creates a PRIVATE, non-authorizing SQL/request candidate. run cannot
dispatch without an exact external curated record. No target/SQL/shell arguments.
Existing Wire owns the PostgreSQL stream; existing stack owns service custody.
"""
import copy
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import shutil
import sys
import time
import uuid
import zlib
import struct
import base64
import hmac

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(HERE))
from local_runtime_consumer import AdmissionError, digest, unique_object, exact_keys
from acl02_pg_wire import Wire
from audit import fingerprint
from plan import render, validate, NON_DML

PRIVATE = Path('/workspace/private/platform-storage-documents-native-abi-15/acl-r1')
REGISTRY = HERE / 'reviews.json'
PARENT = 'b7f61c027e9fd96afc663fc208d869760f14c791'
CONSUMER = '16daca595aa2fad8300c8d4d3d6ea4b28980fed8'
LIMIT_SECONDS = 360


def need(v, why):
 if not v:
  raise AdmissionError(why)


def read(p):
 need(p.resolve() == p and not p.is_symlink() and p.is_file() and p.stat().st_nlink == 1, 'FILE_CUSTODY')
 return p.read_bytes()


def json_read(p):
 return json.loads(read(p), object_pairs_hook=unique_object)


def write(p, v):
 raw = (json.dumps(v, indent=2) + '\n').encode()
 fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
 with os.fdopen(fd, 'wb') as f:
  need(f.write(raw) == len(raw), 'SHORT_PRIVATE_WRITE')
  f.flush()
  os.fsync(f.fileno())
 return raw


def seal():
 for name, expected in {'audit': HERE/'audit.py', 'plan': HERE/'plan.py',
  'local_runtime_consumer': ROOT/'scripts/local_runtime_consumer.py',
  'acl02_pg_wire': ROOT/'scripts/acl02_pg_wire.py'}.items():
  need(Path(sys.modules[name].__file__).resolve() == expected, 'EXECUTABLE_MODULE_BINDING')
 v = json_read(HERE / 'source-seal.json')
 need(v['sha256'] == digest(json.dumps(v['files'], sort_keys=True, separators=(',', ':')).encode()), 'SEAL_ENCODING')
 for name, pin in v['files'].items():
  need(name.startswith(('scripts/', 'docs/testing/')) and '..' not in Path(name).parts, 'SEAL_PATH')
  need(digest(read(ROOT / name)) == pin, 'SOURCE_SEAL_DRIFT')
 return v['sha256']


def sdk_gate():
 for rel, pin in json_read(HERE / 'sdk-pins.json')['files'].items():
  need('..' not in Path(rel).parts and not Path(rel).is_absolute(), 'SDK_PIN_PATH')
  b = read(Path('/workspace/cladora-website/node_modules') / rel)
  need(len(b) == pin['bytes'] and digest(b) == pin['sha256'], 'SDK_DRIFT')


def tools():
 values = {}
 for name, selected in {'node': shutil.which('node'), 'docker': shutil.which('docker'), 'python': sys.executable}.items():
  need(selected, 'MISSING_EXISTING_TOOL')
  p = Path(selected).resolve(); b = read(p)
  values[name] = {'path': str(p), 'bytes': len(b), 'sha256': digest(b)}
 for name in ('NODE_OPTIONS','LD_PRELOAD','LD_LIBRARY_PATH'):
  need(not os.environ.get(name), 'TOOL_ENV_INJECTION_HOLD')
 # NODE_PATH is a lookup selector, not an execution hook. Preserve and pin the
 # installed selector; the worker loader denies every unpinned resolved file.
 values['environment'] = {'node_path_sha256': digest(os.environ.get('NODE_PATH','').encode())}
 return values


def admission(raw, records, current_seal, clock=time.time):
 need(isinstance(raw, bytes) and len(raw) <= 32768, 'REQUEST_SIZE')
 v = json.loads(raw, object_pairs_hook=unique_object)
 exact_keys(v, ('format','parent','consumer','source_seal','fixture','target','sdk_versions','sql',
  'policies','harden_relations','authority','execution_binding','deadline_seconds','recovery_representation_gate',
  'acl_lease','native_status','cleanup_followup','wire','allowed_sdk_sequence','capture','retention_private_days','tools','input_bytes'))
 need(v['capture'] == json_read(HERE/'contract.json')['capture'] and v['retention_private_days'] == 30, 'CAPTURE_CONTRACT_BINDING')
 need(v['format'] == 'platform15-native-execution-candidate.v1' and v['authority'] is None
  and v['execution_binding'] is None and v['parent'] == PARENT and v['consumer'] == CONSUMER, 'REQUEST_SCOPE')
 need(v['source_seal'] == current_seal and v['sdk_versions'] == {'supabase': '2.112.4', 'storage': '2.112.4', 'auth': '2.112.4'}, 'REQUEST_PIN')
 validate(v['fixture'])
 r = records.get(digest(raw))
 keys = {'source_seal', 'review', 'single_use', 'expires_at', 'target_sha256', 'acl_recovery', 'acl_delta_sha256', 'cleanup_only_after_expiry'}
 need(isinstance(r, dict) and set(r) == keys and r['source_seal'] == current_seal
  and r['single_use'] is True and r['target_sha256'] == fingerprint(v['target'])
  and r['acl_delta_sha256'] == v['sql']['acl_apply']['sha256']
  and r['acl_recovery'] == 'ACCEPT_EFFECTIVE_GRANTOR_RECOVERY_WITH_RAW_NULL_REPRESENTATION_CHANGE'
  and r['cleanup_only_after_expiry'] is True
  and re.fullmatch(r'https://github.com/ontripai/cladora-website/issues/463#issuecomment-[0-9]+', str(r['review'])), 'HOLD_EXACT_NATIVE_AND_ACL_REVIEW_REQUIRED')
 need(isinstance(r['expires_at'], (int, float)) and r['expires_at'] > clock(), 'REVIEW_EXPIRED')
 return v, r


def stack_module():
 spec = importlib.util.spec_from_file_location('owned_stack15r1', ROOT / 'scripts/functional-dev-stack-v1/stack.py')
 m = importlib.util.module_from_spec(spec)
 spec.loader.exec_module(m)
 m.state()
 return m


def service_identity(stack):
 values = {}
 for service in ('pg', 'auth', 'rest', 'storage', 'gateway'):
  cid, info = stack.cid(service)
  need(info['State']['Running'], 'SERVICE_NOT_RUNNING')
  values[service] = {'cid': cid, 'image': info['Image'], 'started': info['State']['StartedAt']}
 return values


def provider_roles(stack, require_current=True):
 # Verify existing local API bindings. This never creates a JWT/user/authority.
 s, _ = stack.state()
 for selector, expected in (('anon_key','anon'), ('service_key','service_role')):
  a,b,c = s[selector].split('.')
  decode = lambda x: base64.urlsafe_b64decode(x + '=' * (-len(x) % 4))
  header, claims = json.loads(decode(a)), json.loads(decode(b))
  signature = hmac.new(s['jwt_secret'].encode(), (a+'.'+b).encode(), hashlib.sha256).digest()
  need(header.get('alg') == 'HS256' and hmac.compare_digest(signature, decode(c))
   and claims.get('role') == expected, 'PROVIDER_API_ROLE_BINDING')
  need(not require_current or claims.get('exp',0) > time.time(), 'PROVIDER_API_BINDING_EXPIRED')


def expected_post(v, hardened):
 result = copy.deepcopy(v)
 principal = {r['name']: str(r['oid']) for r in v['roles']}
 for r in result['relations']:
  if r['name'] in hardened:
   r['acl_expanded'] = [a for a in r['acl_expanded'] if not (str(a['grantee']) == principal['service_role'] and a['privilege_type'] in NON_DML)]
   r['acl'] = [a.replace('service_role=arwdDxtm/', 'service_role=arwd/') for a in r['acl']]
  # Effective flags present in the collector are recomputed for schema USAGE.
  for a in r['effective']:
   if a['role'] in ('authenticated', 'service_role'):
    a['usage'] = True
 owner = v['namespace']['owner']
 result['namespace']['acl'] = ['supabase_storage_admin=UC/supabase_storage_admin', 'authenticated=U/supabase_storage_admin', 'service_role=U/supabase_storage_admin']
 result['namespace']['effective_acl'] = [*v['namespace']['effective_acl'],
  {'grantor': owner, 'grantee': principal['authenticated'], 'privilege_type': 'USAGE', 'is_grantable': False},
  {'grantor': owner, 'grantee': principal['service_role'], 'privilege_type': 'USAGE', 'is_grantable': False}]
 return result


def semantic_namespace(v):
 out = copy.deepcopy(v)
 out['namespace']['acl'] = None  # compare separately: raw NULL is NOT restored
 return out


def verify_materials(request, planned, directory):
 need(set(request['sql']) == set(planned['sql']), 'FIXED_SQL_STAGE_SET')
 need(request['policies'] == planned['policies'] and request['harden_relations'] == planned['harden_relations'], 'FIXED_POLICY_PRIVILEGE_PLAN')
 for stage, expected in planned['sql'].items():
  raw = read(directory/(stage+'.sql'))
  need(raw == expected and request['sql'][stage] == {'bytes':len(expected),'sha256':digest(expected)}, 'SQL_NOT_DETERMINISTIC_SOURCE_OUTPUT')


def png(red):
 def chunk(kind, b):
  return struct.pack('!I', len(b)) + kind + b + struct.pack('!I', zlib.crc32(kind + b))
 return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes([0, red, 0, 0]))) + chunk(b'IEND', b'')


def prepare():
 # SOURCE preparation only. No server health/login/catalog query is dispatched.
 current = seal()
 sdk_gate()
 stack = stack_module()
 provider_roles(stack)
 ids = service_identity(stack)
 accepted = json_read(PRIVATE.parent/'native-preflight/services.before.json')
 need(all(ids[k] == {'cid':v['cid'],'image':v['image_id'],'started':v['started']} for k,v in accepted.items()), 'EXISTING_SERVICE_IDENTITY_CHANGED')
 before = json_read(PRIVATE / 'catalog.private.json')
 review = json_read(ROOT / 'docs/testing/platform-storage-documents-native-abi-15.r1.acl-review.json')
 review['actor_helper'] = json_read(ROOT / 'docs/testing/platform-storage-documents-native-abi-15.r1.actor-helper.json')
 need(fingerprint(before) == review['private_snapshot_sha256'], 'PRIVATE_BASELINE_DRIFT')
 # Existing infrastructure identity is a candidate target pin, not fresh execution proof.
 persistence = json_read(stack.PRIVATE / 'persistence.receipt.json')
 need(persistence['state'] == 'PASS_REAL_LOCAL_RESTART_PERSISTENCE' and re.fullmatch(r'verification-[0-9]+\.json', persistence['after']), 'PERSISTENCE_REFERENCE')
 after = read(stack.PRIVATE / persistence['after'])
 need(digest(after) == persistence['after_sha256'], 'PERSISTENCE_IDENTITY_PIN')
 verification = json.loads(after)
 need(verification['instance'] == stack.state()[1]['instance'], 'PERSISTENCE_INSTANCE_MISMATCH')
 pg_identity = verification['pg_identity']
 need(pg_identity['version'] in ('170011', 170011), 'EXISTING_PRIVATE_PG_IDENTITY_REQUIRED')
 users = json_read(stack.PRIVATE / 'users.json')
 need(users['state'] == 'CREATED_BY_REAL_AUTH' and len(users['users']) == 2, 'SYNTHETIC_USER_CUSTODY')
 run = uuid.uuid4().hex
 f = {'run': run, 'bucket': 'platform15-' + run, 'path': 'owned/fixture.png', 'actor_a': users['users'][0]['id'], 'actor_b': users['users'][1]['id']}
 target = {'services': ids, 'instance': stack.state()[1]['instance'], 'system_identifier': str(pg_identity['system_identifier']), 'database_oid': str(pg_identity['database_oid'])}
 plan = render(before, review, f, {k: target[k] for k in ('system_identifier', 'database_oid')})
 directory = PRIVATE / 'candidate'
 directory.mkdir(mode=0o700)
 inputs = {}
 for stage, payload in plan['sql'].items():
  p = directory / (stage + '.sql')
  fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
  with os.fdopen(fd, 'wb') as out:
   need(out.write(payload) == len(payload), 'SQL_CANDIDATE_SHORT_WRITE'); out.flush(); os.fsync(out.fileno())
  inputs[stage] = {'bytes': len(payload), 'sha256': digest(payload)}
 value = {'format': 'platform15-native-execution-candidate.v1', 'parent': PARENT, 'consumer': CONSUMER,
  'source_seal': current, 'fixture': f, 'target': target,
  'sdk_versions': {'supabase': '2.112.4', 'storage': '2.112.4', 'auth': '2.112.4'},
  'sql': inputs, 'policies': plan['policies'], 'harden_relations': plan['harden_relations'],
  'authority': None, 'execution_binding': None, 'deadline_seconds': LIMIT_SECONDS,
  'recovery_representation_gate': plan['raw_namespace_recovery'], 'acl_lease': 'REQUIRES_COORDINATOR_EXCLUSIVE_STORAGE_ACL_WINDOW',
  'native_status': 'NOT_RUN', 'cleanup_followup': 'Platform; immediately on UNKNOWN, follow-up within1hour; no automatic retry',
  'capture': json_read(HERE/'contract.json')['capture'], 'retention_private_days': 30,
  'tools': tools(),
  'input_bytes': {k:{'bytes':len(b),'sha256':digest(b),'mime':'image/png'} for k,b in [('original',png(0)),('replacement',png(255))]},
  'wire': 'existing acl02_pg_wire.Wire; custodian postgres only, separate from SDK consumers',
  'allowed_sdk_sequence': ['real_login_a_b', 'upload_false', 'info_download_info', 'duplicate_false', 'upsert_true', 'update', 'foreign_info_download', 'anonymous_info_download', 'anonymous_public_url_actual_get', 'custodian_exact_remove_delete_bucket', 'local_signout_new_sessions']}
 raw = write(directory / 'execution-request.json', value)
 print(json.dumps({'request_bytes': len(raw), 'request_sha256': digest(raw), 'source_seal': current, 'authority': None, 'execution_binding': None, 'native': 'NOT_RUN'}))


class Run:
 def __init__(self):
  self.raw = read(PRIVATE / 'candidate/execution-request.json')
  self.v, self.review = admission(self.raw, json_read(REGISTRY)['reviews'], seal())
  sdk_gate()
  need(tools() == self.v['tools'], 'RUNTIME_TOOL_PIN_DRIFT')
  self.stack = stack_module()
  self.original = json_read(PRIVATE / 'catalog.private.json')
  self.fixture = self.v['fixture']
  review = json_read(ROOT/'docs/testing/platform-storage-documents-native-abi-15.r1.acl-review.json')
  review['actor_helper'] = json_read(ROOT/'docs/testing/platform-storage-documents-native-abi-15.r1.actor-helper.json')
  need(fingerprint(self.original) == review['private_snapshot_sha256'], 'EXACT_PRIVATE_BASELINE_REQUIRED')
  users = json_read(self.stack.PRIVATE/'users.json')['users']
  need([u['id'] for u in users] == [self.fixture['actor_a'],self.fixture['actor_b']], 'EXISTING_ACTORS_BEFORE_PROVISION')
  self.plan = render(self.original,review,self.fixture,{k:self.v['target'][k] for k in ('system_identifier','database_oid')})
  verify_materials(self.v,self.plan,PRIVATE/'candidate')
  self.out = PRIVATE / ('run-' + self.fixture['run'])
  # Exclusive claim: interruption consumes this candidate; no new run name fallback.
  self.out.mkdir(mode=0o700)
  write(self.out / 'attempt.claim.json', {'request_sha256': digest(self.raw), 'parent_pid': os.getpid(), 'claimed_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
  self.r = {'format': 'platform15-native-run-receipt.v1', 'primary_error': None,
   'stages': {}, 'cleanup': {}, 'native': 'NOT_RUN', 'target': self.v['target']}
  self.deadline = time.monotonic() + LIMIT_SECONDS
  self.expected_catalog = self.original
  self.counter = 0
  self.child = None

 def save(self, event):
  write(self.out / ('receipt-%03d.json' % self.counter), {'event': event, **self.r})
  self.counter += 1

 def gate(self, cleanup=False):
  source = seal()
  need(source == self.v['source_seal'], 'SOURCE_CHANGED_AT_EFFECT')
  records = json_read(REGISTRY)['reviews']
  record = records.get(digest(self.raw))
  need(record == self.review, 'REVIEW_CHANGED_AT_EFFECT')
  need(cleanup or time.monotonic() < self.deadline, 'OVERALL_DEADLINE_UNKNOWN')
  need(cleanup or self.review['expires_at'] > time.time(), 'REVIEW_EXPIRED_AT_EFFECT')
  sdk_gate()
  need(tools() == self.v['tools'], 'RUNTIME_TOOL_CHANGED_AT_EFFECT')
  need(service_identity(self.stack) == self.v['target']['services'], 'LIVE_CID_IMAGE_START_DRIFT')
  need(self.stack.state()[1]['instance'] == self.v['target']['instance'], 'INSTANCE_DRIFT')
  provider_roles(self.stack, require_current=not cleanup)
  # Hashing, fsyncs and Docker inspection do not preserve an earlier lease check.
  need(json_read(REGISTRY)['reviews'].get(digest(self.raw)) == self.review, 'REVIEW_CHANGED_BEFORE_EFFECT')
  need(seal() == self.v['source_seal'], 'SOURCE_CHANGED_BEFORE_EFFECT')
  need(cleanup or self.review['expires_at'] > time.time(), 'REVIEW_EXPIRED_BEFORE_EFFECT')
  need(cleanup or time.monotonic() < self.deadline, 'DEADLINE_BEFORE_EFFECT_UNKNOWN')

 def sql(self, stage, payload, commit=False, cleanup=False):
  self.gate(cleanup)
  connection = None
  result = None
  self.r['stages'][stage] = 'DISPATCHED'
  self.save(stage + '-dispatch')
  try:
   connection = Wire(self.v['target']['services']['pg']['cid'], 'p15-' + self.fixture['run'][:12], self.fixture['run'],
    stage, self.out, self.stack.DOCKER, self.stack.env(), lambda: self.gate(cleanup))
   ident = connection.identity(lambda: self.gate(cleanup))
   need(ident['version'] == 170011 and all(str(ident[k]) == str(self.v['target'][k]) for k in ('system_identifier', 'database_oid')), 'PHYSICAL_DATABASE_MISMATCH')
   result = connection.query(payload, lambda: self.gate(cleanup), 15)
   need(not result['errors'], 'SQL_ERROR_' + '-'.join(result['errors']))
   need(result['ready'] == 'I' and (not commit or result['tags'][-1:] == ['COMMIT']), 'SQL_TERMINAL_ACK_UNKNOWN')
   self.r['stages'][stage] = {'status': 'ACKNOWLEDGED', 'wire': result, 'physical_identity': ident}
   self.save(stage + '-ack')
   return result
  except BaseException as e:
   self.r['primary_error'] = self.r['primary_error'] or str(e) or type(e).__name__
   self.r['stages'][stage] = {'status': 'SQL_ERROR_TERMINAL_OBSERVED' if result and result['errors'] else 'UNKNOWN',
    'terminal': result, 'error': str(e) or type(e).__name__}
   if connection is not None:
    try: self.r['cleanup'][stage + '_rollback'] = connection.rollback_known()
    except Exception: self.r['cleanup'][stage + '_rollback'] = {'state': 'unknown'}
   self.save(stage + '-failed')
   raise
  finally:
   if connection is not None:
    try: connection.close()
    except Exception: self.r['cleanup'][stage + '_close'] = 'UNKNOWN'

 def catalog(self, phase, cleanup=False):
  r = self.sql(phase, read(HERE / 'catalog-review.sql'), cleanup=cleanup)
  need(len(r['rows']) == 1, 'CATALOG_ROW_SHAPE')
  return r['rows'][0]

 def material(self, stage):
  b = read(PRIVATE / ('candidate/' + stage + '.sql'))
  pin = self.v['sql'][stage]
  need(b == self.plan['sql'][stage] and len(b) == pin['bytes'] and digest(b) == pin['sha256'], 'SQL_PAYLOAD_DRIFT')
  return b

 def files(self, phase):
  self.gate(True)
  # Read-only native file-backend observer. No deletion, arbitrary path, or symlink traversal.
  code = """const fs=require('fs');const b=process.argv[1];if(!/^platform15-[0-9a-f]{32}$/.test(b))throw Error('bucket');const root='/var/lib/storage/local/cladora-functional-dev-v1/'+b;let files=0,dirs=0;function walk(p,depth){if(depth>12)throw Error('depth');let s;try{s=fs.lstatSync(p)}catch(e){if(e.code==='ENOENT')return;throw e}if(s.isSymbolicLink())throw Error('symlink');if(s.isDirectory()){dirs++;if(dirs>1024)throw Error('dirs');for(const x of fs.readdirSync(p))walk(p+'/'+x,depth+1)}else{if(!s.isFile())throw Error('kind');files++;if(files>1024)throw Error('files')}}for(const p of ['/var/lib/storage','/var/lib/storage/local','/var/lib/storage/local/cladora-functional-dev-v1']){try{if(fs.lstatSync(p).isSymbolicLink())throw Error('parent-symlink')}catch(e){if(e.code!=='ENOENT')throw e}}walk(root,0);console.log(JSON.stringify({files,dirs}));"""
  p = subprocess.run(self.stack.DOCKER + ['exec', self.v['target']['services']['storage']['cid'], 'node', '-e', code, self.fixture['bucket']], env=self.stack.env(), capture_output=True, timeout=10)
  need(p.returncode == 0, 'PHYSICAL_RESIDUE_UNKNOWN')
  value = json.loads(p.stdout)
  self.r['cleanup'][phase] = value
  self.save(phase)
  return value

 def resource_observer(self):
  from plan import literal
  b = literal(self.fixture['bucket'])
  q = ("SELECT json_build_object('buckets',(SELECT count(*) FROM storage.buckets WHERE id=%s),'objects',(SELECT count(*) FROM storage.objects WHERE bucket_id=%s));" % (b, b)).encode()
  r = self.sql('resource-observer', q, cleanup=True)
  need(len(r['rows']) == 1, 'RESIDUE_OBSERVER_SHAPE')
  self.r['cleanup']['database_residue'] = r['rows'][0]
  return r['rows'][0]

 def worker(self):
  self.gate()
  for k,b in [('original',png(0)),('replacement',png(255))]:
   need(self.v['input_bytes'][k] == {'bytes':len(b),'sha256':digest(b),'mime':'image/png'}, 'FIXTURE_INPUT_PIN_DRIFT')
  s, _ = self.stack.state()
  users = json_read(self.stack.PRIVATE / 'users.json')['users']
  need([u['id'] for u in users] == [self.fixture['actor_a'], self.fixture['actor_b']], 'ACTOR_CUSTODY_DRIFT')
  error_file = open(self.out / 'worker-stderr.private.log', 'xb'); os.chmod(error_file.name, 0o600)
  p = subprocess.Popen([self.v['tools']['node']['path'], str(HERE / 'native.mjs')], env=self.stack.env(), stdin=subprocess.PIPE,
   stdout=subprocess.PIPE, stderr=error_file, bufsize=0)
  self.child = p
  import base64
  ctx = {'type': 'start', 'fixture': self.fixture, 'worker_pid': p.pid, 'parent_pid': os.getpid(), 'origin': 'http://127.0.0.1:55421',
   'output': str(self.out), 'anon_key': s['anon_key'], 'service_key': s['service_key'],
   'users': {actor: {'email': u['email'], 'password': s[u['password_key']]} for actor, u in zip(('a', 'b'), users)},
   'request_sha256': digest(self.raw), 'source_seal': self.v['source_seal'],
   'fixture_bytes_base64': base64.b64encode(png(0)).decode(), 'replacement_bytes_base64': base64.b64encode(png(255)).decode()}
  p.stdin.write((json.dumps(ctx) + '\n').encode()); p.stdin.flush()
  selector = selectors.DefaultSelector(); selector.register(p.stdout, selectors.EVENT_READ)
  buffer = b''; result = None; sequence = 0
  try:
   while result is None:
    need(time.monotonic() < self.deadline, 'WORKER_DEADLINE_UNKNOWN')
    if not selector.select(1):
     need(p.poll() is None, 'WORKER_ENDED_ACK_UNKNOWN')
     continue
    data = os.read(p.stdout.fileno(), 65536)
    need(data, 'WORKER_STREAM_ACK_UNKNOWN'); buffer += data
    need(len(buffer) < 262144, 'WORKER_FRAME_UNKNOWN')
    while b'\n' in buffer:
     line, buffer = buffer.split(b'\n', 1)
     msg = json.loads(line, object_pairs_hook=unique_object)
     if msg['type'] == 'result': result = msg['result']; break
     need(msg['type'] == 'gate' and msg['sequence'] == sequence + 1, 'WORKER_GATE_CORRELATION')
     sequence += 1
     cleanup = msg.get('cleanup') is True
     phase = msg.get('phase', '')
     need(not cleanup or phase.startswith('cleanup-') or phase.endswith('-logout'), 'CLEANUP_SCOPE')
     self.gate(cleanup)
     ack = {'type': 'gate_ack', 'sequence': sequence, 'ok': True, 'expires_at': self.review['expires_at'] * 1000,
      'cleanup_only': cleanup, 'run': self.fixture['run'], 'request_sha256': digest(self.raw)}
     p.stdin.write((json.dumps(ack) + '\n').encode()); p.stdin.flush()
   p.stdin.close()
   code = p.wait(timeout=8)
   need(result is not None and code in (0, 1), 'WORKER_EXIT_UNKNOWN')
   write(self.out / 'sdk-result.private.json', result)
   return result
  finally:
   selector.close()
   if p.poll() is None:
    p.terminate()
    try: p.wait(timeout=5)
    except subprocess.TimeoutExpired:
     p.kill()
     try: p.wait(timeout=3)
     except subprocess.TimeoutExpired: self.r['cleanup']['worker_process'] = 'UNKNOWN'
   error_file.close()
   self.child = None

 def execute(self):
  acl = fixture = False
  try:
   before = self.catalog('prestate')
   need(fingerprint(before) == fingerprint(self.original), 'CATALOG_PRESTATE_DRIFT')
   helper = self.sql('actor-helper-prestate', read(HERE / 'actor-helper-review.sql'))
   need(len(helper['rows']) == 1 and fingerprint(helper['rows'][0]) == fingerprint(json_read(PRIVATE/'actor-helper.private.json')), 'ACTOR_HELPER_PRESTATE_DRIFT')
   physical_before = self.files('physical-before')
   need(physical_before['files'] == 0 and physical_before['dirs'] == 0, 'PREEXISTING_RUN_FILES_OR_DIRECTORIES')
   self.sql('acl-apply', self.material('acl_apply'), True); acl = True
   post = self.catalog('acl-poststate')
   expected = expected_post(self.original, self.v['harden_relations'])
   need(fingerprint(post) == fingerprint(expected), 'ACL_POSTSTATE_MISMATCH')
   self.sql('fixture-create', self.material('fixture_create'), True); fixture = True
   self.expected_catalog = self.catalog('fixture-poststate')
   policies = [p for r in self.expected_catalog['relations'] for p in (r['policies'] or [])]
   need(len(policies) == 7 and {p['name'] for p in policies} == {p['name'] for p in self.v['policies']}, 'FIXTURE_POLICY_POSTSTATE')
   self.r['native'] = {'status':'DISPATCHED_UNKNOWN_PENDING_ACK','unknown':True}
   self.save('worker-dispatch-intent')
   native = self.worker(); self.r['native'] = native
   self.r['primary_error'] = self.r['primary_error'] or native['first_error']
  except BaseException as e:
   self.r['primary_error'] = self.r['primary_error'] or str(e) or type(e).__name__
  finally:
   # Read-only observer remains useful on native error; deletion is not retried.
   empty = False
   if fixture:
    try:
     obs = self.resource_observer(); physical = self.files('physical-after')
     empty = obs == {'buckets': 0, 'objects': 0} and physical['files'] == 0 and physical['dirs'] == 0
     terminal_unknown = isinstance(self.r['native'],dict) and self.r['native'].get('unknown') is True
     self.r['cleanup']['residue'] = ('UNKNOWN_NATIVE_TERMINAL_ONLY_ZERO_POINT_OBSERVATION' if terminal_unknown else 'ZERO_OBSERVED') if empty else 'NONZERO_OR_UNKNOWN'
     now_catalog = self.catalog('cleanup-catalog', True)
     need(fingerprint(now_catalog) == fingerprint(self.expected_catalog), 'FOREIGN_CATALOG_DRIFT_RECOVERY_HOLD')
     if empty:
      self.sql('fixture-policies-drop', self.material('fixture_drop_policies'), True, True)
      self.r['cleanup']['policies'] = 'ACKNOWLEDGED'
     else: self.r['cleanup']['policies'] = 'SKIPPED_RESOURCES_REQUIRE_CUSTODIAN_FOLLOWUP'
    except Exception as e:
     self.r['cleanup']['residue'] = 'UNKNOWN'
     self.r['primary_error'] = self.r['primary_error'] or str(e)
   if acl:
    try:
     # Only undo the exact owned ACL delta; foreign changes block automatic recovery.
     v = self.catalog('recovery-prestate', True)
     expected = expected_post(self.original, self.v['harden_relations'])
     if fixture and not empty:
      expected = self.expected_catalog
     need(fingerprint(v) == fingerprint(expected), 'ACL_RECOVERY_PRESTATE_MISMATCH')
     self.sql('acl-recover', self.material('acl_recover'), True, True)
     final = self.catalog('recovery-observer', True)
     self.r['cleanup']['namespace_raw_null_restored'] = final['namespace']['acl'] is None
     # Policies may remain on an owned bucket after failed native cleanup. Never call it complete.
     compare = copy.deepcopy(final)
     if fixture and not empty:
      for rel in compare['relations']: rel['policies'] = None
     need(fingerprint(semantic_namespace(compare)) == fingerprint(semantic_namespace(self.original)), 'EFFECTIVE_ACL_GRANTOR_RECOVERY_MISMATCH')
     self.r['cleanup']['acl'] = 'EFFECTIVE_PRIVILEGES_AND_GRANTORS_RESTORED_RAW_NULL_REPRESENTATION_CHANGED'
    except Exception as e:
     self.r['cleanup']['acl'] = 'FAILED_OR_UNKNOWN'
     self.r['primary_error'] = self.r['primary_error'] or str(e)
   self.r['cleanup']['scope'] = 'Only exact run bucket/object/policies and explicitly approved temporary ACL delta; no users/old sessions/volumes removed'
   self.r['custody_followup'] = 'Platform immediately on UNKNOWN;1hour follow-up; private evidence30days; no automatic retry'
   self.r['status'] = 'FAILED_OR_UNKNOWN' if self.r['primary_error'] or not empty else 'NATIVE_ABI_RLS_FIXTURE_OBSERVED_WITH_ACCEPTED_SEMANTIC_ACL_RECOVERY_ONLY'
   self.save('final')
  print(json.dumps({'status': self.r['status'], 'native_run': 'ATTEMPT_CONSUMED', 'private_evidence': True}))


def main():
 need(len(sys.argv) == 2 and sys.argv[1] in ('--inspect', '--prepare', '--run'), 'FIXED_MODE_REQUIRED')
 if sys.argv[1] == '--inspect':
  print(json.dumps({'source_seal': seal(), 'registry': 'EMPTY' if not json_read(REGISTRY)['reviews'] else 'CURATED_RECORDS_PRESENT',
   'native': 'NOT_RUN', 'authority': None, 'execution_binding': None})); return
 if sys.argv[1] == '--prepare': prepare(); return
 import signal
 def interrupt(_signum, _frame):
  raise RuntimeError('INTERRUPTED_UNKNOWN_NO_RETRY')
 signal.signal(signal.SIGTERM, interrupt)
 signal.signal(signal.SIGINT, interrupt)
 Run().execute()


if __name__ == '__main__':
 try: main()
 except Exception as error:
  # Reasons are codes, no provider body/credential/env dump.
  print('HOLD_OR_UNKNOWN:' + type(error).__name__, file=sys.stderr)
  sys.exit(2)
