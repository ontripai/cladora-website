"""Offline admission checks only; no mock Storage/Auth or native success claim."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
P = Path(__file__).resolve().parent / 'storage-documents-native-abi-v1' / 'preflight.py'
S = importlib.util.spec_from_file_location('preflight15', P)
M = importlib.util.module_from_spec(S)
S.loader.exec_module(M)


class Gates(unittest.TestCase):
 def base(self):
  return {'schema_owner': 'supabase_storage_admin', 'authenticated_usage': True,
   'service_usage': True, 'authenticated_restricted': True, 'service_restricted': True,
   'policy_count': 0, 'bucket_count': 0, 'object_count': 0,
   'tables': [dict(name=n, owner='supabase_storage_admin', rls=True,
    authenticated_select=True, authenticated_insert=True, authenticated_update=True)
    for n in ('buckets', 'objects')]}

 def test_table_grants_do_not_replace_schema_usage(self):
  c = self.base()
  c['authenticated_usage'] = False
  c['service_usage'] = False
  self.assertEqual(M.gates(c), ['AUTHENTICATED_STORAGE_SCHEMA_USAGE_MISSING',
   'PROVIDER_SERVICE_STORAGE_SCHEMA_USAGE_MISSING'])

 def test_unknown_does_not_pass(self):
  c = self.base()
  c['authenticated_usage'] = None
  c['service_restricted'] = None
  self.assertIn('AUTHENTICATED_STORAGE_SCHEMA_USAGE_MISSING', M.gates(c))
  self.assertIn('ROLE_RESTRICTION_UNKNOWN_OR_MISMATCH', M.gates(c))

 def test_existing_scope_must_be_reviewed(self):
  for field in ('policy_count', 'bucket_count', 'object_count'):
   c = self.base()
   c[field] = 1
   self.assertTrue(M.gates(c))

 def test_owner_rls_or_table_drift(self):
  for key, value in [('owner', 'foreign'), ('rls', False), ('authenticated_insert', False)]:
   c = self.base()
   c['tables'][1][key] = value
   self.assertTrue(M.gates(c))
  c = self.base()
  c['tables'].append(c['tables'][0])
  self.assertIn('STORAGE_TABLE_INVENTORY_UNKNOWN', M.gates(c))

 def test_positive_metadata_gate(self):
  self.assertEqual(M.gates(self.base()), [])

 def test_alias_and_receipt_overwrite_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root = Path(d)
   p = root / 'receipt.json'
   M.write(p, {'first': 'preserved'})
   with self.assertRaises(FileExistsError):
    M.write(p, {'second': 'not allowed'})
   alias = root / 'alias'
   alias.symlink_to(p)
   with self.assertRaises(RuntimeError):
    M.safe_bytes(alias)
   self.assertEqual(M.safe_bytes(p), b'{\n  "first": "preserved"\n}\n')


if __name__ == '__main__':
 unittest.main()
