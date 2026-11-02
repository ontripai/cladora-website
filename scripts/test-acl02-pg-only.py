#!/usr/bin/env python3
"""Only the new pure-PG delta; replayed protocol frames, never Docker or SQL."""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import acl02_pg_adapter as a
import acl02_pg_wire as w
from local_runtime_consumer import AdmissionError, Fixture

spec = importlib.util.spec_from_file_location('pure_runner', Path(__file__).with_name('run-acl02-pg-only.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def result(**kw):
    r = {'errors': [], 'ready': 'I', 'tags': ['ROLLBACK'], 'rows': [], 'chain': '0' * 64}
    r.update(kw)
    return r


def frame(kind, body):
    return kind + struct.pack('!I', len(body) + 4) + body


def row(value):
    raw = json.dumps(value).encode()
    return struct.pack('!Hi', 1, len(raw)) + raw


def replay(raw):
    x = w.Wire.__new__(w.Wire)
    data = io.BytesIO(raw)
    x.read = lambda size: read_exact(data, size)
    x.capture = lambda *args: None
    x.pid = 71
    x.total = x.frames = 0
    x.chain = '1' * 64
    x.idle = None
    x.quarantined = False
    return x


def read_exact(stream, size):
    raw = stream.read(size)
    if len(raw) != size:
        raise w.WireError('UNKNOWN_STREAM_ENDED')
    return raw


class PurePGDelta(unittest.TestCase):
    def test_01_exact_producer_and_inactive_registry(self):
        a.seal()
        self.assertEqual(json.loads(a.REGISTRY.read_bytes())['reviews'], {})
        with self.assertRaisesRegex(AdmissionError, 'HOLD'):
            a.admit(json.dumps(a.envelope()).encode())

    def test_02_review_positive_and_changed_envelope_family(self):
        value = a.envelope()
        raw = json.dumps(value).encode()
        record = {'seal_sha256': value['seal']['sha256'], 'source_commit': a.SOURCE,
                  'review': 'https://github.com/ontripai/cladora-website/issues/463#issuecomment-1', 'single_use': True}
        self.assertEqual(a.admit(raw, {a.digest(raw): record}), a.digest(raw + json.dumps(record, sort_keys=True, separators=(',', ':')).encode()))
        for key, changed in [('target', 'owned-disposable-pg17-auth'), ('source_commit', 'a' * 40),
                             ('adapter', 'arbitrary'), ('authority', {'approved': True}),
                             ('execution_binding', {'cid': 'b' * 64}), ('order', ['verify-clean.sql', 'witness.sql'])]:
            with self.subTest(key=key):
                bad = dict(value, **{key: changed})
                with self.assertRaisesRegex(AdmissionError, 'BINDING'):
                    a.admit(json.dumps(bad).encode(), {a.digest(raw): record})
        for key in ('sql', 'path', 'shell', 'exec', 'approved', 'review_url'):
            with self.subTest(extra=key), self.assertRaises(AdmissionError):
                a.admit(json.dumps(dict(value, **{key: 'anything'})).encode())

    def test_03_file_seal_mutation_family(self):
        expected = a.envelope()
        original = Path.read_bytes
        names = list(expected['seal']['files'])
        for name in names:
            with self.subTest(name=name):
                target = a.ROOT / name
                def changed(path):
                    return original(path) + b'\n' if path == target else original(path)
                with patch.object(Path, 'read_bytes', changed):
                    try:
                        observed = a.envelope()
                    except AdmissionError:
                        continue
                    self.assertNotEqual(observed, expected)
                    with self.assertRaisesRegex(AdmissionError, 'BINDING'):
                        a.admit(json.dumps(expected).encode())

    def test_04_profile_and_fixture_types(self):
        profile = json.loads(a.PROFILE.read_bytes())
        m.validate(profile)
        for key, value in [('auth', {}), ('target', 'owned-disposable-pg17-auth')]:
            with self.subTest(key=key), self.assertRaises(AdmissionError):
                m.validate(dict(profile, **{key: value}))
        f = a.PurePGFixture('cladora-lane-' + 'a' * 12, 'b' * 32, 'c' * 64)
        a.validate_fixture(f)
        for invalid in [Fixture(f.run_id, f.pg_cid, 'd' * 64),
                        a.PurePGFixture(f.run_id, f.attempt, 'unknown'),
                        a.PurePGFixture(f.run_id, f.attempt, f.pg_cid, kind='pg-auth')]:
            with self.subTest(fixture=invalid), self.assertRaises(AdmissionError):
                a.validate_fixture(invalid)

    def test_05_native_rollback_idle_required(self):
        x = replay(frame(b'C', b'ROLLBACK\0') + frame(b'Z', b'I'))
        w.require_rollback(x.drain())
        for raw in [frame(b'C', b'SELECT 1\0') + frame(b'Z', b'I'),
                    frame(b'C', b'ROLLBACK\0') + frame(b'Z', b'T'), frame(b'C', b'ROLLBACK\0'),
                    frame(b'Z', b'I'), frame(b'E', b'C42501\0\0') + frame(b'Z', b'I')]:
            with self.subTest(raw=raw), self.assertRaises(w.WireError):
                w.require_rollback(replay(raw).drain())

    def test_06_error_terminal_drained_without_guessing_xid(self):
        x = replay(frame(b'E', b'C42501\0Mdenied\0\0') + frame(b'Z', b'E'))
        r = x.drain()
        self.assertEqual(r['errors'], ['42501'])
        self.assertEqual(x.idle, 'E')
        self.assertFalse(x.quarantined)
        x.send = lambda raw: self.assertEqual(raw, b'Q' + struct.pack('!I', 14) + b'ROLLBACK;\0')
        x.drain = lambda: result()
        self.assertEqual(x.rollback_known()['state'], 'acknowledged')
        for idle, quarantine in [(None, True), ('E', True), ('I', False)]:
            x.idle, x.quarantined = idle, quarantine
            x.send = lambda raw: self.fail('unknown backend must not receive rollback')
            self.assertEqual(x.rollback_known()['state'], 'skipped')

    def test_07_independent_observer_exact_zero(self):
        first = {'database': 'postgres', 'database_oid': '5', 'system_identifier': '123', 'version': 170011, 'pid': 71}
        other = dict(first, pid=72)
        value = {'stage': 'ACL02_RESIDUE', 'database': 'postgres', 'backend_pid': 72,
                 'server_version_num': 170011, 'roles_remaining': 0, 'schemas_remaining': 0}
        r = result(rows=[value])
        w.require_residue(r, first, other)
        for key, bad in [('roles_remaining', 1), ('schemas_remaining', 1), ('roles_remaining', None),
                         ('schemas_remaining', False), ('backend_pid', 71), ('database', 'wrong')]:
            with self.subTest(key=key, value=bad), self.assertRaises(w.WireError):
                w.require_residue(result(rows=[dict(value, **{key: bad})]), first, other)
        for changed in [dict(other, pid=71), dict(other, system_identifier='124'), dict(other, database_oid='6')]:
            with self.assertRaises(w.WireError):
                w.require_residue(r, first, changed)
        with self.assertRaises(w.WireError):
            w.require_residue(result(), first, other)

    def test_08_interrupted_or_oversized_stream_quarantines(self):
        for raw in [b'', b'Z\x00', b'D' + struct.pack('!I', w.MAX_BYTES + 1)]:
            x = replay(raw)
            with self.assertRaises(w.WireError):
                x.drain()
            self.assertTrue(x.quarantined)

    def test_09_fsync_failure_cannot_ack(self):
        x = replay(frame(b'C', b'ROLLBACK\0') + frame(b'Z', b'I'))
        x.capture = lambda *args: (_ for _ in ()).throw(OSError('fsync failed'))
        with self.assertRaises(OSError):
            x.drain()
        self.assertTrue(x.quarantined)
        self.assertIsNone(x.idle)

    def test_10_pure_pg_cleanup_complete_and_gap_family(self):
        owned = [{'name': 'pg', 'cid': 'c', 'role': 'pg'}]
        images = [('image', 'i', True)]
        r = {'health_result': 'PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL',
             'consumer': {'status': 'NOT_REQUESTED'}, 'cleanup': [
                 {'kind': 'container', 'resource_id': 'pg', 'identity': 'c', 'state': 'acknowledged-absent'},
                 {'kind': 'image', 'resource_id': 'i', 'identity': 'i', 'state': 'removal-acknowledged'}]}
        self.assertEqual(m.base.finalize_lifecycle(copy.deepcopy(r), owned, images, pg_only=True), 0)
        for variant in ('unknown', 'missing', 'empty', 'wrong-cid', 'health-failure'):
            with self.subTest(variant=variant):
                bad = copy.deepcopy(r)
                if variant == 'unknown': bad['cleanup'][0]['state'] = 'unknown'
                elif variant == 'missing': bad['cleanup'].pop(0)
                elif variant == 'empty': bad['cleanup'] = []
                elif variant == 'wrong-cid': bad['cleanup'][0]['identity'] = 'other'
                else:
                    bad['health_result'] = 'NOT_RUN'
                    bad['primary_error'] = 'health:original'
                    bad['cleanup'][0]['state'] = 'unknown'
                self.assertEqual(m.base.finalize_lifecycle(bad, owned, images, pg_only=True), 1)
                self.assertEqual(bad['cleanup_completeness'], 'UNKNOWN')
                if variant == 'health-failure': self.assertEqual(bad['primary_error'], 'health:original')
        old = copy.deepcopy(r)
        self.assertNotEqual(m.base.finalize_lifecycle(old, owned, images), 0)

    def test_11_cli_holds_before_allocation_or_docker(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            request = folder / 'envelope.json'
            request.write_text(json.dumps(a.envelope()))
            out = folder / 'not-created'
            p = subprocess.run([sys.executable, str(a.ROOT / 'scripts/run-acl02-pg-only.py'),
                '--run-directory', str(out), '--consumer-envelope', str(request)], capture_output=True)
            self.assertEqual(p.returncode, 2)
            self.assertIn(b'HOLD_EXACT_BINDING_NOT_REVIEWED', p.stdout)
            self.assertFalse(out.exists())

    def test_12_run_cannot_be_reused(self):
        with tempfile.TemporaryDirectory() as temp:
            lane = m.PurePGLane(Path(temp) / 'run')
            (lane.out / 'provision-attempt.claim').write_text('consumed')
            with patch.object(lane, 'cmd', side_effect=AssertionError('no Docker')):
                with self.assertRaises(FileExistsError):
                    lane.execute()
            with self.assertRaises(FileExistsError):
                m.PurePGLane(lane.out)

    def test_13_native_capture_hash_order_and_key_secrecy(self):
        with tempfile.TemporaryDirectory() as temp:
            x = w.Wire.__new__(w.Wire)
            x.total = x.frames = 0
            x.chain = '0' * 64
            x.run, x.attempt, x.cid, x.phase, x.pid = 'run', 'attempt', 'cid', 'installer', 71
            path = Path(temp) / 'capture'
            x.log = open(path, 'xb')
            x.capture(b'K', struct.pack('!II', 71, 0xdeadbeef))
            x.capture(b'C', b'ROLLBACK\0')
            x.capture(b'Z', b'I')
            x.log.close()
            rows = path.read_bytes().splitlines()
            self.assertNotIn(b'deadbeef', path.read_bytes())
            chain = '0' * 64
            for index, raw in enumerate(rows, 1):
                item = json.loads(raw)
                self.assertEqual(item['sequence'], index)
                self.assertEqual(item['previous'], chain)
                chain = hashlib.sha256(raw).hexdigest()
            self.assertEqual(x.chain, chain)

    def test_14_adapter_control_and_error_path(self):
        f = a.PurePGFixture('cladora-lane-' + 'a' * 12, 'b' * 32, 'c' * 64)
        first = {'pid': 71, 'database': 'postgres', 'database_oid': '5', 'system_identifier': '123', 'version': 170011}
        other = dict(first, pid=72)
        marker = {'stage': 'ACL02_ASSERTIONS_REACHED', 'synthetic_only': True, 'backend_pid': 71,
                  'case_ids': ['D00','D01','D02','D03','P01','P02','D04','D05','D06','D07','D08']}
        residue = {'stage': 'ACL02_RESIDUE', 'database': 'postgres', 'backend_pid': 72,
                   'server_version_num': 170011, 'roles_remaining': 0, 'schemas_remaining': 0}
        from unittest.mock import MagicMock
        for fail in (False, True):
            with self.subTest(failure=fail), tempfile.TemporaryDirectory() as temp:
                install, observe = MagicMock(), MagicMock()
                install.pid = 71
                install.identity.return_value = first
                observe.identity.return_value = other
                install.query.return_value = result(rows=[marker]) if not fail else result(errors=['42501'], ready='E', tags=[])
                install.rollback_known.return_value = {'state': 'acknowledged', 'terminal': result()}
                observe.query.return_value = result(rows=[residue])
                receipts = []
                with patch.object(a, 'admit', return_value='admitted'), patch.object(a, 'Wire', side_effect=[install, observe]):
                    output = a.execute(b'envelope', 'admitted', f, temp, [], {}, lambda: None,
                                       lambda value: receipts.append(copy.deepcopy(value)))
                    self.assertEqual(output['residue'], 'ZERO_OBSERVED')
                    self.assertEqual(output['status'], 'FAILED_OR_UNKNOWN' if fail else 'PASSED')
                    if fail: self.assertEqual(output['primary_error'], 'WITNESS_SQL_ERROR:42501')
                    self.assertEqual(install.query.call_args.args[0], (a.DIRECTORY / 'witness.sql').read_bytes())
                    self.assertEqual(observe.query.call_args.args[0], (a.DIRECTORY / 'verify-clean.sql').read_bytes())
                    install.close.assert_called_once()
                    observe.close.assert_called_once()
                    with self.assertRaises(FileExistsError):
                        a.execute(b'envelope', 'admitted', f, temp, [], {}, lambda: None, lambda _: None)


    def test_15_native_observation_loss_and_nonzero_block_success(self):
        from unittest.mock import MagicMock
        fixture = a.PurePGFixture('cladora-lane-' + 'a' * 12, 'b' * 32, 'c' * 64)
        first = {'pid': 71, 'database': 'postgres', 'database_oid': '5', 'system_identifier': '123', 'version': 170011}
        marker = {'stage': 'ACL02_ASSERTIONS_REACHED', 'synthetic_only': True, 'backend_pid': 71,
                  'case_ids': ['D00','D01','D02','D03','P01','P02','D04','D05','D06','D07','D08']}
        for failure in ('missing-ack', 'stream-loss', 'observer-loss', 'nonzero'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                installer, observer = MagicMock(), MagicMock()
                installer.pid = 71
                installer.identity.return_value = first
                observer.identity.return_value = dict(first, pid=72)
                installer.query.return_value = result(rows=[marker])
                installer.rollback_known.return_value = {'state': 'skipped', 'reason': 'unknown-stream'}
                if failure == 'missing-ack':
                    installer.query.return_value = result(rows=[marker], tags=[])
                elif failure == 'stream-loss':
                    installer.query.side_effect = w.WireError('UNKNOWN_STREAM_ENDED')
                elif failure == 'observer-loss':
                    observer.query.side_effect = w.WireError('UNKNOWN_STREAM_ENDED')
                else:
                    observer.query.return_value = result(rows=[{'stage': 'ACL02_RESIDUE', 'database': 'postgres',
                        'backend_pid': 72, 'server_version_num': 170011, 'roles_remaining': 1, 'schemas_remaining': 0}])
                with patch.object(a, 'admit', return_value='admitted'), patch.object(a, 'Wire', side_effect=[installer, observer]) as constructor:
                    out = a.execute(b'envelope', 'admitted', fixture, temp, [], {}, lambda: None, lambda _: None)
                self.assertEqual(out['status'], 'FAILED_OR_UNKNOWN')
                self.assertEqual(out['residue'], 'UNKNOWN')
                if failure in ('missing-ack', 'stream-loss'):
                    self.assertEqual(constructor.call_count, 1)
                    self.assertEqual(out['observer'], 'NOT_RUN_ROLLBACK_UNPROVED')
                else:
                    self.assertEqual(out['rollback']['state'], 'acknowledged')

    def test_16_fresh_seal_and_review_at_effect(self):
        with tempfile.TemporaryDirectory() as temp:
            lane = m.PurePGLane(Path(temp) / 'run')
            with patch.object(a, 'seal', return_value={'sha256': 'changed'}):
                with self.assertRaisesRegex(AdmissionError, 'SOURCE_CHANGED_AT_EFFECT'):
                    lane.assert_source()
            lane.raw, lane.admitted = b'envelope', 'first-review'
            with patch.object(a, 'admit', return_value='replacement-review'):
                with self.assertRaisesRegex(AdmissionError, 'REVIEW_CHANGED_AT_EFFECT'):
                    lane.assert_source()

    def test_17_cli_receipt_cleanup_gap_preserves_health(self):
        # Real CLI entry point in a child process; fixed mock provision lifecycle only.
        # No Docker, SQL or production admission override.
        for gap in ('complete', 'unknown', 'missing', 'health-and-cleanup-failure'):
            with self.subTest(gap=gap), tempfile.TemporaryDirectory() as temp:
                harness = r"""
import importlib.util, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(sys.argv[1]).parent))
spec=importlib.util.spec_from_file_location('runner',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
mode=sys.argv[3]
def fake_execute(self):
    self.owned=[{'role':'pg','name':'owned-pg','cid':'real-test-cid'}]
    self.images=[('pinned-image','image-id',True)]
    self.r['health_result']='PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL'
    self.r['cleanup']=[{'kind':'container','resource_id':'owned-pg','identity':'real-test-cid','state':'acknowledged-absent'},
                      {'kind':'image','resource_id':'image-id','identity':'image-id','state':'removal-acknowledged'}]
    if mode=='unknown': self.r['cleanup'][0]['state']='unknown'
    if mode=='missing': self.r['cleanup'].pop(0)
    if mode=='health-and-cleanup-failure':
        self.r['health_result']='NOT_RUN';self.r['primary_error']='health:first';self.r['cleanup'][0]['state']='unknown'
    m.base.finalize_lifecycle(self.r,self.owned,self.images,pg_only=True);self.save();return self.r
m.PurePGLane.execute=fake_execute
raise SystemExit(m.main(['--run-directory',sys.argv[2]]))
"""
                out = Path(temp) / 'run'
                child = subprocess.run([sys.executable, '-c', harness, str(a.ROOT / 'scripts/run-acl02-pg-only.py'), str(out), gap], capture_output=True)
                self.assertEqual(child.returncode, 0 if gap == 'complete' else 1, child.stderr)
                receipt = json.loads((out / 'receipt.json').read_bytes())
                self.assertEqual(receipt['overall_result'], 'PASSED' if gap == 'complete' else 'UNKNOWN')
                if gap == 'health-and-cleanup-failure':
                    self.assertEqual(receipt['primary_error'], 'health:first')
                else:
                    self.assertEqual(receipt['health_result'], 'PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL')

    def test_19_shared_hook_uses_current_binding(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(m.base, 'source_binding', return_value={'runner_sha256': '0' * 64, 'profile_sha256': '0' * 64}):
                with self.assertRaisesRegex(AdmissionError, 'PROFILE_CHANGED_DURING_ADMISSION'):
                    m.base.Lane(Path(temp) / 'never')
                self.assertFalse((Path(temp) / 'never').exists())

    def test_18_optimized_python_refused_before_allocation(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'never'
            child = subprocess.run([sys.executable, '-O', str(a.ROOT / 'scripts/run-acl02-pg-only.py'),
                                    '--run-directory', str(out)], capture_output=True)
            self.assertEqual(child.returncode, 2)
            self.assertIn(b'OPTIMIZED_PYTHON_NOT_ADMITTED', child.stdout)
            self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
