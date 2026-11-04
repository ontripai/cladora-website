"""Only new port/continuation controls; synthetic sockets, no backend/SQL/Auth."""
from contextlib import contextmanager
from copy import deepcopy
import errno
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import socket
import socketserver
import struct
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import port_admission as ports
import recovery as r


def spec(port):
    return dict(host='127.0.0.1', port=port, backlog=5)


class SocketAdmissionTests(unittest.TestCase):
    def test_actual_stdlib_defaults_and_options_match(self):
        for cls in [ThreadingHTTPServer, socketserver.ThreadingTCPServer]:
            self.assertEqual(cls.address_family, socket.AF_INET)
            self.assertEqual(cls.socket_type, socket.SOCK_STREAM)
            self.assertEqual(cls.request_queue_size, 5)
            self.assertFalse(cls.allow_reuse_port)
        self.assertEqual(ThreadingHTTPServer.allow_reuse_address, 1)
        with ports.listeners([spec(0)]) as held:
            self.assertEqual(held[0].family, socket.AF_INET)
            self.assertEqual(held[0].getsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR), 1)
            self.assertEqual(held[0].getsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT), 0)
            self.assertEqual(held[0].getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN), 1)

    def test_TIME_WAIT_before_fails_after_matches_real_bind_listen(self):
        # Real kernel counterexample, unrelated ephemeral localhost port. Server
        # closes first, receives peer FIN, and owns TIME_WAIT. No subprocess/DB.
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(('127.0.0.1', 0)); server.listen(5)
        port = server.getsockname()[1]
        client = socket.socket(); client.settimeout(2)
        peer = None
        try:
            client.connect(('127.0.0.1', port)); peer, _ = server.accept()
            peer.settimeout(2)
            peer.shutdown(socket.SHUT_WR)
            self.assertEqual(client.recv(1), b'')
            client.shutdown(socket.SHUT_WR)
            self.assertEqual(peer.recv(1), b'')
        finally:
            if peer is not None: peer.close()
            client.close(); server.close()
        with socket.socket() as predecessor:
            with self.assertRaises(OSError) as before:
                predecessor.bind(('127.0.0.1', port))
            self.assertEqual(before.exception.errno, errno.EADDRINUSE)
        with ports.listeners([spec(port)]) as after:
            self.assertEqual(after[0].getsockname()[1], port)
            self.assertEqual(after[0].getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN), 1)

    def test_active_listener_still_rejected_with_exact_error_fields(self):
        with ports.listeners([spec(0)]) as active:
            port = active[0].getsockname()[1]
            with self.assertRaises(ports.PortFailure) as failure:
                ports.wait_admission([spec(port)], 0, lambda: None)
            self.assertEqual(failure.exception.detail['stage'], 'probe.bind')
            self.assertEqual(failure.exception.detail['host'], '127.0.0.1')
            self.assertEqual(failure.exception.detail['port'], port)
            self.assertEqual(failure.exception.detail['errno'], errno.EADDRINUSE)

    def test_second_port_collision_closes_all_probes_then_first_rebinds(self):
        held_probe_sockets = []
        real = socket.socket
        with ports.listeners([spec(0)]) as active:
            second = active[0].getsockname()[1]
            with real() as finder:
                finder.bind(('127.0.0.1', 0)); first = finder.getsockname()[1]
            def make(*args, **kwargs):
                sock = real(*args, **kwargs); held_probe_sockets.append(sock); return sock
            with patch.object(ports.socket, 'socket', side_effect=make):
                with self.assertRaises(ports.PortFailure) as failure:
                    with ports.listeners([spec(first), spec(second)]):
                        self.fail('second collision cannot admit')
            self.assertEqual(failure.exception.detail['port'], second)
            self.assertEqual(len(held_probe_sockets), 2)
            self.assertTrue(all(sock.fileno() == -1 for sock in held_probe_sockets))
            with ports.listeners([spec(first)]): pass

    def test_release_polling_has_deadline_and_keeps_first_obstruction(self):
        first = ports.PortFailure('probe.bind', '127.0.0.1', 1, errno.EADDRINUSE, 'first')
        later = ports.PortFailure('probe.bind', '127.0.0.1', 2, errno.EADDRINUSE, 'later')
        with patch.object(ports, 'listeners', side_effect=[first, later]):
            with self.assertRaises(ports.PortFailure) as failure:
                ports.wait_admission([spec(1), spec(2)], 1, lambda: None,
                    clock=iter([0, .5, 1]).__next__, pause=lambda _: None)
        self.assertIs(failure.exception, first)
        self.assertEqual(first.last_detail['port'], 2)
        self.assertTrue(first.deadline_exhausted)

    def test_non_collision_error_stops_without_poll_retry(self):
        failure = ports.PortFailure('probe.bind', '127.0.0.1', 1, errno.EACCES, 'denied')
        with patch.object(ports, 'listeners', side_effect=failure) as listen:
            with self.assertRaises(ports.PortFailure):
                ports.wait_admission([spec(1)], 10, lambda: None)
        self.assertEqual(listen.call_count, 1)

    def test_expiry_during_release_stops_without_creation(self):
        failure = ports.PortFailure('probe.bind', '127.0.0.1', 1, errno.EADDRINUSE, 'busy')
        current = MagicMock(side_effect=[None, RuntimeError('REQUEST_EXPIRED')])
        with patch.object(ports, 'listeners', side_effect=failure):
            with self.assertRaisesRegex(RuntimeError, 'REQUEST_EXPIRED'):
                ports.wait_admission([spec(1)], 10, current,
                                     clock=iter([0, 1]).__next__, pause=lambda _: None)

    def test_all_probe_closes_attempted_primary_preserved_and_no_poll_retry(self):
        first, second = MagicMock(), MagicMock()
        first.getsockopt.return_value = second.getsockopt.return_value = 0
        primary = OSError(errno.EADDRINUSE, 'second busy')
        second.bind.side_effect = primary
        second.close.side_effect = OSError(errno.EIO, 'close unknown')
        with patch.object(ports.socket, 'socket', side_effect=[first, second]):
            with self.assertRaises(ports.PortFailure) as failure:
                ports.wait_admission([spec(1), spec(2)], 10, lambda: None)
        first.close.assert_called_once(); second.close.assert_called_once()
        self.assertEqual(failure.exception.detail['errno'], errno.EADDRINUSE)
        self.assertEqual(failure.exception.probe_cleanup_errors[0]['errno'], errno.EIO)

    def test_probe_success_after_release_deadline_is_not_admitted(self):
        with patch.object(ports, 'listeners', no_network):
            with self.assertRaisesRegex(ports.PortFailure, 'DEADLINE_EXHAUSTED'):
                ports.wait_admission([spec(1)], 10, lambda: None,
                                     clock=iter([0, 11, 11]).__next__)

    def test_close_only_failure_identifies_actual_socket_not_last_port(self):
        first, second = MagicMock(), MagicMock()
        first.getsockopt.return_value = second.getsockopt.return_value = 0
        first.close.side_effect = OSError(errno.EIO, 'first close unknown')
        with patch.object(ports.socket, 'socket', side_effect=[first, second]):
            with self.assertRaises(ports.PortFailure) as failure:
                with ports.listeners([spec(1), spec(2)]): pass
        self.assertEqual(failure.exception.detail['stage'], 'probe.close')
        self.assertEqual(failure.exception.detail['port'], 1)
        first.close.assert_called_once(); second.close.assert_called_once()

    def test_later_close_failure_preserved_with_first_bind_error(self):
        first = ports.PortFailure('probe.bind', '127.0.0.1', 1, errno.EADDRINUSE, 'first')
        later = ports.PortFailure('probe.bind', '127.0.0.1', 2, errno.EADDRINUSE, 'later')
        later.probe_cleanup_errors = [{'port': 2, 'errno': errno.EIO}]
        with patch.object(ports, 'listeners', side_effect=[first, later]):
            with self.assertRaises(ports.PortFailure) as failure:
                ports.wait_admission([spec(1), spec(2)], 1, lambda: None,
                    clock=iter([0, .5, .6]).__next__, pause=lambda _: None)
        self.assertIs(failure.exception, first)
        self.assertEqual(first.probe_cleanup_errors[0]['errno'], errno.EIO)


