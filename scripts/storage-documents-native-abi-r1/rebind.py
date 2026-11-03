#!/usr/bin/env python3
"""Offline R2 materialization from the frozen, never-executed R1 candidate.

No Docker command, target inspection, credential read, SQL or provider operation.
Target values remain declared expected pins; they need fresh live admission in a
separately authorized native attempt. No arguments select a file/SQL/target.
"""
import copy
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import harness as h

R1_REQUEST = {'bytes': 6177, 'sha256': '6bdfe4ab4504dd39fd41f1bf434d103ec2c01c0ae0f071d79c4a93def4d2339c'}
R1_SEAL = '25c7181f417248b7bf31b0cfda7492809c11125a937c27a3ab2b9f4d65ff7a5c'


def predecessor(directory):
 raw = h.read(directory/'execution-request.json')
 h.need({'bytes':len(raw),'sha256':h.digest(raw)} == R1_REQUEST, 'EXACT_FROZEN_R1_REQUEST_REQUIRED')
 v = json.loads(raw, object_pairs_hook=h.unique_object)
 h.need(v['source_seal'] == R1_SEAL and v['authority'] is None and v['execution_binding'] is None
  and v['native_status'] == 'NOT_RUN' and v['format'] == 'platform15-native-execution-candidate.v1', 'R1_NOT_UNEXECUTED')
 h.need(not (h.PRIVATE/('run-'+v['fixture']['run'])).exists(), 'R1_ATTEMPT_ALREADY_CLAIMED')
 for stage,pin in v['sql'].items():
  b = h.read(directory/(stage+'.sql'))
  h.need({'bytes':len(b),'sha256':h.digest(b)} == pin, 'R1_MATERIAL_DRIFT')
 return v


def candidate(old):
 h.sdk_gate()  # cached bytes only, no module load/install/connection
 h.need(h.tools() == old['tools'], 'EXISTING_TOOL_PIN_DRIFT')
 original = h.json_read(h.PRIVATE/'catalog.private.json')
 review = h.json_read(h.ROOT/'docs/testing/platform-storage-documents-native-abi-15.r1.acl-review.json')
 h.need(h.fingerprint(original) == review['private_snapshot_sha256'], 'PRIVATE_BASELINE_DRIFT')
 review['actor_helper'] = h.json_read(h.ROOT/'docs/testing/platform-storage-documents-native-abi-15.r1.actor-helper.json')
 v = copy.deepcopy(old)
 run = h.digest(('PLATFORM-STORAGE-ACL-RECOVERY-RACE-R2:'+R1_REQUEST['sha256']).encode())[:32]
 v['fixture'].update(run=run,bucket='platform15-'+run)
 h.need(not (h.PRIVATE/('run-'+run)).exists(), 'R2_ATTEMPT_ALREADY_CLAIMED')
 planned = h.render(original,review,v['fixture'],{k:v['target'][k] for k in ('system_identifier','database_oid')})
 v.update(format='platform15-native-execution-candidate.v2',parent=h.PARENT,source_seal=h.seal(),
  atomic_recovery=h.RECOVERY_CONTRACT, policies=planned['policies'], harden_relations=planned['harden_relations'],
  sql={k:{'bytes':len(b),'sha256':h.digest(b)} for k,b in planned['sql'].items()})
 h.need(v['capture'] == h.json_read(HERE/'contract.json')['capture'], 'CAPTURE_CONTRACT_DRIFT')
 return v,planned


def put(path, raw):
 fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
 with os.fdopen(fd,'wb') as f:
  h.need(f.write(raw) == len(raw), 'MATERIAL_SHORT_WRITE'); f.flush(); os.fsync(f.fileno())


def main():
 h.need(len(sys.argv)==2 and sys.argv[1] in ('--materialize','--verify'), 'FIXED_OFFLINE_MODE')
 current=h.PRIVATE/'candidate'; archive=h.PRIVATE/'candidate-r1-preserved'
 if sys.argv[1]=='--materialize':
  if archive.exists():
   h.need(not current.exists(), 'CANDIDATE_ALREADY_EXISTS_NO_REPLACEMENT')
   old=predecessor(archive)
  else:
   old=predecessor(current)
  v,planned=candidate(old)
  if not archive.exists():
   current.rename(archive)  # preserve exact five predecessor files, never overwrite
  current.mkdir(mode=0o700)
  for stage,raw in planned['sql'].items():put(current/(stage+'.sql'),raw)
  put(current/'execution-request.json',(json.dumps(v,indent=2)+'\n').encode())
 old=predecessor(archive)
 v,planned=candidate(old)
 raw=h.read(current/'execution-request.json')
 h.need(raw==(json.dumps(v,indent=2)+'\n').encode(), 'REQUEST_NOT_EXACT_RECONSTRUCTION')
 h.verify_materials(v,planned,current)
 h.need(h.json_read(h.REGISTRY)=={'format':'platform15-curated-native-reviews.v1','reviews':{}}, 'REVIEW_REGISTRY_NOT_EMPTY')
 print(json.dumps({'mode':'OFFLINE_RECONSTRUCTED_MATCH','request_bytes':len(raw),'request_sha256':h.digest(raw),
  'source_seal':v['source_seal'],'sql_count':len(v['sql']),'predecessor':'PRESERVED_NOT_RUN',
  'target_pins':'DECLARED_NOT_FRESHLY_OBSERVED','authority':None,'execution_binding':None,'native':'NOT_RUN'}))


if __name__=='__main__':
 try:main()
 except Exception as error:
  print('HOLD:'+type(error).__name__,file=sys.stderr)
  sys.exit(2)
