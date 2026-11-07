"""Affected Platform17 controls only; no Docker/PG/Auth/SQL in these tests."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import lane


class Tests(unittest.TestCase):
 def stale_fixture(self, directory, pid=2147483647, source=None):
  root=Path(directory);seal={'stack.py':'synthetic source pin'}
  lane.write(root/'gateway-process.json',{'pid':pid,'source_seal':source or seal})
  return SimpleNamespace(PRIVATE=root,source_seal=lambda:seal)

 def test_resume_stale_record_positive_preserves_exact_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   stack=self.stale_fixture(d);raw=(stack.PRIVATE/'gateway-process.json').read_bytes();sockets=[]
   def socket_factory():
    s=SimpleNamespace(bind=lambda address:None,close=lambda:None);sockets.append(s);return s
   with patch.object(lane.socket,'socket',side_effect=socket_factory):value=lane.preserve_stale_relay(stack)
   self.assertEqual(value['original_sha256'],value['preserved_sha256'])
   self.assertEqual((stack.PRIVATE/'gateway-process-stale-platform17.json').read_bytes(),raw)
   self.assertFalse((stack.PRIVATE/'gateway-process.json').exists());self.assertEqual(len(sockets),2)

 def test_resume_live_pid_does_not_replace_or_bind(self):
  with tempfile.TemporaryDirectory() as d:
   stack=self.stale_fixture(d,pid=os.getpid())
   with patch.object(lane.socket,'socket',side_effect=AssertionError('no bind')):
    with self.assertRaisesRegex(RuntimeError,'RECORDED_PID_PRESENT'):lane.preserve_stale_relay(stack)
   self.assertTrue((stack.PRIVATE/'gateway-process.json').exists())

 def test_resume_occupied_port_and_source_drift_no_record_effect(self):
  for kind in ('port','source'):
   with self.subTest(kind=kind),tempfile.TemporaryDirectory() as d:
    stack=self.stale_fixture(d,source={'wrong':'source'} if kind=='source' else None)
    raw=(stack.PRIVATE/'gateway-process.json').read_bytes()
    sock=SimpleNamespace(bind=lambda _:(_ for _ in ()).throw(OSError('occupied')),close=lambda:None)
    with patch.object(lane.socket,'socket',return_value=sock):
     with self.assertRaises((OSError,RuntimeError)):lane.preserve_stale_relay(stack)
    self.assertEqual((stack.PRIVATE/'gateway-process.json').read_bytes(),raw)
    self.assertFalse((stack.PRIVATE/'gateway-process-stale-platform17.json').exists())

 def test_exact_accepted_Core_and_v3_plan_no_historical_fallback(self):
  p=lane.load(HERE/'profile.json')
  with self.assertRaisesRegex(RuntimeError,'EXACT_ACCEPTED_CORE_AND_V3_REQUIRED'):
   lane.validate_profile({**p,'accepted_core_successor':'686475cc9606888f41b46ffd7a0ef544484b6b30'})
  for generation in ('historical-v2',None):
   with self.assertRaisesRegex(RuntimeError,'EXACT_ACCEPTED_CORE_AND_V3_REQUIRED'):
    lane.validate_profile({**p,'installer_generation':generation})
  commands=lane.installation_plan();names=[name for name,_ in commands]
  self.assertEqual(names[:4],['session-bootstrap','session-owner','prerequisites','foundation'])
  self.assertEqual([n.removeprefix('domain-') for n in names if n.startswith('domain-')],lane.DOMAIN_ORDER)
  for name,argv in commands:
   self.assertNotIn('historical-v2',argv)
   if name=='foundation' or (name.startswith('domain-') and name not in ('domain-session-authority-delegation','domain-owner-execute-bindings')):
    self.assertEqual(argv[-2],'v3');self.assertTrue(argv[-1].endswith('/service-native-v3/installer-binding.json'))

 def test_profile_positive_and_closed_unit_order(self):
  p=lane.load(HERE/'profile.json');lane.validate_profile(p)
  for units in (lane.DOMAIN_ORDER[::-1],lane.DOMAIN_ORDER+['assets'],lane.DOMAIN_ORDER[:-1]):
   with self.subTest(units=units):
    v={**p,'domain_order':units}
    with self.assertRaisesRegex(RuntimeError,'EXACT_SERVICE_CLOSURE_ONLY'):lane.validate_profile(v)

 def test_wrong_base_native_unit_and_foreign_target(self):
  p=lane.load(HERE/'profile.json')
  for key,value in [('base','bad'),('minimal_native_units',['foundation','maintenance']),('target','staging'),('host_ports',[5432])]:
   with self.subTest(key=key):
    with self.assertRaises(RuntimeError):lane.validate_profile({**p,key:value})

 def test_cli_does_not_accept_arbitrary_payload_or_fixture_dispatch(self):
  for argv in (['--exec','select 1'],['install','--approved=true'],['fixture'],['install',';sql']):
   with self.subTest(argv=argv):
    x=subprocess.run([sys.executable,'-B',str(HERE/'lane.py'),*argv],capture_output=True)
    self.assertNotEqual(x.returncode,0)
    self.assertIn(b'usage:',x.stderr)

 def test_private_receipt_atomic_claim(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'claim.json';lane.write(p,{'state':'one attempt'})
   with self.assertRaises(FileExistsError):lane.write(p,{'state':'retry forbidden'})
   self.assertEqual(lane.load(p),{'state':'one attempt'})
   self.assertEqual(p.stat().st_mode&0o777,0o600)

 def test_symlink_and_hardlink_inputs_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'one';p.write_bytes(b'closed input')
   alias=Path(d)/'alias';alias.symlink_to(p)
   with self.assertRaisesRegex(RuntimeError,'FILE_ALIAS_OR_CUSTODY'):lane.read(alias)
   link=Path(d)/'two';os.link(p,link)
   with self.assertRaisesRegex(RuntimeError,'FILE_ALIAS_OR_CUSTODY'):lane.read(p)

 def test_child_environment_uses_accepted_filter_and_retains_host_guards(self):
  before=os.environ.copy()
  try:
   os.environ.update(NODE_OPTIONS='--no-warnings',NODE_PATH='test-only-resolution',DATABASE_URL='bad',PGPASSWORD='bad',SUPABASE_SERVICE_ROLE_KEY='bad',DOCKER_HOST='bad')
   clean=lane.clean_env()
   for name in ('DATABASE_URL','PGPASSWORD','SUPABASE_SERVICE_ROLE_KEY','DOCKER_HOST'):
    self.assertNotIn(name,clean)
   self.assertEqual(clean['NODE_OPTIONS'],'--no-warnings');self.assertEqual(clean['NODE_PATH'],'test-only-resolution')
  finally:os.environ.clear();os.environ.update(before)


if __name__=='__main__':unittest.main(verbosity=2)
