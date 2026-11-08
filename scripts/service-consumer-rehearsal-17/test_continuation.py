"""New fixed restart admission tests; no signals, Docker, SQL or HTTP."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import continuation as c


class Tests(unittest.TestCase):
 def test_psql_readonly_identity_tags(self):
  import json
  body=json.dumps({'version':'170011','database_oid':'synthetic-only'})
  raw=('BEGIN\n'+body+'\nROLLBACK\n').encode()
  with self.assertRaises(json.JSONDecodeError):json.loads(raw)
  self.assertEqual(c.parse_identity(raw),json.loads(body))
  for bad in [body.encode(),raw.replace(b'ROLLBACK',b'COMMIT'),raw+b'UNKNOWN\n']:
   with self.assertRaisesRegex(RuntimeError,'IDENTITY_TERMINAL_TAG_MISMATCH'):c.parse_identity(bad)

 def test_foreign_or_reused_launcher_stops_before_signal(self):
  record={'pid':123,'start_ticks':'old','source':c.lane.CORE,'build_id':'test-only'}
  fixtures=[{'start_ticks':'new','state':'S','argv':[x.encode() for x in c.LAUNCH]},
   {'start_ticks':'old','state':'S','argv':[b'node',b'other',b'start']}]
  for fixture in fixtures:
   with self.subTest(fixture=fixture),patch.object(c,'proc_identity',return_value=fixture):
    with self.assertRaises(RuntimeError):c.owned_app(record)

 def test_exact_launcher_positive_and_build_drift(self):
  record={'pid':123,'start_ticks':'old','source':c.lane.CORE,'build_id':'test-only'}
  fixture={'start_ticks':'old','state':'S','argv':[x.encode() for x in c.LAUNCH]}
  with patch.object(c,'proc_identity',return_value=fixture),patch.object(Path,'read_text',return_value='test-only\n'):
   self.assertEqual(c.owned_app(record),fixture)
  with patch.object(c,'proc_identity',return_value=fixture),patch.object(Path,'read_text',return_value='changed-build'):
   with self.assertRaisesRegex(RuntimeError,'BUILD_ID_DRIFT'):c.owned_app(record)

 def test_no_snapshot_no_restart_effect(self):
  class NoEffect:
   def cid(self,*_):raise AssertionError('no container inspection or restart before proof')
  with patch.object(c.lane,'gate',return_value=({},NoEffect())),patch.object(c,'app_source'),patch.object(c.lane,'load',return_value={'state':'UNKNOWN'}):
   with self.assertRaisesRegex(RuntimeError,'PRE_RESTART_PROOF_MISSING'):c.restart_backend()


if __name__=='__main__':unittest.main()
