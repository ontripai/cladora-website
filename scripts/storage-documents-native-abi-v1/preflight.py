#!/usr/bin/env python3
"""Task15 preflight ONLY: fixed existing local target; never provisions or uploads.

Exit 2 = BLOCKED/HOLD, not native ABI success. No generic SQL/target/exec interface.
The functional harness cannot safely start while the required ACL gate fails.
"""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PRIVATE = Path('/workspace/private/platform-storage-documents-native-abi-15/native-preflight')
IMAGE = 'docker.io/supabase/storage-api@sha256:31c11d93a3c7840f97acba43f6df9894028dc85dd9c0781d23427e2009be5b76'
SEALED = {
 'bootstrap.sql': 'fd77a96615502200d51046c6ab98485e81763377dd605b21426503a8ee25a540',
 'gateway.conf': 'dd60b2cd8e28bae75b0ba32943e65f236682d7a9e5ad43ca630e97bd8e23b8c1',
 'profile.json': '5287f38709eb71e85915c9e23a18dd3f7cbb8276346f271ded1dd485de792218',
 'provider-compatibility.sql': '5e6214c55dde2c4e2328c19cb79fc5a9a3ae0d84ecaab9544c419ff40a34fd7d',
 'stack.py': '2049056db7bf4dc47c7d57b3bbaf0da5e57812a3b1fe55685a9d263533cc10f7',
}


def sha(raw):
 return hashlib.sha256(raw).hexdigest()


def need(ok, reason):
 if not ok:
  raise RuntimeError(reason)


def safe_bytes(p):
 need(p.is_file() and not p.is_symlink() and p.resolve() == p and p.stat().st_nlink == 1, 'FILE_CUSTODY')
 return p.read_bytes()


def write(p, value):
 raw = (json.dumps(value, indent=2) + '\n').encode()
 fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
 with os.fdopen(fd, 'wb') as f:
  need(f.write(raw) == len(raw), 'RECEIPT_SHORT_WRITE')
  f.flush()
  os.fsync(f.fileno())
 return {'bytes': len(raw), 'sha256': sha(raw)}


def gates(c):
 reasons = []
 if c.get('authenticated_usage') is not True:
  reasons.append('AUTHENTICATED_STORAGE_SCHEMA_USAGE_MISSING')
 if c.get('service_usage') is not True:
  reasons.append('PROVIDER_SERVICE_STORAGE_SCHEMA_USAGE_MISSING')
 if c.get('schema_owner') != 'supabase_storage_admin':
  reasons.append('STORAGE_SCHEMA_OWNER_MISMATCH')
 if c.get('authenticated_restricted') is not True or c.get('service_restricted') is not True:
  reasons.append('ROLE_RESTRICTION_UNKNOWN_OR_MISMATCH')
 tables = c.get('tables', [])
 if sorted(x.get('name', '') for x in tables) != ['buckets', 'objects']:
  reasons.append('STORAGE_TABLE_INVENTORY_UNKNOWN')
 for table in tables:
  if table.get('owner') != 'supabase_storage_admin' or table.get('rls') is not True:
   reasons.append('STORAGE_TABLE_OWNER_OR_RLS_MISMATCH')
  if any(table.get(k) is not True for k in ('authenticated_select', 'authenticated_insert', 'authenticated_update')):
   reasons.append('TABLE_PRIVILEGE_MISSING')
 # A later fixture implementation must review any newly present policy. No blind additive RLS.
 if c.get('policy_count') != 0:
  reasons.append('EXISTING_STORAGE_POLICY_REQUIRES_SCOPE_REVIEW')
 if c.get('bucket_count') != 0 or c.get('object_count') != 0:
  reasons.append('STORAGE_BASELINE_CHANGED_REQUIRES_CUSTODY_REVIEW')
 return reasons


