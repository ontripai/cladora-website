"""Affected R2 controls only. In-memory protocol/catalog model, NEVER PostgreSQL.

The before case calls the exact R1 Run.execute source at the fixed Git base.
The after case calls current Run.execute and AtomicRecovery with modeled SQL
boundaries. Neither fake locks nor fake ACKs count as Engine/native evidence.
"""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import types
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'scripts/storage-documents-native-abi-r1'
sys.path.insert(0, str(HERE))
import harness
import plan
import recovery
from audit import fingerprint

BASE = 'a8ccef2b537f8b3e2b393c16686f41afed64a75a'
spec = importlib.util.spec_from_file_location('r1_helpers_not_suite', ROOT/'scripts/test-storage-documents-abi15-r1.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)  # define helpers; accepted test suite NOT run


def inputs():
 v = helpers.synthetic_catalog()
 v['namespace']['effective_acl'] = [
  {'grantor': 40, 'grantee': 40, 'privilege_type': p, 'is_grantable': False} for p in ('USAGE','CREATE')]
 for rel in v['relations']:
  rel['effective'] = [{'role': role, 'usage': False} for role in ('authenticated','service_role')]
 review = {'functions': [{'signature': 'storage.'+n+'()', 'definition_sha256': 'e'*64} for n in helpers.audit.FUNCTION_SCOPE],
  'actor_helper': {'signature': 'auth.uid()', 'security_definer': False, 'owner': 'supabase_auth_admin',
   'owner_superuser': False, 'owner_bypassrls': False, 'authenticated_execute': True,
   'authenticated_auth_schema_usage': True, 'definition_sha256': 'f'*64}}
 target = {'system_identifier':'123','database_oid':'5'}
 p = plan.render(v, review, helpers.fixture(), target)
 return v, p, target


def independent_restore(v):
 """Model standard recovery statements, NOT a copy of candidate expected output."""
 for rel in v['relations']:
  if rel['name'] in {'buckets','buckets_analytics','iceberg_namespaces','iceberg_tables','objects',
   's3_multipart_uploads','s3_multipart_uploads_parts'}:
   rel['acl'] = [a.replace('service_role=arwd/', 'service_role=arwdDxtm/') for a in rel['acl']]
   rel['acl_expanded'] += [{'grantee':'30','grantor':'40','privilege_type':p,'is_grantable':False}
    for p in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')]
  for e in rel['effective']:
   if e['role'] in ('authenticated','service_role'): e['usage'] = False
 v['namespace']['acl'] = ['supabase_storage_admin=UC/supabase_storage_admin']
 v['namespace']['effective_acl'] = [a for a in v['namespace']['effective_acl'] if str(a['grantee']) not in ('20','30')]


class Model:
 def __init__(self):
  self.original, self.plan, self.target = inputs()
  self.current = harness.expected_post(self.original, self.plan['harden_relations'])
  self.tx = None; self.locked = False; self.queued = []; self.sent = []; self.effects = 0
  self.on = lambda _: None

 def external(self, mutate):
  if self.locked: self.queued.append(mutate)
  else: mutate(self.current)

 def release(self):
  self.locked = False
  for mutate in self.queued: mutate(self.current)
  self.queued.clear()

 def wire(self):
  return ModeledWire(self)


class ModeledWire:
 def __init__(self, model):
  self.model = model; self.pid = 700; self.idle = 'I'; self.quarantined = False
  self.chain = '0'*64; self.deadline = 0; self.pending = None; self.closed = False

 def identity(self, gate):
  gate()
  return {**self.model.target, 'version':170011, 'pid':self.pid, 'database':'postgres',
   'user':'postgres','session_user':'postgres','xid':None}

 def send(self, frame):
  assert frame[:1] == b'Q' and struct.unpack('!I', frame[1:5])[0] == len(frame)-1 and frame[-1:] == b'\0'
  payload = frame[5:-1]
  name = next(k for k,v in self.model.plan['sql'].items() if v == payload)
  self.model.sent.append(name); self.pending = name
  self.model.on('send-'+name)

 def drain(self):
  m=self.model; name=self.pending; rows=[]; errors=[]
  if name == 'recovery_begin':
   m.locked=True; m.tx=copy.deepcopy(m.current)
   tags=['BEGIN','SET','SET','SET','LOCK TABLE']; self.idle='T'
  elif name == 'recovery_state':
   rows=[copy.deepcopy(m.tx)]; tags=['SELECT 1']
  elif name == 'acl_recover':
   independent_restore(m.tx); m.effects+=1
   tags=['DO','DO','SET','REVOKE','REVOKE',*(['GRANT']*7),'RESET']
  elif name == 'recovery_commit':
   m.current=copy.deepcopy(m.tx); m.tx=None; m.release(); self.idle='I'; tags=['COMMIT']
  else: raise AssertionError(name)
  m.on('drain-'+name)
  self.chain = harness.digest((self.chain+name).encode())
  return {'pid':self.pid,'tags':tags,'rows':rows,'errors':errors,'ready':self.idle,'chain':self.chain}

 def rollback_known(self):
  if self.quarantined or self.idle not in ('T','E'):
   return {'state':'skipped','reason':'no_known_open_transaction'}
  self.model.tx=None; self.model.release(); self.idle='I'
  return {'state':'acknowledged','terminal':{'pid':self.pid,'tags':['ROLLBACK'],'ready':'I','errors':[]}}

 def close(self):
  self.closed=True


def transaction(model, clock=None, gate=lambda:None, persist=lambda _:None):
 before=copy.deepcopy(model.current)
 after=copy.deepcopy(model.original)
 after['namespace']['acl']=['supabase_storage_admin=UC/supabase_storage_admin']
 for a,b in zip(after['relations'],before['relations']): a['policies']=copy.deepcopy(b['policies'])
 wire=model.wire()
 args={} if clock is None else {'clock':lambda:clock[0]}
 return recovery.AtomicRecovery(wire, lambda n:model.plan['sql'][n], gate, persist, before, after, **args)


def drive_execute(module, drift, configure=lambda _m,_r:None):
 """Actual Run.execute, modeled boundaries only. No Run.__init__/native effects."""
 m=Model(); m.current=copy.deepcopy(m.original)
 r=module.Run.__new__(module.Run)
 r.original=copy.deepcopy(m.original); r.plan=m.plan
 r.v={'target':{'services':{'pg':{'cid':'MODEL_ONLY'}},**m.target},
  'harden_relations':m.plan['harden_relations'], 'policies':m.plan['policies']}
 r.fixture=helpers.fixture(); r.out=Path('/NONEXISTENT_MODEL_ONLY')
 r.stack=types.SimpleNamespace(DOCKER=[],env=lambda:{})
 r.r={'primary_error':None,'cleanup':{},'stages':{},'native':'NOT_RUN'}
 r.expected_catalog=r.original
 r.save=lambda _:None; r.gate=lambda *_:None
 r.material=lambda n:m.plan['sql'][n]
 r.files=lambda _: {'files':0,'dirs':0}
 r.resource_observer=lambda:{'buckets':0,'objects':0}
 r.worker=lambda:{'first_error':None,'unknown':False}
 def catalog(phase,*_):
  result=copy.deepcopy(m.current)
  if phase=='recovery-observer':
   r.r['stages'][phase]={'physical_identity':{**m.target,'pid':701,'database':'postgres','version':170011}}
  if phase=='recovery-prestate': drift(m.current)  # old snapshot already returned logically
  if phase=='cleanup-catalog' and module is harness:
   # equivalent changed prestate, before new same-connection barrier
   drift(m.current)
  return result
 def sql(stage,*_,**__):
  if stage=='actor-helper-prestate': return {'rows':[{'model':'helper'}]}
  if stage=='acl-apply': m.current=harness.expected_post(m.current,m.plan['harden_relations'])
  elif stage=='fixture-create':
   for p in m.plan['policies']:
    next(x for x in m.current['relations'] if x['name']==p['table'])['policies'] = [
     *(next(x for x in m.current['relations'] if x['name']==p['table'])['policies'] or []),p]
  elif stage=='fixture-policies-drop':
   for rel in m.current['relations']: rel['policies']=None
  elif stage=='acl-recover': independent_restore(m.current); m.effects+=1
 r.catalog=catalog; r.sql=sql
 configure(m,r)
 with patch.object(module,'json_read',return_value={'model':'helper'}),\
  patch.object(harness,'Wire',side_effect=lambda *_:m.wire()),contextlib.redirect_stdout(io.StringIO()):
  r.execute()
 return r.r,m


class RecoveryTests(unittest.TestCase):
 def test_01_preserved_before_actual_r1_execute_counterexample(self):
  source=subprocess.run(['git','show',BASE+':scripts/storage-documents-native-abi-r1/harness.py'],cwd=ROOT,
   capture_output=True,check=True).stdout
  self.assertEqual(harness.digest(source),'a32774e9a518fdbdac4af2657b3bdbf206976cbad078a83f74c76dfb82b027d9')
  old=types.ModuleType('exact_r1_counterexample');old.__file__=str(HERE/'harness.py')
  exec(compile(source,old.__file__,'exec'),old.__dict__)
  drift=lambda v:v['relations'][0]['acl'].append('foreign=r/supabase_storage_admin')
  receipt,m=drive_execute(old,drift)
  self.assertEqual(m.effects,1)  # F01: applied before observer found drift; NOT false PASS
  self.assertEqual(receipt['status'],'FAILED_OR_UNKNOWN')
  self.assertEqual(receipt['cleanup']['acl'],'FAILED_OR_UNKNOWN')
  self.assertEqual(receipt['primary_error'],'EFFECTIVE_ACL_GRANTOR_RECOVERY_MISMATCH')

 def test_02_after_actual_execute_rejects_same_drift_before_effect(self):
  receipt,m=drive_execute(harness,lambda v:v['relations'][0]['acl'].append('foreign=r/supabase_storage_admin'))
  self.assertEqual(m.effects,0)
  self.assertNotIn('acl_recover',m.sent)
  self.assertEqual(receipt['cleanup']['atomic_recovery']['rollback']['state'],'acknowledged')
  self.assertEqual(receipt['primary_error'],'RECOVERY-PRESTATE_MISMATCH')

 def test_03_before_lock_every_drift_dimension_rejected(self):
  changes={
   'privilege':lambda v:v['relations'][0]['acl_expanded'].append({'privilege_type':'TRUNCATE','grantee':'99'}),
   'grantor':lambda v:v['relations'][0]['acl_expanded'][0].update(grantor='99'),
   'option':lambda v:v['relations'][0]['acl_expanded'][0].update(is_grantable=True),
   'owner':lambda v:v['relations'][0].update(owner='99'),
   'policy':lambda v:v['relations'][0].update(policies=[{'name':'foreign','using':'true'}]),
   'membership':lambda v:v.update(membership=[{'member':'service_role','role':'foreign','set':True}]),
   'namespace':lambda v:v['namespace']['effective_acl'][0].update(is_grantable=True),
   'function':lambda v:v['functions'][0].update(acl=['foreign=X/owner']),
   'default_acl':lambda v:v.update(default_acl=[{'acl':['foreign=r/owner']}]),
  }
  for name,mutate in changes.items():
   with self.subTest(name=name):
    m=Model(); tx=transaction(m); mutate(m.current); changed=fingerprint(m.current)
    with self.assertRaisesRegex(recovery.RecoveryError,'RECOVERY-PRESTATE_MISMATCH'): tx.run()
    self.assertEqual(m.effects,0);self.assertEqual(fingerprint(m.current),changed)
    self.assertEqual(tx.receipt['rollback']['state'],'acknowledged')

 def test_04_positive_exact_prestate_and_effective_grantor_options(self):
  for retain in (False,True):
   with self.subTest(retained_policies=retain):
    m=Model()
    if retain:
     for p in m.plan['policies']:
      rel=next(x for x in m.current['relations'] if x['name']==p['table'])
      rel['policies']=[*(rel['policies'] or []),copy.deepcopy(p)]
    tx=transaction(m); before=copy.deepcopy(m.current); result=tx.run()
    self.assertEqual(result['commit'],'ACKNOWLEDGED_COMMAND_COMPLETE_IDLE')
    self.assertEqual(m.effects,1); self.assertEqual(m.sent,recovery.CONTRACT['phases'])
    expected=copy.deepcopy(m.original); expected['namespace']['acl']=['supabase_storage_admin=UC/supabase_storage_admin']
    for a,b in zip(expected['relations'],before['relations']):a['policies']=b['policies']
    self.assertEqual(fingerprint(m.current),fingerprint(expected))
    self.assertIsNone(m.original['namespace']['acl']);self.assertIsNotNone(m.current['namespace']['acl'])

 def test_05_writer_after_barrier_waits_until_release_and_is_not_overwritten(self):
  m=Model();tx=transaction(m)
  def hook(phase):
   if phase=='drain-recovery_begin':m.external(lambda v:v['relations'][0]['acl'].append('later=r/owner'))
  m.on=hook; tx.run()
  self.assertIn('later=r/owner',m.current['relations'][0]['acl'])
  self.assertFalse(m.locked);self.assertEqual(m.effects,1)
  # Independent observer MUST notice this post-commit writer; no global lease proof inferred.
  self.assertNotEqual(fingerprint(m.current),fingerprint(tx.poststate))

 def test_06_postcondition_fault_rolls_back_entire_owned_transaction(self):
  for field in ('acl','owner','policies'):
   with self.subTest(field=field):
    m=Model();tx=transaction(m);before=fingerprint(m.current)
    def hook(phase):
     if phase=='drain-acl_recover':m.tx['relations'][0][field]='MODELED_UNEXPECTED_MUTATION'
    m.on=hook
    with self.assertRaisesRegex(recovery.RecoveryError,'RECOVERY-POSTSTATE_MISMATCH'):tx.run()
    self.assertEqual(fingerprint(m.current),before)
    self.assertNotIn('recovery_commit',m.sent)
    self.assertEqual(tx.receipt['rollback']['state'],'acknowledged')

 def test_07_lock_wait_timeout_and_deadlock_have_no_effect_no_retry(self):
  for error in ('55P03','40P01'):
   with self.subTest(sqlstate=error):
    m=Model();tx=transaction(m);wire=tx.wire
    def drain():
     wire.idle='E'
     return {'pid':700,'tags':['BEGIN','SET','SET','SET'],'ready':'E','errors':[error],'rows':[],'chain':'a'*64}
    wire.drain=drain
    with self.assertRaisesRegex(recovery.RecoveryError,'RECOVERY_SQL_ERROR_'+error):tx.run()
    self.assertEqual(m.sent,['recovery_begin']);self.assertEqual(m.effects,0)
    self.assertEqual(tx.receipt['rollback']['state'],'acknowledged')

 def test_08_hard_expiry_equal_and_after_gate_or_durable_intent(self):
  for point in ('initial','gate','intent','before-commit'):
   with self.subTest(point=point):
    m=Model();clock=[0]
    def gate():
     if point=='gate':clock[0]=20
    def persist(value):
     if point=='intent' and value['event']=='locked-begin-intent':clock[0]=20
     if point=='before-commit' and value['event']=='recovery-commit-intent':clock[0]=20
    tx=transaction(m,clock,gate,persist)
    if point=='initial':clock[0]=20
    with self.assertRaisesRegex(recovery.RecoveryError,'RECOVERY_WINDOW_EXPIRED'):tx.run()
    self.assertNotIn('recovery_commit',m.sent)
    if point!='before-commit':self.assertEqual(m.sent,[])
    else:self.assertEqual(tx.receipt['rollback']['state'],'acknowledged')

 def test_09_revocation_during_poststate_persistence_blocks_commit(self):
  m=Model();revoked=[False]
  def persist(v):
   if v['event']=='recovery-poststate-terminal':revoked[0]=True
  def gate():
   if revoked[0]:raise RuntimeError('REVIEW_REVOKED')
  tx=transaction(m,gate=gate,persist=persist); before=fingerprint(m.current)
  with self.assertRaisesRegex(RuntimeError,'REVIEW_REVOKED'):tx.run()
  self.assertEqual(fingerprint(m.current),before);self.assertNotIn('recovery_commit',m.sent)

 def test_10_unknown_ack_or_backend_never_rollback_or_replay(self):
  for fault in ('stream','pid','tag','ready'):
   with self.subTest(fault=fault):
    m=Model();tx=transaction(m);wire=tx.wire;real=wire.drain
    def drain():
     value=real()
     if wire.pending=='acl_recover':
      if fault=='stream':wire.quarantined=True;raise RuntimeError('UNKNOWN_STREAM_ENDED')
      if fault=='pid':value['pid']=701
      if fault=='tag':value['tags']=['UNKNOWN']
      if fault=='ready':value['ready']='I'
     return value
    wire.drain=drain
    with self.assertRaises(Exception):tx.run()
    self.assertEqual(tx.receipt['rollback']['state'],'unknown')
    self.assertNotIn('recovery_commit',m.sent);self.assertEqual(m.sent.count('acl_recover'),1)

 def test_11_commit_ack_after_window_does_not_infer_outcome_from_expiry(self):
  m=Model();clock=[0];tx=transaction(m,clock)
  def hook(phase):
   if phase=='drain-recovery_commit':clock[0]=21
  m.on=hook;tx.run()
  self.assertEqual(tx.receipt['commit'],'ACKNOWLEDGED_COMMAND_COMPLETE_IDLE')

 def test_12_commit_lost_ack_stays_unknown_no_replay(self):
  m=Model();tx=transaction(m);wire=tx.wire;real=wire.drain
  def drain():
   value=real()
   if wire.pending=='recovery_commit':wire.quarantined=True;raise RuntimeError('UNKNOWN_COMMIT_ACK')
   return value
  wire.drain=drain
  with self.assertRaisesRegex(RuntimeError,'UNKNOWN_COMMIT_ACK'):tx.run()
  self.assertEqual(tx.receipt['commit'],'DISPATCHED_ACK_UNKNOWN')
  self.assertEqual(tx.receipt['rollback']['state'],'unknown')
  self.assertEqual(m.sent.count('recovery_commit'),1)

 def test_13_durable_persistence_failure_preserves_primary_and_known_rollback(self):
  m=Model();tx=transaction(m,persist=lambda _:None);before=fingerprint(m.current)
  def persist(v):
   if v['event'] in ('recovery-body-terminal','recovery-failed-settlement'):raise RuntimeError('PRIVATE_FSYNC_FAILURE')
  tx.persist=persist
  with self.assertRaisesRegex(RuntimeError,'PRIVATE_FSYNC_FAILURE'):tx.run()
  self.assertEqual(fingerprint(m.current),before)
  self.assertEqual(tx.receipt['first_error'],'PRIVATE_FSYNC_FAILURE')
  self.assertEqual(tx.receipt['rollback']['state'],'acknowledged')

 def test_14_original_guards_and_read_committed_barrier_materials(self):
  m=Model();sql=m.plan['sql']
  self.assertEqual(sql['recovery_state'],(HERE/'catalog-review.sql').read_bytes())
  self.assertIn(b'BEGIN ISOLATION LEVEL READ COMMITTED;',sql['recovery_begin'])
  self.assertIn(b' IN SHARE ROW EXCLUSIVE MODE;',sql['recovery_begin'])
  for c in recovery.CATALOGS:self.assertIn(('pg_catalog.'+c).encode(),sql['recovery_begin'])
  self.assertIn(b'p15_foreign_target',sql['acl_recover'])
  self.assertIn(b'p15_definition_drift',sql['acl_recover'])
  self.assertIn(b'p15_actor_helper_drift',sql['acl_recover'])
  self.assertNotIn(b'COMMIT',sql['acl_recover'])
  self.assertIn(b'RESET ROLE;',sql['acl_recover'])
  for payload in sql.values():self.assertLessEqual(len(payload)+6,12288)
  self.assertEqual(json.loads((HERE/'contract.json').read_text())['atomic_recovery'],recovery.CONTRACT)

 def test_15_positive_actual_execute_and_close_unknown_not_success(self):
  result,m=drive_execute(harness,lambda _:None)
  self.assertEqual(result['cleanup']['acl'],'EFFECTIVE_PRIVILEGES_AND_GRANTORS_RESTORED_RAW_NULL_REPRESENTATION_CHANGED')
  self.assertFalse(result['cleanup']['namespace_raw_null_restored'])
  self.assertIsNone(result['primary_error']);self.assertEqual(m.effects,1)
  original_close=ModeledWire.close
  def fail_close(wire):
   original_close(wire)
   raise RuntimeError('MODELED_CLOSE_TIMEOUT')
  with patch.object(ModeledWire,'close',fail_close):result,m=drive_execute(harness,lambda _:None)
  self.assertEqual(result['status'],'FAILED_OR_UNKNOWN')
  self.assertEqual(result['primary_error'],'ATOMIC_RECOVERY_RELAY_CLOSE_UNKNOWN')
  self.assertEqual(result['cleanup']['atomic_recovery']['close']['state'],'unknown')

 def test_16_standalone_recovery_bypass_and_wrong_target_rejected(self):
  r=harness.Run.__new__(harness.Run);m=Model();r.plan=m.plan
  r.gate=lambda *_:self.fail('no gate/effect after wrong adapter entry')
  with self.assertRaisesRegex(harness.AdmissionError,'ATOMIC_RECOVERY_REQUIRES_FIXED_SAME_CONNECTION_ADAPTER'):
   r.sql('acl-recover',m.plan['sql']['acl_recover'],True,True)
  ident=ModeledWire.identity
  def foreign(wire,gate):
   value=ident(wire,gate);value['database_oid']='999';return value
  with patch.object(ModeledWire,'identity',foreign):receipt,m=drive_execute(harness,lambda _:None)
  self.assertEqual(m.effects,0);self.assertEqual(m.sent,[])
  self.assertEqual(receipt['primary_error'],'PHYSICAL_DATABASE_MISMATCH')

 def test_17_primary_native_error_survives_recovery_drift(self):
  def configure(_m,r):r.worker=lambda:{'first_error':'ORIGINAL_NATIVE_ERROR','unknown':True}
  receipt,m=drive_execute(harness,lambda v:v['relations'][0].update(owner='99'),configure)
  self.assertEqual(receipt['primary_error'],'ORIGINAL_NATIVE_ERROR');self.assertEqual(m.effects,0)
  self.assertEqual(receipt['cleanup']['acl'],'FAILED_OR_UNKNOWN')

 def test_18_independent_observer_detects_postcommit_writer_no_recovery_retry(self):
  def configure(m,_r):
   def hook(phase):
    if phase=='drain-recovery_commit':m.external(lambda v:v['relations'][0].update(owner='99'))
   m.on=hook
  receipt,m=drive_execute(harness,lambda _:None,configure)
  self.assertEqual(receipt['primary_error'],'EFFECTIVE_ACL_GRANTOR_RECOVERY_MISMATCH')
  self.assertEqual(receipt['status'],'FAILED_OR_UNKNOWN');self.assertEqual(m.effects,1)
  self.assertEqual(m.sent.count('recovery_commit'),1)

 def test_19_independent_observer_same_pid_or_foreign_database_rejected(self):
  for key,value in (('pid',700),('database_oid','999'),('system_identifier','999')):
   with self.subTest(key=key):
    def configure(_m,r):
     original=r.catalog
     def catalog(phase,*args):
      result=original(phase,*args)
      if phase=='recovery-observer':r.r['stages'][phase]['physical_identity'][key]=value
      return result
     r.catalog=catalog
    receipt,m=drive_execute(harness,lambda _:None,configure)
    self.assertEqual(receipt['primary_error'],'RECOVERY_INDEPENDENT_OBSERVER_IDENTITY')
    self.assertEqual(receipt['status'],'FAILED_OR_UNKNOWN');self.assertEqual(m.effects,1)


if __name__=='__main__':unittest.main(verbosity=2)
