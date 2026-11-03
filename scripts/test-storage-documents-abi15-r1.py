"""New R1 source/admission/SQL-plan tests; no Docker, PG parser, Auth or SQL."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import contextlib
import io
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent / 'storage-documents-native-abi-r1'
sys.path.insert(0, str(HERE))
import plan
import audit
import harness


def synthetic_catalog():
 names = ['buckets','objects','buckets_analytics','iceberg_namespaces','iceberg_tables',
  's3_multipart_uploads','s3_multipart_uploads_parts','buckets_vectors','vector_indexes','migrations']
 relations = []
 for i, n in enumerate(names):
  grants = [{'grantee': '30', 'grantor': '40', 'privilege_type': p, 'is_grantable': False}
   for p in (['SELECT','INSERT','UPDATE','DELETE',*plan.NON_DML] if i < 7 else ['SELECT'])]
  relations.append({'name': n, 'oid': str(100+i), 'owner': '40', 'kind': 'r',
   'acl': ['supabase_storage_admin=arwdDxtm/supabase_storage_admin','service_role=arwdDxtm/supabase_storage_admin'],
   'acl_expanded': grants, 'rls': True, 'force_rls': False, 'policies': None, 'columns': [], 'effective': []})
 return {'relations': relations, 'functions': [{'name': n,'security_definer': False} for n in audit.FUNCTION_SCOPE],
  'default_acl': None, 'namespace': {'owner': '40', 'acl': None, 'effective_acl': []},
  'roles': [{'name': n, 'oid': str(i)} for n,i in [('anon',10),('authenticated',20),('service_role',30),('supabase_storage_admin',40)]]}


def fixture():
 return {'run': 'a'*32, 'bucket': 'platform15-'+'a'*32, 'path':'owned/fixture.png',
  'actor_a':'11111111-1111-4111-8111-111111111111','actor_b':'22222222-2222-4222-8222-222222222222'}


def request():
 return {'format':'platform15-native-execution-candidate.v2','parent':harness.PARENT,'consumer':harness.CONSUMER,
  'source_seal':'c'*64,'fixture':fixture(),'target':{'synthetic':'UNIT_TEST_ONLY'},
  'sdk_versions':{'supabase':'2.112.4','storage':'2.112.4','auth':'2.112.4'},'sql':{'acl_apply':{'sha256':'d'*64}},
  'policies':[],'harden_relations':[],'authority':None,'execution_binding':None,'deadline_seconds':360,
  'recovery_representation_gate':'NULL_TO_EXPLICIT_OWNER_ACL_REPRESENTATION_REMAINS','acl_lease':'TEST_ONLY',
  'native_status':'NOT_RUN','cleanup_followup':'TEST_ONLY','wire':'TEST_ONLY','allowed_sdk_sequence':[],
  'capture':json.loads((HERE/'contract.json').read_text())['capture'],'retention_private_days':30,'tools':{},'input_bytes':{},
  'atomic_recovery':harness.RECOVERY_CONTRACT}


class Tests(unittest.TestCase):
 def setUp(self):
  self.v=synthetic_catalog()
  self.review={'functions':[{'signature':'storage.'+n+'()','definition_sha256':'e'*64} for n in audit.FUNCTION_SCOPE]}
  self.review['actor_helper']={'signature':'auth.uid()','security_definer':False,'owner':'supabase_auth_admin',
   'owner_superuser':False,'owner_bypassrls':False,'authenticated_execute':True,
   'authenticated_auth_schema_usage':True,'definition_sha256':'f'*64}
  self.target={'system_identifier':'123','database_oid':'5'}

 def test_scope_and_no_automatic_update_policies(self):
  p=plan.render(self.v,self.review,fixture(),self.target)
  self.assertEqual(len(p['harden_relations']),7)
  self.assertEqual(len(p['policies']),7)
  self.assertTrue(all(x['command']!='UPDATE' for x in p['policies']))
  self.assertTrue(all(x['command'] not in ('INSERT','UPDATE') for x in p['policies'] if x['table']=='buckets'))
  self.assertEqual(p['sql']['acl_apply'].count(b'REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),7)
  self.assertIn(b'SET LOCAL ROLE supabase_storage_admin',p['sql']['acl_recover'])
  self.assertNotIn(b'UPDATE pg_namespace',p['sql']['acl_recover'])
  self.assertEqual(p['raw_namespace_recovery'],'NULL_TO_EXPLICIT_OWNER_ACL_REPRESENTATION_REMAINS')

 def test_foreign_actor_target_and_injection(self):
  for key,value in [('bucket','shared'),('path','../other'),('actor_a',"';DROP TABLE x;--")]:
   f=fixture();f[key]=value
   with self.assertRaises(ValueError):plan.render(self.v,self.review,f,self.target)
  with self.assertRaises(ValueError):plan.target_guard({'system_identifier':'123;','database_oid':'5'})

 def test_prestate_drift_definer_and_policy(self):
  for mutate in [lambda v:v['functions'][0].update(security_definer=True),
   lambda v:v['relations'][0].update(policies=[{'foreign':True}]),
   lambda v:v['namespace'].update(acl=['unexpected'])]:
   v=copy.deepcopy(self.v);mutate(v)
   with self.assertRaises(ValueError):plan.render(v,self.review,fixture(),self.target)

 def test_actor_helper_unknown_or_privileged_rejected(self):
  for key,value in [('security_definer',True),('owner_superuser',True),('authenticated_execute',None),('definition_sha256','bad')]:
   r=copy.deepcopy(self.review);r['actor_helper'][key]=value
   with self.assertRaises(ValueError):plan.render(self.v,r,fixture(),self.target)

 def test_role_oid_is_not_historical_constant(self):
  v=copy.deepcopy(self.v)
  next(r for r in v['roles'] if r['name']=='service_role')['oid']='98765'
  for r in v['relations']:
   for a in r['acl_expanded']:a['grantee']='98765'
  p=plan.render(v,self.review,fixture(),self.target)
  self.assertEqual(len(p['harden_relations']),7)

 def test_no_request_approval_or_old_scope(self):
  v=request();raw=json.dumps(v).encode()
  with self.assertRaises(harness.AdmissionError):harness.admission(raw,{},'c'*64,lambda:1)
  v['approved']=True
  with self.assertRaises(harness.AdmissionError):harness.admission(json.dumps(v).encode(),{},'c'*64,lambda:1)
  for k,x in [('parent','bad'),('consumer','other'),('authority',True),('execution_binding',{'claimed':True})]:
   v=request();v[k]=x
   with self.assertRaises(harness.AdmissionError):harness.admission(json.dumps(v).encode(),{},'c'*64,lambda:1)

 def test_exact_review_and_expiry_ceiling(self):
  v=request();raw=json.dumps(v).encode()
  r={'source_seal':'c'*64,'review':'https://github.com/ontripai/cladora-website/issues/463#issuecomment-1',
   'single_use':True,'expires_at':100,'target_sha256':audit.fingerprint(v['target']),
   'acl_delta_sha256':'d'*64,'acl_recovery':'ACCEPT_EFFECTIVE_GRANTOR_RECOVERY_WITH_RAW_NULL_REPRESENTATION_CHANGE',
   'cleanup_only_after_expiry':True}
  records={harness.digest(raw):r}
  self.assertEqual(harness.admission(raw,records,'c'*64,lambda:99)[0],v)
  for at in (100,101):
   with self.assertRaises(harness.AdmissionError):harness.admission(raw,records,'c'*64,lambda:at)
  r['acl_delta_sha256']='0'*64
  with self.assertRaises(harness.AdmissionError):harness.admission(raw,records,'c'*64,lambda:99)

 def test_recovery_poststate_privileges_and_owner_grantor(self):
  v=copy.deepcopy(self.v)
  v['namespace']['effective_acl']=[{'grantor':'40','grantee':'40','privilege_type':'USAGE','is_grantable':False}]
  after=harness.expected_post(v,[r['name'] for r in v['relations'][:7]])
  for r in after['relations'][:7]:
   self.assertFalse(any(a['privilege_type'] in plan.NON_DML for a in r['acl_expanded']))
  self.assertEqual(after['namespace']['effective_acl'][-1]['grantor'],'40')
  self.assertIsNotNone(after['namespace']['acl'])

 def test_png_and_fixed_payloads(self):
  a,b=harness.png(0),harness.png(255)
  self.assertEqual(a[:8],b'\x89PNG\r\n\x1a\n')
  self.assertLess(len(a),4096)
  self.assertNotEqual(a,b)
  p=plan.render(self.v,self.review,fixture(),self.target)
  for name,b in p['sql'].items():
   if name in ('acl_apply','fixture_create','fixture_drop_policies'):
    self.assertTrue(b.startswith(b'BEGIN;') and b.endswith(b'COMMIT;\n'))
   elif name=='acl_recover':
    self.assertNotIn(b'BEGIN;',b);self.assertNotIn(b'COMMIT;',b)
   self.assertNotRegex(b.decode(),r'\bCREATE\s+\w+\s+IF\s+NOT\s+EXISTS\b')
   self.assertNotIn(b'BYPASSRLS',b)
  self.assertNotIn(b'DELETE FROM',p['sql']['fixture_drop_policies'])

 def test_clock_expiry_during_gate_blocks_before_effect(self):
  r=harness.Run.__new__(harness.Run)
  r.raw=b'unit-only';r.review={'expires_at':100};r.v={'source_seal':'s','tools':{},'target':{'services':{},'instance':'unit'}}
  r.deadline=float('inf');r.stack=SimpleNamespace(state=lambda:(None,{'instance':'unit'}))
  clock=[99]
  def slow_pin_check():clock[0]=100
  with patch.object(harness,'seal',return_value='s'),patch.object(harness,'sdk_gate',side_effect=slow_pin_check),\
   patch.object(harness,'tools',return_value={}),patch.object(harness,'service_identity',return_value={}),\
   patch.object(harness,'json_read',return_value={'reviews':{harness.digest(r.raw):r.review}}),patch.object(harness,'provider_roles'),patch.object(harness.time,'time',side_effect=lambda:clock[0]):
   with self.assertRaises(harness.AdmissionError):r.gate(False)
   r.gate(True)  # same exact cleanup scope may settle; no normal permit extension

 def test_primary_error_survives_recovery_failure(self):
  r=harness.Run.__new__(harness.Run)
  r.r={'primary_error':None,'cleanup':{},'stages':{},'native':'NOT_RUN'}
  r.original={'unit':'baseline'};r.v={'harden_relations':[]}
  def catalog(phase,*_):
   if phase=='prestate':return r.original
   if phase=='acl-poststate':raise RuntimeError('PRIMARY_METADATA_DRIFT')
   raise RuntimeError('LATER_CLEANUP_UNKNOWN')
  r.catalog=catalog;r.files=lambda _: {'files':0,'dirs':0}
  r.sql=lambda stage,*_,**__: {'rows':[{'unit':'helper'}]} if stage=='actor-helper-prestate' else None
  r.material=lambda _: b'UNIT_NOT_SQL'
  r.save=lambda _: None
  with patch.object(harness,'json_read',return_value={'unit':'helper'}),contextlib.redirect_stdout(io.StringIO()):r.execute()
  self.assertEqual(r.r['primary_error'],'PRIMARY_METADATA_DRIFT')
  self.assertEqual(r.r['cleanup']['acl'],'FAILED_OR_UNKNOWN')
  self.assertEqual(r.r['status'],'FAILED_OR_UNKNOWN')

 def test_recomputed_hash_cannot_admit_arbitrary_sql(self):
  b=b'UNIT_SOURCE_NOT_EXECUTED'
  p={'sql':{'fixed':b},'policies':[],'harden_relations':[],'atomic_recovery':harness.RECOVERY_CONTRACT}
  r={'sql':{'fixed':{'bytes':len(b),'sha256':harness.digest(b)}},'policies':[],'harden_relations':[],
   'atomic_recovery':harness.RECOVERY_CONTRACT}
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'fixed.sql').write_bytes(b)
   harness.verify_materials(r,p,root)
   malicious=b'OTHER_UNIT_BYTES_NOT_SQL';(root/'fixed.sql').write_bytes(malicious)
   r['sql']['fixed']={'bytes':len(malicious),'sha256':harness.digest(malicious)}
   with self.assertRaises(harness.AdmissionError):harness.verify_materials(r,p,root)


if __name__=='__main__':unittest.main()