def request():
    return dict(contract='platform17.relay-port-recovery-request.v1', run_id='b'*32,
        issued_at_unix=100, expires_at_unix=200,
        controller=dict(commit='c'*40, tree='d'*40, seal_file_sha256='e'*64),
        app_root='/synthetic/app', activation_binding_sha256='f'*64,
        prior=dict(claim_sha256='1'*64, result_sha256='2'*64,
                   gateway_record_sha256=r.sha(b'historical')),
        backend=dict(synthetic='NOT_A_NATIVE_TARGET'))


def history():
    req = request()
    binding = dict(run_id='a'*32, backend=req['backend'])
    claim = dict(run_id=binding['run_id'], binding_sha256=req['activation_binding_sha256'],
        relay_seal_sha256=r.PROFILE['relay_seal_file_sha256'], backend=req['backend'],
        old_record_sha256=r.sha(b'historical'))
    result = dict(state='FAILED_OR_UNKNOWN_STOP', new_start='NOT_RUN',
        old_stop='ACK_PROCESS_ENDED', cleanup='NOT_REQUIRED',
        first_error='OSError:[Errno 98] Address already in use')
    return req, binding, claim, result


class BindingTests(unittest.TestCase):
    def test_exact_pre_create_history_positive_without_relabeling_prior(self):
        values = history(); before = deepcopy(values)
        r.prior_eligible(*values, b'historical', b'historical')
        self.assertEqual(values, before)

    def test_unknown_attempted_cleanup_or_wrong_prior_first_error_denied(self):
        for key, value in [('new_start', 'UNKNOWN'), ('new_start', 'ATTEMPTED'),
                           ('old_stop', 'UNKNOWN'), ('cleanup', 'UNKNOWN'),
                           ('first_error', 'some other failure')]:
            with self.subTest(key=key, value=value):
                values = history(); values[3][key] = value
                with self.assertRaisesRegex(RuntimeError, 'PRIOR_NOT_PROVEN'):
                    r.prior_eligible(*values, b'historical', b'historical')

    def test_target_binding_reused_run_or_changed_history_denied(self):
        for kind in ['target', 'binding', 'run', 'history']:
            with self.subTest(kind=kind):
                req, binding, claim, result = history()
                if kind == 'target': req['backend'] = {'foreign': True}
                if kind == 'binding': req['activation_binding_sha256'] = '9'*64
                if kind == 'run': req['run_id'] = binding['run_id']
                archived = b'drift' if kind == 'history' else b'historical'
                with self.assertRaises(RuntimeError):
                    r.prior_eligible(req, binding, claim, result, b'historical', archived)

    def test_request_currentness_boundary_and_self_approval_denied(self):
        r.request_shape(request(), 150)
        for now in [99, 200, 201]:
            with self.subTest(now=now), self.assertRaisesRegex(RuntimeError, 'WINDOW'):
                r.request_shape(request(), now)
        req = request(); req['approved'] = True
        with self.assertRaisesRegex(RuntimeError, 'EXACT_REQUEST_FIELDS'):
            r.request_shape(req, 150)

    def test_template_and_arbitrary_request_extensions_are_not_executable(self):
        for req in [json.loads((r.HERE/'request.template.json').read_text()),
                    {**request(), 'shell': 'arbitrary'},
                    {**request(), 'operation': 'activate'}]:
            with self.assertRaises(RuntimeError): r.request_shape(req, 150)

    def test_changed_controller_source_seal_and_inventory_denied(self):
        with self.assertRaisesRegex(RuntimeError, 'CONTROLLER_SEAL_CHANGED'):
            r.controller_sources('0'*64)
        with patch.object(r.HERE.__class__, 'iterdir', return_value=iter([])):
            with self.assertRaisesRegex(RuntimeError, 'INVENTORY_DRIFT'):
                r.controller_sources('0'*64)

    def test_other_app_source_rejected_before_import(self):
        with (patch.object(r, 'git_identity', side_effect=RuntimeError('SOURCE_COMMIT_TREE_MISMATCH')),
              patch.object(r.importlib.util, 'spec_from_file_location') as load):
            with self.assertRaisesRegex(RuntimeError, 'SOURCE_COMMIT_TREE_MISMATCH'):
                r.reviewed_relay(Path('/synthetic/app'))
            load.assert_not_called()


