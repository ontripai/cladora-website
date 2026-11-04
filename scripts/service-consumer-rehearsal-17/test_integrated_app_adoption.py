"""Only new exact app-version admission tests. No network/PG/process effects."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch,MagicMock
sys.dont_write_bytecode=True
p=Path(__file__).with_name('adopt-integrated-app.py')
spec=importlib.util.spec_from_file_location('adoption',p);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)


class Tests(unittest.TestCase):
 def contract(self):return a.lane.load(a.HERE/'integrated-app-adoption.json')
 def test_exact_positive(self):a.validate_identity(a.APP_SHA,a.APP_TREE,self.contract())
 def test_old_descendant_or_unknown_head_rejected_even_same_tree(self):
  for sha in [a.INSTALLED,'0e07ff13de4d26fa793f55d7ff90df14a47f3b57','f'*40]:
   with self.subTest(sha=sha),self.assertRaisesRegex(RuntimeError,'EXACT_APP_SHA_TREE_REQUIRED'):a.validate_identity(sha,a.APP_TREE,self.contract())
 def test_wrong_tree_and_profile_source(self):
  with self.assertRaisesRegex(RuntimeError,'EXACT_APP_SHA_TREE_REQUIRED'):a.validate_identity(a.APP_SHA,'e'*40,self.contract())
  c=self.contract();c['app_source']='f'*40
  with self.assertRaisesRegex(RuntimeError,'EXACT_APP_PROFILE'):a.validate_identity(a.APP_SHA,a.APP_TREE,c)
 def test_installed_base_cannot_be_relabeled_as_app(self):
  c=self.contract();c['installed_Core_base']=a.APP_SHA
  with self.assertRaisesRegex(RuntimeError,'INSTALLED_CORE_RELABEL_FORBIDDEN'):a.validate_identity(a.APP_SHA,a.APP_TREE,c)
 def test_origin_or_launcher_substitution_rejected(self):
  for key,value in [('app_origin','http://localhost:31460'),('official_launcher','arbitrary.mjs')]:
   c=self.contract();c[key]=value
   with self.subTest(key=key),self.assertRaises(RuntimeError):a.validate_identity(a.APP_SHA,a.APP_TREE,c)

 def test_absent_old_process_requires_free_official_port(self):
  before={'old_process_record_sha256':a.lane.sha(b'recorded-process')};record={'source':a.INSTALLED,'pid':12345}
  for occupied in (False,True):
   sock=MagicMock();sock.__enter__.return_value=sock;sock.connect_ex.return_value=0 if occupied else 1
   with self.subTest(occupied=occupied),patch.object(a.lane,'load',side_effect=[before,record]),patch.object(a.lane,'read',return_value=b'recorded-process'),patch.object(Path,'exists',return_value=False),patch.object(a.socket,'socket',return_value=sock):
    if occupied:
     with self.assertRaisesRegex(RuntimeError,'OLD_PID_ABSENT_PORT_OCCUPIED'):a.old_process_state()
    else:self.assertEqual(a.old_process_state()[1],'ALREADY_ABSENT_AND_OFFICIAL_PORT_FREE')

 def test_unknown_or_foreign_existing_pid_never_becomes_absent_skip(self):
  before={'old_process_record_sha256':a.lane.sha(b'recorded-process')};record={'source':a.INSTALLED,'pid':12345}
  with patch.object(a.lane,'load',side_effect=[before,record]),patch.object(a.lane,'read',return_value=b'recorded-process'),patch.object(Path,'exists',return_value=True),patch.object(a.continuation,'owned_app',side_effect=RuntimeError('APP_PID_REUSED')):
   with self.assertRaisesRegex(RuntimeError,'APP_PID_REUSED'):a.old_process_state()

 def test_already_exited_skip_has_no_signal_or_stop_ack(self):
  before={'old_process_record_sha256':a.lane.sha(b'recorded-process')};record={'source':a.INSTALLED,'pid':12345};writes=[]
  with patch.object(a,'gate'),patch.object(a,'require_build'),patch.object(a.lane,'load',return_value=before),patch.object(a.lane,'read',return_value=b'recorded-process'),patch.object(a,'old_process_state',return_value=(record,'ALREADY_ABSENT_AND_OFFICIAL_PORT_FREE')),patch.object(a.lane,'write',side_effect=lambda path,value:writes.append(value)),patch.object(a.os,'kill',side_effect=AssertionError('no signal for absent PID')):
   a.stop_old()
  self.assertEqual(writes[-1]['state'],'SKIPPED_ALREADY_EXITED_OBSERVED_PORT_FREE');self.assertEqual(writes[-1]['stop_ACK'],'NOT_CLAIMED')


if __name__=='__main__':unittest.main()
