"""09 only. No producer import, network request, SQL, or replacement inspector."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

P = Path(__file__).absolute().parent / 'docs-ce012-platform-v1/inspection-entry.py'
SPEC = importlib.util.spec_from_file_location('inspection09', P)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


class InspectionTests(unittest.TestCase):
    def test_01_fixed_mode_arguments_only(self):
        good = ['--materials','/owner/material','--run-directory','/owner/new-run']
        self.assertEqual(m.parser().parse_args(good).materials, '/owner/material')
        for bad in [['--run'],['--exec','id'],['-e','code'],['eval'],['approved:true'],['--approved','true'],['--inspect-request'],['extra']]:
            with self.subTest(bad=bad), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                m.parser().parse_args(good + bad)

    def test_02_environment_injection_stops_before_material_or_process_effect(self):
        for key in ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','LD_AUDIT','PYTHONPATH','PYTHONHOME','DOCS_CE012_RUNTIME_DATABASE_URL','DOCS_CE012_REVIEW_ENVELOPE_FILE','TS_NODE_PROJECT']:
            with self.subTest(key=key), mock.patch.dict(os.environ,{**m.ENV,key:'unit-test-only'},clear=True), \
                 mock.patch.object(m,'tool_pins') as tools, mock.patch.object(m.subprocess,'Popen') as spawn:
                with self.assertRaisesRegex(m.Stop,'INSPECTION_ENV_INJECTION'):
                    m.execute(argparse.Namespace(materials='/not-read',run_directory='/not-created'),m.policy())
                tools.assert_not_called(); spawn.assert_not_called()

    def test_03_tools_source_and_no_execution_authority(self):
        p = m.policy(); m.tool_pins(p); m.source_pins()
        self.assertIsNone(p['runtime_binding']); self.assertFalse(p['native_consumer_verified']); self.assertEqual(p['registry'],'EMPTY')
        self.assertEqual(p['expected_stdout']['live'],'CLOSED_PENDING_COORDINATOR_ADMISSION')
        self.assertEqual(set(p['edges']),{'run.mjs','admission.mjs','closure.mjs'})
        self.assertTrue({'socket','connect','sendto','sendmsg','io_uring_setup'} <= set(m.DENY))

    def test_04_private_pin_drift_alias_symlink(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); target=root/'data'; target.write_bytes(b'unit-only'); pin={'path':'data','bytes':9,'sha256':m.sha(b'unit-only')}
            self.assertEqual(m.read_pin(root,pin),b'unit-only')
            target.write_bytes(b'unit-OnLy')
            with self.assertRaisesRegex(m.Stop,'INSPECTION_PIN_DRIFT'): m.read_pin(root,pin)
            target.unlink(); (root/'other').write_bytes(b'unit-only'); target.symlink_to(root/'other')
            with self.assertRaisesRegex(m.Stop,'INSPECTION_SYMLINK'): m.read_pin(root,pin)
            target.unlink(); os.link(root/'other',target)
            with self.assertRaisesRegex(m.Stop,'INSPECTION_FILE_ALIAS_SIZE'): m.read_pin(root,pin)
            with self.assertRaisesRegex(m.Stop,'INSPECTION_ROOT_ALIAS'): m.canonical_dir(d+'/.')
            with self.assertRaisesRegex(m.Stop,'INSPECTION_RELATIVE_PIN'): m.read_pin(root,{**pin,'path':'../other'})

    def test_05_fixed_node_command_cannot_select_live_or_exec(self):
        p=m.policy(); argv=m.node_argv(Path('/owner/material/consumer-source'),'/owner/material',p)
        self.assertEqual(argv[-1],'--inspect-request'); self.assertEqual(argv[-2],'/owner/material/consumer-source/'+p['entry'])
        self.assertTrue('--permission' in argv and '--no-addons' in argv)
        for forbidden in ['--run','--exec','--eval','--allow-child-process','--allow-addons','--allow-fs-write=*']:
            self.assertNotIn(forbidden,argv)
        self.assertEqual(p['environment'],m.ENV)

    def test_06_unknown_creation_cannot_be_cleanup_or_inspection_success(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ,m.ENV,clear=True), \
             mock.patch.object(m,'tool_pins'), mock.patch.object(m,'source_pins'), \
             mock.patch.object(m,'material_plan',return_value=Path(d)), \
             mock.patch.object(m.subprocess,'Popen',side_effect=OSError('unit-only-no-process')):
            out=Path(d)/'run'; r=m.execute(argparse.Namespace(materials=d,run_directory=str(out)),m.policy())
            self.assertEqual(r['status'],'FAILED_OR_UNKNOWN'); self.assertEqual(r['cleanup'],'UNKNOWN_PROCESS_CREATION_ACK')
            self.assertEqual(r['primary_error'],'INSPECTION_UNKNOWN_OSError')
            self.assertEqual(json.loads((out/'receipt.private.json').read_bytes())['status'],'FAILED_OR_UNKNOWN')

    def test_07_fake_approved_receipt_rejects_before_source_import(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); f=root/'materialization.private.json'; f.write_text('{"approved":true}'); f.chmod(0o600)
            with self.assertRaisesRegex(m.Stop,'INSPECTION_RECEIPT_FIELDS'): m.material_plan(d,m.policy())


if __name__ == '__main__':
    unittest.main()
