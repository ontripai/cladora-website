"""Offline negative lifecycle/isolation checks; no Docker/DB/provider invoked."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('lane', Path(__file__).with_name('run-local-runtime-lane.py'))
lane = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lane)


class Tests(unittest.TestCase):
    def test_secret_never_written_to_inspection_log(self):
        with tempfile.TemporaryDirectory() as p:
            obj = lane.Lane(Path(p) / 'run')
            secret = 'synthetic-not-a-real-key'
            obj.sensitive.append(secret)
            result = lane.subprocess.CompletedProcess([], 0, (secret + '\n').encode(), b'')
            with patch.object(lane.subprocess, 'run', return_value=result):
                obj.cmd('inspect-secret', ['inspect', 'synthetic'])
            data = (obj.out / 'inspect-secret.private.log').read_text()
            self.assertNotIn(secret, data)
            self.assertIn('[EPHEMERAL_SECRET_REDACTED]', data)

    def test_namespace_precedes_auth_and_no_native_install(self):
        with tempfile.TemporaryDirectory() as p:
            obj = lane.Lane(Path(p) / 'run')
            calls = []
            obj.image = lambda role: None
            def create(role, *args):
                calls.append(role + '-create')
                return 'a'*64
            obj.create = create
            obj.cleanup = lambda: calls.append('cleanup')
            def respond(stage, args, *a, **kw):
                calls.append(stage)
                if stage == 'auth-namespace-bootstrap':
                    self.assertEqual(args[-1], 'CREATE SCHEMA auth AUTHORIZATION postgres;')
                return {'pg-identity': '170011|postgres|postgres\n',
                        'auth-health': 'HTTP/1.0 200 OK\r\n\r\n{"version":"v2.197.0"}',
                        'auth-schema-identity': 't|t\n'}.get(stage, '')
            obj.cmd = respond
            result = obj.execute()
            self.assertNotIn('primary_error', result)
            self.assertLess(calls.index('auth-namespace-bootstrap'), calls.index('auth-create'))
            self.assertEqual(result['domain_installation'], 'NOT_RUN')

    def test_bad_profile_before_allocation(self):
        original = json.loads(lane.PROFILE.read_text())
        for key, value in [('pg_network', 'host'), ('published_ports', ['5432']), ('bind_mounts', ['/workspace'])]:
            p = copy.deepcopy(original)
            p['isolation'][key] = value
            with self.assertRaises(AssertionError):
                lane.validate(p)

    def test_host_secrets_not_inherited(self):
        lane.os.environ['SUPABASE_SECRET_KEY'] = 'synthetic-only'
        try:
            self.assertNotIn('SUPABASE_SECRET_KEY', lane.environment())
            self.assertNotIn('DOCKER_HOST', lane.environment())
        finally:
            del lane.os.environ['SUPABASE_SECRET_KEY']

    def test_consumed_run_directory_rejected(self):
        with tempfile.TemporaryDirectory() as p:
            with self.assertRaises(FileExistsError):
                lane.Lane(p)

    def test_first_failure_stops_all_starts_and_runs_cleanup(self):
        with tempfile.TemporaryDirectory() as p:
            obj = lane.Lane(Path(p) / 'run')
            calls = []
            def fail(stage, args, *a, **kw):
                calls.append(stage)
                raise RuntimeError('exact-primary')
            obj.cmd = fail
            obj.cleanup = lambda: calls.append('cleanup')
            r = obj.execute()
            self.assertEqual(r['primary_error'], 'exact-primary')
            self.assertEqual(calls, ['docker-info', 'cleanup'])

    def test_cleanup_failure_does_not_skip_next_owned_resource(self):
        with tempfile.TemporaryDirectory() as p:
            obj = lane.Lane(Path(p) / 'run')
            obj.owned = [{'role': 'pg', 'name': 'pg', 'cid': 'a'*64}, {'role': 'auth', 'name': 'auth', 'cid': 'b'*64}]
            calls = []
            def fail(stage, args, *a, **kw):
                calls.append(stage)
                raise RuntimeError('cleanup-local-error')
            obj.cmd = fail
            obj.cleanup()
            self.assertEqual(calls, ['auth-cleanup-inspect', 'pg-cleanup-inspect'])
            self.assertEqual([x['state'] for x in obj.r['cleanup']], ['unknown', 'unknown'])


if __name__ == '__main__':
    unittest.main()
