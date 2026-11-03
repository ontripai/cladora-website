"""Offline admission tests. Synthetic records/payloads are not Core delivery."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import local_runtime_consumer as c

ROOT = Path(__file__).resolve().parents[1]


class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.binding = {'runner_sha256': 'b'*64, 'profile_sha256': 'c'*64}
        self.payload = b'synthetic non-SQL bytes for offline binding tests'
        self.request = dict(format='cladora-local-consumer-v1', consumer_id='Core/ACL-PROJECTION-02',
            source_commit='a'*40, stage=c.STAGE, target='owned-disposable-pg17-auth',
            adapter_id='core-acl-projection-v1', **self.binding, effects=list(c.EFFECTS),
            payloads=[dict(id='witness', sha256=c.digest(self.payload), bytes=len(self.payload))])

    def bundle(self, value=None):
        value = self.request if value is None else value
        raw = json.dumps(value).encode()
        review = dict(reviewer='coordinator', review_id='https://github.com/ontripai/cladora-website/issues/463#issuecomment-1',
            consumer_id=value['consumer_id'], source_commit=value['source_commit'], effects=list(c.EFFECTS),
            payloads=[[x['id'], x['sha256'], x['bytes']] for x in value['payloads']], **self.binding)
        adapters = {'core-acl-projection-v1': {'source_commit': 'a'*40, 'payload_bytes': {'witness': self.payload}}}
        return raw, {c.digest(raw): review}, adapters

    def test_positive_exact_mock_admission_is_not_execution(self):
        raw, reviews, adapters = self.bundle()
        accepted = c.admit(raw, self.binding, reviews=reviews, adapters=adapters)
        self.assertEqual(accepted.request_sha256, c.digest(raw))
        self.assertTrue(accepted.review_record_sha256)
        self.assertEqual(dict(c.CODE_ADAPTERS), {})

    def test_self_approved_or_command_fields_rejected(self):
        for key, value in [('approved', True), ('sql', 'SELECT 1'), ('command', ['sh']), ('module', '/tmp/foreign.py')]:
            request = dict(self.request, **{key: value})
            with self.assertRaisesRegex(c.AdmissionError, 'REQUEST_SHAPE'):
                c.admit(json.dumps(request).encode(), self.binding)

    def test_wrong_target_stage_effects_are_denied(self):
        for key, value in [('target', 'ryygcqiunqqtfkpkflzf'), ('stage', 'before-health'),
                           ('effects', list(c.EFFECTS)+['external_network'])]:
            request = dict(self.request, **{key: value})
            with self.assertRaises(c.AdmissionError):
                c.admit(json.dumps(request).encode(), self.binding)

    def test_source_profile_and_request_pins(self):
        raw, reviews, adapters = self.bundle()
        for field in self.binding:
            binding = dict(self.binding, **{field:'d'*64})
            with self.assertRaisesRegex(c.AdmissionError, 'BINDING_'):
                c.admit(raw, binding, reviews=reviews, adapters=adapters)
        with self.assertRaisesRegex(c.AdmissionError, 'HOLD_NO_COORDINATOR_REVIEW'):
            c.admit(raw+b' ', self.binding, reviews=reviews, adapters=adapters)
        reviews[c.digest(raw)]['source_commit'] = 'd'*40
        with self.assertRaisesRegex(c.AdmissionError, 'REVIEW_BINDING'):
            c.admit(raw, self.binding, reviews=reviews, adapters=adapters)

    def test_reviewer_identity_not_just_nonempty(self):
        raw, reviews, adapters = self.bundle()
        for key, value in [('reviewer', 'request-author'), ('review_id', 'approved')]:
            bad = copy.deepcopy(reviews)
            bad[c.digest(raw)][key] = value
            with self.assertRaisesRegex(c.AdmissionError, 'REVIEW_BINDING'):
                c.admit(raw, self.binding, reviews=bad, adapters=adapters)

    def test_payload_bytes_length_hash_and_adapter_source(self):
        raw, reviews, adapters = self.bundle()
        for change in [{'payload_bytes': {'witness': b'changed'}}, {'source_commit': 'd'*40},
                       {'payload_bytes': {'other': self.payload}}]:
            bad = copy.deepcopy(adapters)
            bad['core-acl-projection-v1'].update(change)
            with self.assertRaises(c.AdmissionError):
                c.admit(raw, self.binding, reviews=reviews, adapters=bad)

    def test_duplicate_keys_ids_and_size_bounds(self):
        with self.assertRaisesRegex(c.AdmissionError, 'DUPLICATE_KEY'):
            c.admit(b'{"approved":true,"approved":false}', self.binding)
        with self.assertRaisesRegex(c.AdmissionError, 'REQUEST_BOUND'):
            c.admit(b' '*32769, self.binding)
        request = copy.deepcopy(self.request)
        request['payloads'] *= 2
        with self.assertRaisesRegex(c.AdmissionError, 'PAYLOAD_DUPLICATE'):
            c.admit(json.dumps(request).encode(), self.binding)

    def test_empty_production_registry_blocks_forged_stage_dispatch(self):
        raw, reviews, adapters = self.bundle()
        accepted = c.admit(raw, self.binding, reviews=reviews, adapters=adapters)
        with self.assertRaisesRegex(c.AdmissionError, 'HOLD_NO_COORDINATOR_REVIEW'):
            c.dispatch(accepted, raw, self.binding, c.Fixture('cladora-lane-'+'a'*12, 'a'*64, 'b'*64))

    def test_review_removed_between_admission_and_effect(self):
        raw, reviews, adapters = self.bundle()
        accepted = c.admit(raw, self.binding, reviews=reviews, adapters=adapters)
        with patch.object(c, 'reviewed_records', return_value={}):
            with self.assertRaises(c.AdmissionError):
                c.dispatch(accepted, raw, self.binding, c.Fixture('cladora-lane-'+'a'*12, 'a'*64, 'b'*64))

    def test_real_cli_holds_before_allocation_or_docker(self):
        # Correct live source/profile pins still cannot replace missing approval.
        import importlib.util
        spec = importlib.util.spec_from_file_location('runner', ROOT/'scripts/run-local-runtime-lane.py')
        runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runner)
        request = dict(self.request, **runner.source_binding())
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root/'request.json'
            path.write_text(json.dumps(request))
            process = subprocess.run([sys.executable, '-B', str(ROOT/'scripts/run-local-runtime-lane.py'),
                '--run-directory', str(root/'must-not-exist'), '--consumer-request', str(path)],
                capture_output=True, text=True, env=dict(os.environ, PATH=''), timeout=10)
            self.assertEqual(process.returncode, 2, process.stderr)
            self.assertEqual(json.loads(process.stdout)['consumer'], 'NOT_RUN')
            self.assertFalse((root/'must-not-exist').exists())

    def test_loaded_profile_race_rejected_before_allocation(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('runner', ROOT/'scripts/run-local-runtime-lane.py')
        runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runner)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)/'must-not-exist'
            with patch.object(runner, 'source_binding', return_value=self.binding):
                with self.assertRaisesRegex(c.AdmissionError, 'PROFILE_CHANGED_DURING_ADMISSION'):
                    runner.Lane(output)
            self.assertFalse(output.exists())

    def test_cli_exec_option_does_not_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)/'must-not-exist'
            process = subprocess.run([sys.executable, '-B', str(ROOT/'scripts/run-local-runtime-lane.py'),
                '--run-directory', str(output), '--exec', 'arbitrary'], capture_output=True,
                env=dict(os.environ, PATH=''), timeout=10)
            self.assertEqual(process.returncode, 2)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