class FakeContext:
    """Test-only private fixture, never an executable native request/receipt."""
    def __init__(self, directory):
        self.root = Path(directory)/'owned-private'; self.root.mkdir(mode=0o700)
        self.base = self.root/'relay-cors-v2'; self.base.mkdir(mode=0o700)
        self.directory = self.base/'port-admission-recovery-v1'; self.directory.mkdir(mode=0o700)
        self.request = request(); self.expected = 'a'*64
        self.v2 = SimpleNamespace(HERE=Path('/synthetic/reviewed'), relay_environment=lambda: {},
            assert_ready=lambda _: {'ready': True, 'contract': r.PROFILE['relay_abi']})
        self.validate_calls = 0
    def current(self): pass
    def validate(self, before_create=False): self.validate_calls += 1
    def accept_child(self, child): return r.Context.accept_child(self, child)


@contextmanager
def no_network(_):
    yield []


class ContinuationTests(unittest.TestCase):
    def execution(self, ctx, popen, admission=None):
        from contextlib import ExitStack
        stack = ExitStack()
        stack.enter_context(patch.object(r, 'PRIVATE', ctx.root))
        stack.enter_context(patch.object(r, 'listeners', no_network))
        stack.enter_context(patch.object(r, 'wait_admission',
            side_effect=admission if isinstance(admission, BaseException) else None,
            return_value={'state': 'ADMITTED_NOT_STARTUP_ACK'}))
        stack.enter_context(patch.object(r.subprocess, 'Popen', side_effect=popen))
        return stack

    def child(self, ctx, *, wrong_pid=False):
        child = MagicMock(); child.pid = 42; child.poll.return_value = None
        r.write_new(ctx.base/'process.json', dict(pid=99 if wrong_pid else 42,
            start_ticks='synthetic-only', binding_sha256='f'*64,
            relay_seal_sha256=r.PROFILE['relay_seal_file_sha256'],
            listeners='BOTH_FIXED_LOOPBACK_SOCKETS_BOUND'))
        return child

    def test_positive_claim_receipt_one_use_and_history_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory)
            historical = ctx.base/'transition.result.json'
            historical.write_bytes(b'unchanged-prior-error')
            with self.execution(ctx, lambda *a, **k: self.child(ctx)):
                result = r.execute(ctx)
                self.assertEqual(result['state'], 'ACK_VERSIONED_RELAY_RUNNING_SAME_BACKEND')
                with self.assertRaisesRegex(RuntimeError, 'ALREADY_CONSUMED'):
                    r.execute(ctx)
            self.assertEqual(historical.read_bytes(), b'unchanged-prior-error')
            self.assertTrue((ctx.directory/'continuation.claim.json').is_file())
            self.assertEqual(json.loads((ctx.directory/'continuation.result.json').read_text()), result)

    def test_second_port_failure_creates_no_child_and_consumes_continuation(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory); count = []
            failure = ports.PortFailure('probe.bind', '127.0.0.1', 55421, errno.EADDRINUSE, 'busy')
            with self.execution(ctx, lambda *a, **k: count.append('forbidden'), failure):
                with self.assertRaises(ports.PortFailure): r.execute(ctx)
                with self.assertRaisesRegex(RuntimeError, 'ALREADY_CONSUMED'): r.execute(ctx)
            result = json.loads((ctx.directory/'continuation.result.json').read_text())
            self.assertEqual(count, []); self.assertEqual(result['new_start'], 'NOT_RUN')
            self.assertEqual(result['first_error']['port'], 55421)
            self.assertFalse((ctx.base/'process.private.log').exists())

    def test_collision_after_probe_no_child_ACK_and_no_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory); count = []
            def failed_start(*args, **kwargs):
                count.append(1)
                child = MagicMock(); child.pid = 42; child.poll.return_value = 1
                return child  # sealed real listener would exit, no process.json
            with self.execution(ctx, failed_start):
                with self.assertRaisesRegex(RuntimeError, 'EXITED_BEFORE_STARTUP_ACK'):
                    r.execute(ctx)
            result = json.loads((ctx.directory/'continuation.result.json').read_text())
            self.assertEqual(len(count), 1); self.assertNotIn('child_ack', result)
            self.assertEqual(result['cleanup'], 'SKIPPED_ALREADY_ENDED_OBSERVED')
            self.assertEqual(result['state'], 'FAILED_OR_UNKNOWN_STOP')

    def test_wrong_child_pid_record_not_ACK(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory)
            with self.execution(ctx, lambda *a, **k: self.child(ctx, wrong_pid=True)):
                with self.assertRaisesRegex(RuntimeError, 'REAL_TWO_LISTENER_CHILD_ACK_REQUIRED'):
                    r.execute(ctx)
            result = json.loads((ctx.directory/'continuation.result.json').read_text())
            self.assertEqual(result['cleanup'], 'ACK_OWN_CHILD_ENDED')
            self.assertNotIn('child_ack', result)

    def test_ack_validation_past_deadline_cannot_turn_into_success(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory)
            with (self.execution(ctx, lambda *a, **k: self.child(ctx)),
                  patch.object(r.time, 'monotonic', side_effect=[0, 1, 21])):
                with self.assertRaisesRegex(RuntimeError, 'STARTUP_ACK_UNKNOWN'):
                    r.execute(ctx)
            result = json.loads((ctx.directory/'continuation.result.json').read_text())
            self.assertNotIn('child_ack', result)
            self.assertEqual(result['cleanup'], 'ACK_OWN_CHILD_ENDED')

    def test_startup_timeout_primary_survives_cleanup_timeout(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory)
            child = MagicMock(); child.pid = 42; child.poll.return_value = None
            child.wait.side_effect = TimeoutError('cleanup-UNKNOWN')
            with self.execution(ctx, lambda *a, **k: child), patch.object(r.time, 'monotonic', side_effect=[0, 21]):
                with self.assertRaisesRegex(RuntimeError, 'STARTUP_ACK_UNKNOWN'):
                    r.execute(ctx)
            result = json.loads((ctx.directory/'continuation.result.json').read_text())
            self.assertEqual(result['first_error']['message'], 'STARTUP_ACK_UNKNOWN')
            self.assertEqual(result['cleanup'], 'UNKNOWN_PLATFORM_CUSTODY_NO_RETRY')
            self.assertEqual(result['cleanup_error']['type'], 'TimeoutError')
            self.assertEqual(result['custody']['owner'], 'Platform')

    def test_source_target_drift_after_probe_stops_before_popen(self):
        for code in ['SOURCE_CHANGED', 'TARGET_CHANGED', 'REQUEST_EXPIRED']:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as directory:
                ctx = FakeContext(directory); calls = []
                def validate(before_create=False):
                    calls.append(1)
                    if len(calls) == 2: raise RuntimeError(code)
                ctx.validate = validate
                with self.execution(ctx, lambda *a, **k: self.fail('no creation')):
                    with self.assertRaisesRegex(RuntimeError, code): r.execute(ctx)
                result = json.loads((ctx.directory/'continuation.result.json').read_text())
                self.assertEqual(result['new_start'], 'NOT_RUN')

    def test_receipt_failure_never_erases_startup_primary_or_reopens_claim(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory); child = MagicMock(); child.poll.return_value = 1
            writer = r.write_new
            def fail_result(path, value):
                if path.name == 'continuation.result.json': raise OSError(errno.ENOSPC, 'disk full')
                writer(path, value)
            with self.execution(ctx, lambda *a, **k: child), patch.object(r, 'write_new', side_effect=fail_result):
                with self.assertRaisesRegex(RuntimeError, 'EXITED_BEFORE_STARTUP_ACK'):
                    r.execute(ctx)
            self.assertTrue((ctx.directory/'continuation.claim.json').exists())

    def test_success_receipt_fsync_failure_is_not_ACK_and_cleans_only_created_child(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext(directory); created = []
            def spawn(*args, **kwargs):
                child = self.child(ctx); created.append(child); return child
            writer = r.write_new
            def fail_result(path, value):
                if path.name == 'continuation.result.json': raise OSError(errno.ENOSPC, 'receipt fsync failed')
                writer(path, value)
            with self.execution(ctx, spawn), patch.object(r, 'write_new', side_effect=fail_result):
                with self.assertRaises(OSError) as error: r.execute(ctx)
            self.assertEqual(error.exception.errno, errno.ENOSPC)
            self.assertEqual(error.exception.recovery_result['state'], 'UNKNOWN_RECEIPT_PERSISTENCE_NO_CONTINUATION')
            created[0].terminate.assert_called_once()
            self.assertTrue((ctx.directory/'continuation.claim.json').exists())


if __name__ == '__main__':
    unittest.main()
