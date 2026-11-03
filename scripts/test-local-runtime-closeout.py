"""Actual CLI/receipt subprocess tests with a fake Docker executable. NO Docker/SQL."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / 'scripts/run-local-runtime-lane.py'

FAKE_DOCKER = r'''
import json,sys
from pathlib import Path
root=Path(__file__).parent
cfg=json.loads((root/'fixture.json').read_text())
sp=root/'state.json'
s=json.loads(sp.read_text()) if sp.exists() else {'containers':{},'images':list(cfg['preexisting']),'done':False}
a=sys.argv[1:]
assert a.pop(0)=='--host=unix:///var/run/docker.sock'
op=a.pop(0); out=''; code=0
if op=='info':out='mock-daemon-offline'
elif op=='pull':
 image=cfg['images'][a[-1]]['image_id']
 if image not in s['images']:s['images'].append(image)
elif op=='image':
 sub=a.pop(0)
 if sub=='ls':out='\n'.join(s['images'])
 elif sub=='inspect':out=json.dumps([dict(Id=cfg['images'][a[0]]['image_id'],Architecture='amd64',Os='linux')])
 elif sub=='rm':
  identity=cfg['images'][a[0]]['image_id']
  if cfg['scenario']=='image_failure':code=1
  else:s['images'].remove(identity)
elif op=='create':
 name=a[a.index('--name')+1]; role='pg' if name.endswith('-pg') else 'auth'
 cid=('a' if role=='pg' else 'b')*64
 label=a[a.index('--label')+1].split('=',1)[1]
 s['containers'][cid]={'Id':cid,'Name':'/'+name,'role':role,'State':{'Running':True},
 'Config':{'User':'999:999','Labels':{'cladora.runtime.run':label}},
 'HostConfig':{'NetworkMode':a[a.index('--network')+1],'PortBindings':{},'Binds':[],
 'Privileged':False,'ReadonlyRootfs':True,'CapDrop':['ALL'],'SecurityOpt':['no-new-privileges:true'],
 'PidMode':'','Devices':[],'CapAdd':[],'PidsLimit':128,'Memory':536870912},'Mounts':[]}
 out=cid
elif op=='inspect':
 obj=s['containers'].get(a[0]) or next((v for v in s['containers'].values() if v['Name']=='/'+a[0]),None)
 if obj is None:code=1
 elif s['done'] and ((obj['role']=='pg' and cfg['scenario'] in ('unknown','health_and_cleanup_failure')) or (obj['role']=='auth' and cfg['scenario']=='auth_unknown')):code=1
 else:out=json.dumps([obj])
elif op=='start':out=a[0]
elif op=='logs':out='synthetic offline logs'
elif op=='rm':s['containers'].pop(a[-1],None)
elif op=='ps':
 if '--format' in a:out='\n'.join(v['Name'][1:] for v in s['containers'].values())
 elif '--filter' in a:
  value=a[a.index('--filter')+1]
  if value.startswith('id=') and value[3:] in s['containers']:out=value[3:]
elif op=='exec':
 text=' '.join(a)
 if 'pg_isready' in text and cfg['scenario'] in ('health_failure','health_and_cleanup_failure'):code=1;s['done']=True
 elif "server_version_num" in text:out='170011|postgres|postgres'
 elif 'GET /health' in text:out='HTTP/1.0 200 OK\r\n\r\n{"version":"v2.197.0"}'
 elif "auth.schema_migrations" in text:out='t|t'
 elif '/sys/class/net' in text:s['done']=True
elif op not in ('start',):code=98
sp.write_text(json.dumps(s))
print(out)
raise SystemExit(code)
'''


class CLIReceipt(unittest.TestCase):
    def run_case(self, scenario, manipulation=None, preexisting=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            profile = json.loads((ROOT / 'supabase/local-profiles/runtime-lane-v1.json').read_text())
            images = {profile[r]['image']: profile[r] for r in ('pg', 'auth')}
            (root/'fixture.json').write_text(json.dumps({'scenario': scenario, 'images': images,
                'preexisting': [x['image_id'] for x in images.values()] if preexisting else []}))
            fake = root/'docker'
            fake.write_text('#!' + sys.executable + '\n' + FAKE_DOCKER)
            fake.chmod(0o700)
            run = root/'run'
            argv = [sys.executable, '-B', str(RUNNER), '--run-directory', str(run)]
            if manipulation:
                # External test process invokes the real CLI main; inject only cleanup
                # evidence faults, not a production CLI feature or a helper-only test.
                driver = '''import importlib.util,sys
sys.path.insert(0,sys.argv[1])
spec=importlib.util.spec_from_file_location('runner',sys.argv[2]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=m.Lane.cleanup
def faulty(self):
 original(self)
 MODE
m.Lane.cleanup=faulty
raise SystemExit(m.main(sys.argv[3:]))
'''.replace('MODE', manipulation)
                argv = [sys.executable, '-B', '-c', driver, str(RUNNER.parent), str(RUNNER), '--run-directory', str(run)]
            env = dict(os.environ, PATH=str(root)+os.pathsep+os.environ['PATH'])
            process = subprocess.run(argv, capture_output=True, text=True, env=env, timeout=15)
            self.assertTrue((run/'receipt.json').exists(), process.stderr)
            receipt = json.loads((run/'receipt.json').read_text())
            output = json.loads(process.stdout)
            self.assertEqual(output['overall_result'], receipt['overall_result'])
            self.assertEqual(process.returncode, receipt['exit_code'])
            return process.returncode, receipt

    def test_acknowledged_all(self):
        code, r = self.run_case('success')
        self.assertEqual((code, r['overall_result']), (0, 'PASSED'))

    def test_unknown_container_keeps_health_success(self):
        code, r = self.run_case('unknown')
        self.assertNotEqual(code, 0)
        self.assertEqual(r['overall_result'], 'UNKNOWN')
        self.assertTrue(r['health_result'].startswith('PG17_AND_'))

    def test_unknown_auth_cleanup(self):
        code, r = self.run_case('auth_unknown')
        self.assertNotEqual(code, 0)
        self.assertEqual(r['overall_result'], 'UNKNOWN')
        self.assertTrue(r['health_result'].startswith('PG17_AND_'))

    def test_health_failed_cleanup_acknowledged_is_not_pass(self):
        code, r = self.run_case('health_failure')
        self.assertNotEqual(code, 0)
        self.assertEqual(r['overall_result'], 'FAILED')
        self.assertEqual(r['primary_error'], 'pg-health:COMMAND_FAILED')

    def test_missing_image_cleanup(self):
        code, r = self.run_case('success', "self.r['cleanup']=[x for x in self.r['cleanup'] if x.get('kind')!='image']")
        self.assertNotEqual(code, 0)
        self.assertTrue(any('cleanup-missing' in x for x in r['cleanup_gaps']))

    def test_missing_one_cleanup(self):
        code, r = self.run_case('success', "self.r['cleanup']=[x for x in self.r['cleanup'] if x.get('resource')!='pg']")
        self.assertNotEqual(code, 0)
        self.assertTrue(any('cleanup-missing' in x for x in r['cleanup_gaps']))

    def test_empty_cleanup(self):
        code, r = self.run_case('success', "self.r['cleanup']=[]")
        self.assertNotEqual(code, 0)
        self.assertEqual(r['cleanup_completeness'], 'UNKNOWN')

    def test_duplicate_cleanup(self):
        code, r = self.run_case('success', "self.r['cleanup'].append(dict(self.r['cleanup'][0]))")
        self.assertNotEqual(code, 0)
        self.assertIn('unexpected-or-duplicate-cleanup', r['cleanup_gaps'])

    def test_preexisting_image_skip_is_allowed(self):
        code, r = self.run_case('success', preexisting=True)
        self.assertEqual(code, 0)
        self.assertEqual(sum(x['state']=='skipped-preexisting' for x in r['cleanup']), 2)

    def test_container_cannot_claim_preexisting_skip(self):
        code, r = self.run_case('success', "self.r['cleanup'][0]['state']='skipped-preexisting'")
        self.assertNotEqual(code, 0)

    def test_wrong_resource_identity(self):
        code, r = self.run_case('success', "self.r['cleanup'][0]['identity']='f'*64")
        self.assertNotEqual(code, 0)

    def test_health_and_cleanup_failure_preserve_first_error(self):
        code, r = self.run_case('health_and_cleanup_failure')
        self.assertNotEqual(code, 0)
        self.assertEqual(r['primary_error'], 'pg-health:COMMAND_FAILED')
        self.assertEqual(r['overall_result'], 'UNKNOWN')
        self.assertTrue(r['cleanup_errors'])

    def test_image_failure_cannot_exit_zero(self):
        code, r = self.run_case('image_failure')
        self.assertNotEqual(code, 0)
        self.assertTrue(r['health_result'].startswith('PG17_AND_'))

    def test_terminal_cleanup_exception_preserves_health_and_first_error(self):
        code, r = self.run_case('success', "raise RuntimeError('synthetic-cleanup-terminal-failure')")
        self.assertNotEqual(code, 0)
        self.assertTrue(r['health_result'].startswith('PG17_AND_'))
        self.assertEqual(r['primary_error'], 'cleanup:synthetic-cleanup-terminal-failure')
        self.assertEqual(r['overall_result'], 'FAILED')


if __name__ == '__main__':
    unittest.main()