def main():
 need(len(sys.argv) == 1, 'ARGUMENTS_DENIED')
 base = HERE.parent / 'functional-dev-stack-v1'
 for name, pin in SEALED.items():
  need(sha(safe_bytes(base / name)) == pin, 'SEALED_STACK_DRIFT')
 # Existing helper is imported only after its exact source identity was checked.
 spec = importlib.util.spec_from_file_location('owned_stack15', base / 'stack.py')
 stack = importlib.util.module_from_spec(spec)
 spec.loader.exec_module(stack)
 secrets, _ = stack.state()
 services = {}
 for service in ('pg', 'auth', 'rest', 'storage', 'gateway'):
  cid, obj = stack.cid(service)
  need(obj['State']['Running'], 'SERVICE_NOT_RUNNING')
  if service == 'storage':
   need(obj['Config']['Image'] == IMAGE, 'IMAGE_DRIFT')
  services[service] = {'cid': cid, 'image_id': obj['Image'], 'started': obj['State']['StartedAt']}
 # Exclusive run path: rerun cannot overwrite a receipt or silently retry a prior attempt.
 need(PRIVATE.parent.resolve() == PRIVATE.parent and not PRIVATE.parent.is_symlink(), 'PRIVATE_PARENT_ALIAS')
 need(PRIVATE.parent.stat().st_uid == os.getuid() and PRIVATE.parent.stat().st_mode & 0o077 == 0, 'PRIVATE_PARENT_CUSTODY')
 PRIVATE.mkdir(mode=0o700)
 start = datetime.datetime.now(datetime.timezone.utc).isoformat()
 write(PRIVATE / 'attempt.json', {'started_utc': start, 'effects': 'READ_ONLY_PREFLIGHT'})
 write(PRIVATE / 'services.before.json', services)
 sdk = subprocess.run(['node', str(HERE / 'sdk-load.cjs')],
  input=json.dumps({'anon_key': secrets['anon_key']}).encode(), capture_output=True,
  timeout=20, env=stack.env())
 need(sdk.returncode == 0, 'SDK_LOAD_FAILED')
 sdk_data = json.loads(sdk.stdout)
 need(sdk_data['fetch_attempts'] == 0 and sdk_data['session'] == 'NOT_CREATED', 'UNEXPECTED_SDK_EFFECT')
 sdk_identity = write(PRIVATE / 'sdk-load.json', sdk_data)
 query = safe_bytes(HERE / 'catalog-preflight.sql')
 before_query = datetime.datetime.now(datetime.timezone.utc).isoformat()
 # Fixed catalog-only SELECT, no caller-supplied SQL and no role/config mutation.
 raw = stack.sql(query)
 after_query = datetime.datetime.now(datetime.timezone.utc).isoformat()
 catalog = json.loads(raw)
 catalog_identity = write(PRIVATE / 'catalog.json', catalog)
 reasons = gates(catalog)
 after = {}
 for service in services:
  cid, obj = stack.cid(service)
  after[service] = {'cid': cid, 'image_id': obj['Image'], 'started': obj['State']['StartedAt']}
 need(services == after and stack.source_seal() == SEALED, 'POSTCHECK_DRIFT')
 receipt = {'contract': 'platform15.native-preflight.v1',
  'status': 'BLOCKED' if reasons else 'HOLD_FUNCTIONAL_FIXTURE_REVIEW_REQUIRED',
  'reasons': reasons, 'query': {'bytes': len(query), 'sha256': sha(query),
   'started_utc': before_query, 'completed_utc': after_query},
  'sdk_identity': sdk_identity, 'catalog_identity': catalog_identity,
  'service_identity_unchanged': True, 'five_sealed_unchanged': True,
  'new_sessions': 0, 'new_buckets': 0, 'new_policies': 0,
  'cleanup': 'NOT_REQUIRED_NO_RUN_RESOURCES_CREATED',
  'native_stages': {k: 'NOT_RUN' for k in ('real_session', 'bucket_provision', 'upload', 'info',
   'download_bytes', 'duplicate_denial', 'overwrite_denial', 'foreign_denial', 'anonymous_denial', 'native_cleanup')},
  'finished_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
 write(PRIVATE / 'receipt.json', receipt)
 print(json.dumps({'status': receipt['status'], 'reasons': reasons,
  'native_storage': 'NOT_RUN', 'mutations': 0, 'cleanup': receipt['cleanup']}))
 return 2


if __name__ == '__main__':
 try:
  sys.exit(main())
 except (RuntimeError, OSError, ValueError, subprocess.SubprocessError):
  print('PREFLIGHT_FAILED_OR_UNKNOWN_NO_NATIVE_DISPATCH', file=sys.stderr)
  sys.exit(1)
