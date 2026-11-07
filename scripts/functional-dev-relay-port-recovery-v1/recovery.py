#!/usr/bin/env python3
"""One reviewed manual continuation, not a replay of transition.activate.

No SQL, Docker lifecycle, Auth mutation, app stop/start, or alternative relay.
The request digest is integrity, never authority. Native use needs exact review
and owner execution authority outside this source packet.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import socketserver
import stat
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PRIVATE = Path('/workspace/private/cladora-functional-dev-v1')
sys.path.insert(0, str(HERE))
from port_admission import PortFailure, listeners, wait_admission

FILES = frozenset(('recovery.py', 'port_admission.py', 'profile.json',
                   'test_port_recovery.py', 'CONTRACT.md', 'request.template.json'))
PROFILE = json.loads((HERE / 'profile.json').read_text())
RELAY_FILES = frozenset(('CONTRACT.md', 'activation-binding.template.json',
                        'cors_policy.py', 'profile.json', 'relay_v2.py',
                        'sdk-source-pins.json', 'test_cors_v2.py', 'transition.py'))


def need(ok, code):
    if not ok:
        raise RuntimeError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def safe(path, private=False):
    need(path.is_absolute() and path.resolve() == path and not path.is_symlink(),
         'FILE_ALIAS_OR_SYMLINK')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
             before.st_size <= 2097152, 'FILE_TYPE_LINK_OR_BOUND')
        if private:
            need(before.st_uid == os.getuid() and not before.st_mode & 0o077,
                 'PRIVATE_FILE_CUSTODY')
            need(PRIVATE in path.parents, 'FOREIGN_PRIVATE_ROOT')
            for parent in path.parents:
                state = parent.stat()
                need(parent.resolve() == parent and state.st_uid == os.getuid()
                     and not state.st_mode & 0o077, 'PRIVATE_DIRECTORY_CUSTODY')
                if parent == PRIVATE:
                    break
        with os.fdopen(os.dup(fd), 'rb') as stream:
            raw = stream.read(before.st_size + 1)
        after = os.fstat(fd)
        need(len(raw) == before.st_size and
             (before.st_ino, before.st_mtime_ns, before.st_size) ==
             (after.st_ino, after.st_mtime_ns, after.st_size) and
             path.resolve() == path, 'FILE_CHANGED_DURING_READ')
        return raw
    finally:
        os.close(fd)


def write_new(path, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        need(os.write(fd, raw) == len(raw), 'PRIVATE_SHORT_WRITE')
        os.fsync(fd)
    finally:
        os.close(fd)
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def hexpin(value, length):
    need(isinstance(value, str) and re.fullmatch('[a-f0-9]{' + str(length) + '}', value)
         is not None, 'EXACT_PIN_REQUIRED')


def controller_sources(pin):
    hexpin(pin, 64)
    need(set(p.name for p in HERE.iterdir()) == FILES | {'source-seal.json'},
         'CONTROLLER_INVENTORY_DRIFT')
    raw = safe(HERE / 'source-seal.json')
    need(sha(raw) == pin, 'CONTROLLER_SEAL_CHANGED')
    seal = json.loads(raw)
    need(seal['contract'] == 'platform17.relay-port-recovery-source-seal.v1'
         and set(seal['files']) == FILES, 'CONTROLLER_SEAL_COMPLETENESS')
    need(sha(json.dumps(seal['files'], sort_keys=True, separators=(',', ':')).encode())
         == seal['sha256'], 'CONTROLLER_SEAL_ENCODING')
    for name, expected in seal['files'].items():
        need(sha(safe(HERE / name)) == expected, 'CONTROLLER_SOURCE_CHANGED')


def git_identity(root, commit, tree):
    need(root.is_dir() and root.resolve() == root, 'SOURCE_ROOT_ALIAS')
    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args],
                                       text=True, timeout=5).strip()
    need(git('rev-parse', 'HEAD') == commit and
         git('rev-parse', 'HEAD^{tree}') == tree, 'SOURCE_COMMIT_TREE_MISMATCH')
    need(not git('status', '--porcelain', '--untracked-files=all'), 'SOURCE_NOT_CLEAN')


def request_shape(request, now):
    need(set(request) == {'contract', 'run_id', 'issued_at_unix', 'expires_at_unix',
                         'controller', 'app_root', 'activation_binding_sha256',
                         'prior', 'backend'}, 'EXACT_REQUEST_FIELDS')
    need(request['contract'] == 'platform17.relay-port-recovery-request.v1',
         'REQUEST_ABI')
    hexpin(request['run_id'], 32)
    hexpin(request['activation_binding_sha256'], 64)
    need(set(request['controller']) == {'commit', 'tree', 'seal_file_sha256'},
         'CONTROLLER_PINS_REQUIRED')
    for field, length in [('commit', 40), ('tree', 40), ('seal_file_sha256', 64)]:
        hexpin(request['controller'][field], length)
    need(set(request['prior']) == {'claim_sha256', 'result_sha256',
                                  'gateway_record_sha256'}, 'PRIOR_PINS_REQUIRED')
    for pin in request['prior'].values():
        hexpin(pin, 64)
    issued, expires = request['issued_at_unix'], request['expires_at_unix']
    need(all(type(x) in (int, float) and math.isfinite(x) for x in (issued, expires))
         and issued <= now < expires and
         0 < expires - issued <= PROFILE['maximum_request_lifetime_seconds'],
         'REQUEST_EXPIRED_OR_INVALID_WINDOW')
    need(isinstance(request['app_root'], str) and
         isinstance(request['backend'], dict), 'REAL_APP_BACKEND_REQUIRED')


def reviewed_relay(root):
    """Fixed source/role; no selectable module, export, shell or callback."""
    git_identity(root, PROFILE['app_sha'], PROFILE['app_tree'])
    need(sha(safe(root / 'scripts/run-core-service-app-assembly-17.mjs')) ==
         PROFILE['launcher_sha256'], 'LAUNCHER_CHANGED')
    folder = root / 'scripts/functional-dev-relay-cors-v2'
    need(set(p.name for p in folder.iterdir()) == RELAY_FILES | {'source-seal.json'},
         'RELAY_INVENTORY_CHANGED')
    raw = safe(folder / 'source-seal.json')
    need(sha(raw) == PROFILE['relay_seal_file_sha256'], 'RELAY_SEAL_CHANGED')
    seal = json.loads(raw)
    need(set(seal['files']) == RELAY_FILES, 'RELAY_SEAL_COMPLETENESS')
    for name, pin in seal['files'].items():
        need(sha(safe(folder / name)) == pin, 'RELAY_SOURCE_CHANGED')
    profile = json.loads(safe(folder / 'profile.json'))
    for name, pin in profile['legacy_files'].items():
        need(sha(safe(root / 'scripts/functional-dev-stack-v1' / name)) == pin,
             'LEGACY_SOURCE_CHANGED')
    for name, pin in profile['environment_filter_files'].items():
        need(sha(safe(root / name)) == pin, 'ENVIRONMENT_FILTER_CHANGED')
    # The reviewed serve body sets the PG instance's allow_reuse_address=True.
    # The exact pinned source and actual stdlib HTTP/PG defaults are both used.
    need(sys.version_info[:2] == (3, 12), 'LISTENER_STDLIB_VERSION_CHANGED')
    need('cors_policy' not in sys.modules, 'UNEXPECTED_RELAY_IMPORT_NAMESPACE')
    spec = importlib.util.spec_from_file_location('reviewed_platform17_relay',
                                                folder / 'relay_v2.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.verify_sources(PROFILE['relay_seal_file_sha256'])
    for cls in [module.ThreadingHTTPServer, socketserver.ThreadingTCPServer]:
        need(cls.address_family == module.socket.AF_INET and
             cls.socket_type == module.socket.SOCK_STREAM and
             cls.request_queue_size == 5 and not cls.allow_reuse_port,
             'LISTENER_SOCKET_DEFAULTS_CHANGED')
    need(module.ThreadingHTTPServer.allow_reuse_address == 1,
         'HTTP_REUSEADDR_CHANGED')
    return module


def prior_eligible(request, binding, claim, result, original, archived):
    """A signed-off NOT_RUN pre-create failure is not UNKNOWN/partial startup."""
    need(result.get('state') == 'FAILED_OR_UNKNOWN_STOP' and
         result.get('new_start') == 'NOT_RUN' and
         result.get('old_stop') == 'ACK_PROCESS_ENDED' and
         result.get('cleanup') == 'NOT_REQUIRED' and
         result.get('first_error') == 'OSError:[Errno 98] Address already in use',
         'PRIOR_NOT_PROVEN_PRE_CREATE_NOT_RUN')
    need(request['run_id'] != binding['run_id'] and
         claim['run_id'] == binding['run_id'], 'FRESH_CONTINUATION_RUN_REQUIRED')
    need(claim['binding_sha256'] == request['activation_binding_sha256'] and
         claim['relay_seal_sha256'] == PROFILE['relay_seal_file_sha256'] and
         claim['backend'] == binding['backend'] == request['backend'],
         'PRIOR_TARGET_OR_BINDING_MISMATCH')
    need(original == archived and sha(original) == claim['old_record_sha256'] ==
         request['prior']['gateway_record_sha256'], 'PRIOR_HISTORY_CHANGED')


def no_live_v2_child():
    # The sealed creator's child is the same OS actor and exact relay_v2.py serve
    # argv. Inspect all owned processes; unreadable owned cmdline is UNKNOWN.
    # Do not signal anything discovered here.
    for item in Path('/proc').iterdir():
        if not item.name.isdigit():
            continue
        try:
            if item.stat().st_uid != os.getuid():
                continue
            state = (item / 'stat').read_text().split(') ', 1)[1].split()[0]
            argv = (item / 'cmdline').read_bytes().split(b'\0')[:-1]
            matching = any(arg.endswith(b'/relay_v2.py') for arg in argv) and b'serve' in argv
            need(not (matching and state != 'Z'), 'V2_CHILD_ALREADY_PRESENT')
        except FileNotFoundError:
            continue  # exited during observation; never a new-start ACK
        except PermissionError as error:
            raise RuntimeError('OWNED_PROCESS_INVENTORY_UNKNOWN') from error


class Context:
    def __init__(self, expected):
        hexpin(expected, 64)
        self.expected = expected
        self.request_path = PRIVATE / PROFILE['request_selector']
        self.raw = safe(self.request_path, True)
        need(sha(self.raw) == expected, 'REQUEST_DIGEST_MISMATCH')
        self.request = json.loads(self.raw)
        self.current()
        pins = self.request['controller']
        controller_sources(pins['seal_file_sha256'])
        git_identity(ROOT, pins['commit'], pins['tree'])
        self.v2 = reviewed_relay(Path(self.request['app_root']))
        self.directory = self.request_path.parent
        self.base = self.directory.parent
        need(not os.path.lexists(self.directory / 'continuation.claim.json'),
             'CONTINUATION_ALREADY_CONSUMED_NO_RETRY')
        self.validate(before_create=True)

    def current(self):
        need(safe(self.request_path, True) == self.raw, 'REQUEST_CHANGED')
        request_shape(self.request, time.time())

    def validate(self, before_create=False):
        self.current()
        pins = self.request['controller']
        controller_sources(pins['seal_file_sha256'])
        git_identity(ROOT, pins['commit'], pins['tree'])
        git_identity(Path(self.request['app_root']), PROFILE['app_sha'], PROFILE['app_tree'])
        self.v2.verify_sources(PROFILE['relay_seal_file_sha256'])
        self.legacy, self.binding = self.v2.load_binding(
            self.request['activation_binding_sha256'])
        need(self.binding['app'] == dict(root=self.request['app_root'],
             sha=PROFILE['app_sha'], tree=PROFILE['app_tree'],
             launcher_sha256=PROFILE['launcher_sha256']) and
             self.binding['Core_install_base'] == PROFILE['Core_install_base'] and
             self.binding['backend'] == self.request['backend'],
             'CONTINUATION_TARGET_OR_APP_MISMATCH')
        raws = {}
        for name, key in [('transition.claim.json', 'claim_sha256'),
                          ('transition.result.json', 'result_sha256')]:
            raws[name] = safe(self.base / name, True)
            need(sha(raws[name]) == self.request['prior'][key], 'PRIOR_RECEIPT_CHANGED')
        original = safe(PRIVATE / 'gateway-process.json', True)
        archived = safe(self.base / 'prior-gateway-process.json', True)
        prior_eligible(self.request, self.binding, json.loads(raws['transition.claim.json']),
                       json.loads(raws['transition.result.json']), original, archived)
        old = json.loads(original)
        if (Path('/proc') / str(old['pid'])).exists():
            actual = self.v2.process_identity(old['pid'])
            need(actual['ticks'] == old['start_ticks'] and actual['state'] == 'Z',
                 'LEGACY_RELAY_NOT_PROVEN_ENDED')
        if before_create:
            for name in ['process.json', 'process.private.log']:
                need(not os.path.lexists(self.base / name), 'NEW_START_ARTIFACT_PRESENT')
            no_live_v2_child()
        self.current()

    def accept_child(self, child):
        need(child.poll() is None, 'NEW_CHILD_ENDED_NO_STARTUP_ACK')
        self.validate()
        ready = self.v2.assert_ready(self.request['activation_binding_sha256'])
        record = json.loads(safe(self.base / 'process.json', True))
        need(record['pid'] == child.pid and
             record['listeners'] == 'BOTH_FIXED_LOOPBACK_SOCKETS_BOUND',
             'REAL_TWO_LISTENER_CHILD_ACK_REQUIRED')
        need(child.poll() is None, 'CHILD_EXITED_DURING_ACK')
        return dict(ready=ready, pid=record['pid'], start_ticks=record['start_ticks'],
                    binding_sha256=record['binding_sha256'],
                    relay_seal_sha256=record['relay_seal_sha256'])


def detail(error, stage):
    if isinstance(error, PortFailure):
        return dict(type=type(error).__name__, **error.detail,
                    last_observation=getattr(error, 'last_detail', None),
                    deadline_exhausted=getattr(error, 'deadline_exhausted', False),
                    probe_cleanup_errors=getattr(error, 'probe_cleanup_errors', None))
    return dict(type=type(error).__name__, stage=stage, message=str(error),
                host=None, port=None, errno=getattr(error, 'errno', None),
                probe_cleanup_errors=getattr(error, 'probe_cleanup_errors', None))


def cleanup_child(child, result):
    if child is None:
        return
    try:
        if child.poll() is None:
            result['cleanup'] = 'ATTEMPTED_ONLY_ACTUAL_POPEN_CHILD'
            child.terminate()
            child.wait(timeout=PROFILE['child_cleanup_deadline_seconds'])
            result['cleanup'] = 'ACK_OWN_CHILD_ENDED'
        else:
            result['cleanup'] = 'SKIPPED_ALREADY_ENDED_OBSERVED'
    except BaseException as cleanup:
        result['cleanup'] = 'UNKNOWN_PLATFORM_CUSTODY_NO_RETRY'
        result['cleanup_error'] = detail(cleanup, 'cleanup.own_child')
        result['custody'] = dict(owner='Platform', follow_up_seconds=600,
            pid=child.pid,
            scope='reconcile only actual Popen child; no substitute or fallback')


def execute(context):
    """Source-only until reviewed. One claim, at most one Popen, no fallback."""
    claim = context.directory / 'continuation.claim.json'
    context.current()
    need(not os.path.lexists(claim), 'CONTINUATION_ALREADY_CONSUMED_NO_RETRY')
    context.validate(before_create=True)
    # O_EXCL, including after failure/expiry: another request/run cannot replay.
    write_new(claim, dict(contract='platform17.relay-port-continuation-claim.v1',
              run_id=context.request['run_id'], request_sha256=context.expected,
              prior=context.request['prior'], backend=context.request['backend'],
              activation_binding_sha256=context.request['activation_binding_sha256'],
              state='CONSUMED_ONE_MANUAL_CONTINUATION_NO_RETRY'))
    result = dict(state='CLAIMED', first_error=None, cleanup_error=None,
                  persistence_error=None, admission='NOT_RUN', new_start='NOT_RUN',
                  cleanup='NOT_REQUIRED_NO_CHILD', rollback='NOT_APPLICABLE',
                  prior_result='UNCHANGED_PRE_CREATE_FAILURE_NOT_RELABELED')
    stage, primary, child = 'port.release', None, None
    try:
        # App is already stopped; the controller never kills or restarts it.
        with listeners([dict(host='127.0.0.1', port=3008, backlog=5)]):
            context.current()
        result['admission'] = wait_admission(PROFILE['listeners_in_server_order'],
            PROFILE['port_release_deadline_seconds'], context.current)
        stage = 'creation.guard'
        context.validate(before_create=True)
        env = context.v2.relay_environment()  # pinned existing F01 filter
        context.current()
        log = os.open(context.base / 'process.private.log',
                      os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            context.current()
            stage = 'creation.Popen'
            result['new_start'] = 'ATTEMPTED'
            child = subprocess.Popen([sys.executable, '-I', '-B',
                str(context.v2.HERE / 'relay_v2.py'), 'serve',
                context.request['activation_binding_sha256']], env=env,
                stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                start_new_session=True)
            result['child_pid'] = child.pid
        finally:
            os.close(log)
        stage = 'startup.real_two_listener_ACK'
        deadline = time.monotonic() + PROFILE['startup_deadline_seconds']
        while not os.path.lexists(context.base / 'process.json'):
            context.current()
            code = child.poll()
            if code is not None:
                result['child_exit_code'] = code
                raise RuntimeError('NEW_CHILD_EXITED_BEFORE_STARTUP_ACK')
            need(time.monotonic() < deadline, 'STARTUP_ACK_UNKNOWN')
            time.sleep(.1)
        need(time.monotonic() < deadline, 'STARTUP_ACK_UNKNOWN')
        ack = context.accept_child(child)
        need(time.monotonic() < deadline, 'STARTUP_ACK_UNKNOWN')
        result['child_ack'] = ack
        result.update(state='ACK_VERSIONED_RELAY_RUNNING_SAME_BACKEND',
                      new_start='ACK_BOTH_REAL_LISTENERS_PID_TICKS_ARGV_SOURCE_BINDING')
    except BaseException as error:
        primary = error
        result.update(state='FAILED_OR_UNKNOWN_STOP', first_error=detail(error, stage))
        cleanup_child(child, result)
    # Even a failed result fsync must not erase first error or imply ready.
    try:
        write_new(context.directory / 'continuation.result.json', result)
    except BaseException as persistence:
        result['persistence_error'] = detail(persistence, 'receipt.persistence')
        if primary is None:
            primary = persistence
            result.update(state='UNKNOWN_RECEIPT_PERSISTENCE_NO_CONTINUATION',
                          first_error=detail(persistence, 'receipt.persistence'))
            cleanup_child(child, result)
        # The consumed claim remains. No overwrite/retry/secondary public log.
    if primary is not None:
        primary.recovery_result = result  # private in-process diagnostic only
        raise primary
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument('operation', choices=['continue-once'])
    parser.add_argument('request_sha256')
    args = parser.parse_args()
    try:
        result = execute(Context(args.request_sha256))
        print(json.dumps(dict(state=result['state'], ABI=PROFILE['relay_abi'])))
    except BaseException as error:
        print(json.dumps(dict(state='HOLD_OR_UNKNOWN_NO_RETRY', error=type(error).__name__)))
        sys.exit(1)
