"""Restore adapter controls only; not native restore proof."""
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest
from unittest.mock import patch

p=Path(__file__).with_name('functional-dev-stack-v1')/'restore13.py'
s=importlib.util.spec_from_file_location('restore13',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class RestoreTests(unittest.TestCase):
 def test_envelope_only_normalization(self):
  a=b'-- PostgreSQL database dump\n\\restrict AbC12\nCREATE ROLE x;\n\\unrestrict AbC12\n'
  self.assertEqual(m.normalize_dump(a),'CREATE ROLE x;')
  self.assertNotEqual(m.normalize_dump(a),m.normalize_dump(a.replace(b'x;',b'y;')))
 def test_schema_owner_acl_and_duplicate_addresses(self):
  x=b'SET client_encoding=\'UTF8\';\n-- Name: x; Type: SCHEMA; Schema: -; Owner: a\nCREATE SCHEMA x;\nGRANT USAGE ON SCHEMA x TO b;\n'
  self.assertNotEqual(m.schema_objects(x),m.schema_objects(x.replace(b'Owner: a',b'Owner: b')))
  self.assertNotEqual(m.schema_objects(x),m.schema_objects(x.replace(b'GRANT USAGE',b'GRANT ALL')))
  with self.assertRaises(RuntimeError):m.schema_objects(x+x.split(b'-- Name:',1)[0]+b'-- Name:'+x.split(b'-- Name:',1)[1])
 def test_copy_rows_null_missing_and_duplicates_are_not_hidden(self):
  x=b'COPY auth.users (id, value) FROM stdin;\na\t\\N\nb\tvalue\n\\.\n'
  self.assertEqual(m.data_rows(x),m.data_rows(x.replace(b'a\t\\N\nb\tvalue',b'b\tvalue\na\t\\N')))
  self.assertNotEqual(m.data_rows(x),m.data_rows(x.replace(b'\\N',b'null')))
  with self.assertRaises(RuntimeError):m.data_rows(x.replace(b'\\.\n',b''))
  with self.assertRaises(RuntimeError):m.data_rows(x+x)
 def test_unsafe_storage_tar_is_rejected(self):
  for name,kind in [('../secret',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('alias',tarfile.SYMTYPE)]:
   out=io.BytesIO()
   with tarfile.open(fileobj=out,mode='w') as t:
    info=tarfile.TarInfo(name);info.type=kind;info.linkname='/etc/passwd' if kind==tarfile.SYMTYPE else '';t.addfile(info)
   with self.assertRaises(RuntimeError):m.tar_snapshot(out.getvalue())
 def test_fixed_cli_rejects_arbitrary_target_and_exec(self):
  with patch('sys.argv',['restore13.py','run','--exec','SQL']),patch.object(m,'Restore') as create:
   with self.assertRaises(SystemExit):m.main()
   create.assert_not_called()
 def test_reference_shapes_without_private_materials_or_database(self):
  # Only parser mechanics; real40-table snapshot is separate private evidence.
  data=b'COPY auth.users (id) FROM stdin;\nu\n\\.\nCOPY platform_dev.notes (id, body) FROM stdin;\nn\tvalue\n\\.\n'
  self.assertEqual(len(m.data_rows(data)['tables']),2)
  self.assertEqual(len(m.schema_objects(b'SET client_encoding=\'UTF8\';\n-- Name: x; Type: SCHEMA; Schema: -; Owner: a\nCREATE SCHEMA x;\n')),2)
 def test_historical_role_privileges_not_normalized_away(self):
  broad=b'ALTER ROLE service_role WITH NOLOGIN BYPASSRLS;'
  self.assertNotEqual(m.normalize_dump(broad),m.normalize_dump(broad.replace(b' BYPASSRLS',b' NOBYPASSRLS')))
 def test_original_and_cleanup_identity_request_full_cid(self):
  lab=object.__new__(m.Restore);calls=[]
  def cmd(stage,args,*a,**kw):
   calls.append(args)
   return b'a'*64 if stage.endswith('-id') else b'{}'
  lab.cmd=cmd
  lab.inspect=lambda *a:{'State':{'Running':True},'Config':{'Image':m.IMAGE},'Mounts':[]}
  result=lab.original_snapshot('unit')
  self.assertEqual(result['cid'],'a'*64);self.assertIn('--no-trunc',calls[0])
 def test_cleanup_failure_preserves_primary_and_still_checks_other_resources(self):
  lab=object.__new__(m.Restore);lab.run='unit';lab.containers=[{'name':'unit-pg','cid':'a'*64,'role':'pg'}];lab.volumes=['unit-owned']
  lab.r={'primary_error':'FIRST_SQL_ERROR','cleanup':[]};lab.save=lambda:None;calls=[]
  lab.inspect=lambda *a:{'Config':{'Labels':{'cladora.restore13.run':'unit'}}}
  def cmd(stage,args,*a,**kw):
   calls.append(args)
   if stage=='cleanup-find-pg':return b'a'*64
   if stage=='cleanup-rm-pg':raise RuntimeError('UNIT_REMOVE_FAILED')
   if stage.startswith('cleanup-volume-list'):return b'unit-owned'
   if stage.startswith('cleanup-volume-inspect'):return b'[{"Labels":{"cladora.restore13.run":"unit"}}]'
   if stage.startswith('cleanup-volume-users'):return b'a'*64
   return b''
  lab.cmd=cmd;lab.cleanup()
  self.assertEqual(lab.r['primary_error'],'FIRST_SQL_ERROR');self.assertFalse(lab.r['cleanup_complete'])
  self.assertEqual(len(lab.r['cleanup']),2);self.assertTrue(all(x['state']=='FAILED_OR_UNKNOWN' for x in lab.r['cleanup']))
  self.assertFalse(any(x[:2]==['volume','rm'] for x in calls))
 def test_foreign_cleanup_label_never_deleted(self):
  lab=object.__new__(m.Restore);lab.run='unit';lab.containers=[{'name':'unit-pg','cid':'a'*64,'role':'pg'}];lab.volumes=[]
  lab.r={'primary_error':None,'cleanup':[]};lab.save=lambda:None;calls=[]
  lab.cmd=lambda stage,args,*a,**kw:(calls.append(args) or b'a'*64)
  lab.inspect=lambda *a:{'Config':{'Labels':{'cladora.restore13.run':'foreign'}}}
  lab.cleanup();self.assertFalse(lab.r['cleanup_complete']);self.assertFalse(any(x[0]=='rm' for x in calls))
if __name__=='__main__':unittest.main()
