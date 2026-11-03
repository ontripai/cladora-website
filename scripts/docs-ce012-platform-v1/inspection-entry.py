#!/usr/bin/env python3
"""Fixed offline entry launcher. No command/payload/approval-selected execution."""
import argparse
import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import stat
import subprocess
import sys
import time

HERE = Path(__file__).absolute().parent
SOURCE_MANIFEST = HERE.parents[1] / 'docs/testing/docs-ce012-inspection-entry-09.manifest.json'
POLICY_SHA = '869d44098bb9f63971d2339f1cf581ba6f5c14e8e16b7330712eb4ffee4b1ad2'
ENV = {'LANG': 'C.UTF-8', 'NODE_ENV': 'production', 'TZ': 'UTC'}
DENY = ('socket', 'socketpair', 'connect', 'bind', 'listen', 'accept', 'accept4',
        'sendto', 'sendmsg', 'sendmmsg', 'recvfrom', 'recvmsg', 'recvmmsg', 'shutdown',
        'setsockopt', 'getsockopt', 'io_uring_setup', 'io_uring_enter', 'io_uring_register')


class Stop(RuntimeError):
    pass


def must(value, reason):
    if not value:
        raise Stop(reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def policy():
    raw = (HERE / 'inspection-policy.v1.json').read_bytes()
    must(sha(raw) == POLICY_SHA, 'INSPECTION_POLICY_DRIFT')
    return json.loads(raw)


def canonical_dir(value):
    p = Path(value)
    must(p.is_absolute() and str(p.resolve()) == str(value) and not p.is_symlink(), 'INSPECTION_ROOT_ALIAS')
    s = p.stat()
    must(stat.S_ISDIR(s.st_mode) and s.st_uid == os.getuid() and not s.st_mode & 0o077, 'INSPECTION_PRIVATE_ROOT')
    return p


def read_pin(root, pin):
    p = Path(root)
    parts = pin['path'].split('/')
    must(parts and not pin['path'].startswith('/') and '\\' not in pin['path']
         and all(x and x not in ('.', '..') for x in parts), 'INSPECTION_RELATIVE_PIN')
    for name in parts:
        p = p / name
        must(not stat.S_ISLNK(p.lstat().st_mode), 'INSPECTION_SYMLINK')
    before = p.lstat()
    must(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size == pin['bytes'], 'INSPECTION_FILE_ALIAS_SIZE')
    fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        initial = os.fstat(fd)
        must((initial.st_dev, initial.st_ino) == (before.st_dev, before.st_ino), 'INSPECTION_OPEN_DRIFT')
        with os.fdopen(fd, 'rb', closefd=False) as stream:
            raw = stream.read(pin['bytes'] + 1)
        after = os.fstat(fd)
        must((initial.st_mtime_ns, initial.st_ctime_ns, initial.st_size, 1) ==
             (after.st_mtime_ns, after.st_ctime_ns, after.st_size, after.st_nlink), 'INSPECTION_READ_DRIFT')
        must(len(raw) == pin['bytes'] and sha(raw) == pin['sha256'], 'INSPECTION_PIN_DRIFT')
        return raw
    finally:
        os.close(fd)


def material_plan(scope, p):
    scope = canonical_dir(scope)
    receipt = scope / 'materialization.private.json'
    s = receipt.lstat()
    must(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and not s.st_mode & 0o077 and s.st_size < 1024 * 1024, 'INSPECTION_MATERIAL_RECEIPT')
    data = json.loads(receipt.read_bytes())
    must(set(data) == {'format','consumer_source','inventory_entries','producer_esm','metadata_files','runtime_files',
                      'materialization_seal','material_files','material_bytes','source_seal','policy_sha256',
                      'before_after_source_drift','destination_readback','verifyMaterials','runtime_binding','registry','execution'}, 'INSPECTION_RECEIPT_FIELDS')
    files = data['material_files']
    must(data['consumer_source'] == p['consumer_source'] and len(files) == p['material_files']
         and sha(canonical(files)) == p['materialization_seal'] and sum(x['bytes'] for x in files) == p['material_bytes'], 'INSPECTION_MATERIAL_IDENTITY')
    root = canonical_dir(str(scope / 'consumer-source'))
    seen, inodes = set(), set()
    for pin in files:
        must(set(pin) == {'path','bytes','sha256'} and pin['path'] not in seen, 'INSPECTION_MATERIAL_PIN_SHAPE')
        seen.add(pin['path'])
        read_pin(root, pin)
        s = (root / pin['path']).lstat()
        must((s.st_dev, s.st_ino) not in inodes and s.st_mode & 0o777 == 0o400, 'INSPECTION_MATERIAL_ALIAS_MODE')
        inodes.add((s.st_dev, s.st_ino))
    actual = set()
    for x in root.rglob('*'):
        must(not x.is_symlink(), 'INSPECTION_SYMLINK')
        if not x.is_dir(): actual.add(str(x.relative_to(root)))
    must(actual == seen, 'INSPECTION_MATERIAL_EXTRA')
    for pin in p['pins']:
        read_pin(root, pin)
    return root


def check_environment(env):
    must(not any(k in ('NODE_OPTIONS','NODE_PATH','LD_PRELOAD','LD_AUDIT','PYTHONPATH','PYTHONHOME','BASH_ENV','ENV')
                 or k.startswith(('DOCS_CE012_', 'TS_NODE_')) for k in env), 'INSPECTION_ENV_INJECTION')


def source_pins():
    value = json.loads(SOURCE_MANIFEST.read_bytes())['inspection_source_seal']
    names = ['inspection-entry.py','inspection-gate.mjs','inspection-policy.v1.json']
    must(set(value['files']) == set(names) and sha(canonical(value['files'])) == value['sha256'], 'INSPECTION_WRAPPER_SEAL')
    for name in names:
        f = HERE / name
        must(not f.is_symlink() and sha(f.read_bytes()) == value['files'][name], 'INSPECTION_WRAPPER_DRIFT')
    return value


def parser(internal=False):
    q = argparse.ArgumentParser(allow_abbrev=False)
    q.add_argument('--materials', required=True)
    q.add_argument('--run-directory', required=True)
    if internal:
        q.add_argument('--kernel-child', action='store_true', required=True)
        q.add_argument('--control-fd', type=int, required=True)
    return q


def tool_pins(p):
    must(os.uname().machine == 'x86_64' and sys.platform == 'linux', 'INSPECTION_KERNEL_ARCH')
    for item in p['tools'].values():
        f = Path(item['path'])
        must(str(f.resolve()) == item['path'] and not f.is_symlink() and sha(f.read_bytes()) == item['sha256'], 'INSPECTION_TOOL_DRIFT_ALIAS')
    must(str(Path(sys.executable).resolve()) == p['tools']['python']['path'], 'INSPECTION_PYTHON_IDENTITY')


def kernel_state():
    lines = Path('/proc/self/status').read_text().splitlines()
    return {k: int(next(x.split(':', 1)[1] for x in lines if x.startswith(k + ':')).strip())
            for k in ('NoNewPrivs','Seccomp','Seccomp_filters')}


def lock_network(p):
    before = kernel_state()
    libc = ctypes.CDLL(None, use_errno=True)
    must(libc.prctl(38, 1, 0, 0, 0) == 0, 'INSPECTION_NO_NEW_PRIVS_FAILED')
    lib = ctypes.CDLL(p['tools']['seccomp']['path'], use_errno=True)
    lib.seccomp_init.argtypes = [ctypes.c_uint32]; lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]; lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
    lib.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    lib.seccomp_load.argtypes = [ctypes.c_void_p]; lib.seccomp_release.argtypes = [ctypes.c_void_p]
    ctx = lib.seccomp_init(0x7fff0000)
    must(ctx, 'INSPECTION_SECCOMP_INIT')
    try:
        for name in DENY:
            nr = lib.seccomp_syscall_resolve_name(name.encode())
            must(nr >= 0 and lib.seccomp_rule_add(ctx, 0x50000 | errno.EPERM, nr, 0) == 0, 'INSPECTION_SECCOMP_RULE')
        must(lib.seccomp_load(ctx) == 0, 'INSPECTION_SECCOMP_LOAD')
    finally:
        lib.seccomp_release(ctx)
    after = kernel_state()
    must(after['NoNewPrivs'] == 1 and after['Seccomp'] == 2 and after['Seccomp_filters'] > before['Seccomp_filters'], 'INSPECTION_KERNEL_ACK')
    denied = []
    for family in (1, 2, 10):
        ctypes.set_errno(0)
        fd = libc.socket(family, 1, 0)
        error = ctypes.get_errno()
        if fd >= 0:
            os.close(fd)
        must(fd == -1 and error == errno.EPERM, 'INSPECTION_KERNEL_SOCKET_NOT_DENIED')
        denied.append({'family': family, 'errno': error})
    return {'pid': os.getpid(), 'before': before, 'after': after, 'denied_socket_probes': denied, 'network_bytes_sent': 0}


def node_argv(root, scope, p):
    gate = str(HERE / 'inspection-gate.mjs')
    reads = [str(root), str(Path(scope) / 'materialization.private.json'), gate,
             str(HERE / 'inspection-policy.v1.json'), p['tools']['node']['path'], '/proc/self/status']
    reads.append(str(SOURCE_MANIFEST))
    return [p['tools']['node']['path'], '--permission', '--no-addons', *['--allow-fs-read=' + x for x in reads],
            '--import', gate, str(root / p['entry']), p['mode']]


def kernel_child(args, p):
    must(dict(os.environ) == ENV, 'INSPECTION_CHILD_ENV_INJECTION')
    scope = canonical_dir(args.materials); root = material_plan(str(scope), p)
    must(Path.cwd() == canonical_dir(args.run_directory), 'INSPECTION_CHILD_CWD')
    tool_pins(p)
    source_pins()
    must(args.control_fd > 2 and stat.S_ISFIFO(os.fstat(args.control_fd).st_mode), 'INSPECTION_CONTROL_FD')
    for name in os.listdir('/proc/self/fd'):
        try:
            os.fstat(int(name))
        except OSError:
            continue  # transient directory enumeration descriptor already closed
        must(int(name) in (0, 1, 2, args.control_fd), 'INSPECTION_INHERITED_FD')
    ack = lock_network(p)
    raw = canonical(ack) + b'\n'; must(os.write(args.control_fd, raw) == len(raw), 'INSPECTION_KERNEL_RECEIPT_WRITE')
    os.close(args.control_fd)
    os.execve(p['tools']['node']['path'], node_argv(root, scope, p), ENV)


def save(directory, name, raw):
    fd = os.open(directory / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        must(os.write(fd, raw) == len(raw), 'INSPECTION_RECEIPT_SHORT_WRITE'); os.fsync(fd)
    finally:
        os.close(fd)


def execute(args, p):
    must(sys.flags.isolated and sys.dont_write_bytecode, 'INSPECTION_ISOLATED_PYTHON_REQUIRED')
    check_environment(os.environ)
    tool_pins(p)
    source_pins()
    root = material_plan(args.materials, p)
    out = Path(args.run_directory)
    must(out.is_absolute() and not out.exists() and str(out.parent.resolve()) == str(out.parent), 'INSPECTION_FRESH_RUN_REQUIRED')
    out.mkdir(mode=0o700)
    rfd, wfd = os.pipe()
    receipt = {'format':'documents-ce012-original-inspection.v1','mode':p['mode'],'primary_error':None,
               'status':'NOT_RUN','cleanup':'NOT_RUN','runtime_binding':None,'registry':'EMPTY','live':'HOLD'}
    child = None; streams = {}; captures = {'stdout':bytearray(), 'stderr':bytearray(), 'kernel':bytearray()}
    try:
        command = [p['tools']['python']['path'], '-I', '-B', str(Path(__file__).absolute()), '--kernel-child',
                   '--materials',args.materials,'--run-directory',str(out),'--control-fd',str(wfd)]
        child = subprocess.Popen(command, cwd=out, env=ENV, stdin=subprocess.DEVNULL, close_fds=True,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, pass_fds=(wfd,), start_new_session=True)
        os.close(wfd); wfd = -1
        streams = {child.stdout:'stdout',child.stderr:'stderr',os.fdopen(rfd, 'rb', buffering=0):'kernel'}; rfd = -1
        deadline = time.monotonic() + p['deadline_seconds']
        with selectors.DefaultSelector() as sel:
            for stream in streams: sel.register(stream, selectors.EVENT_READ)
            while sel.get_map():
                must(time.monotonic() < deadline, 'INSPECTION_TIMEOUT_UNKNOWN')
                for key, _ in sel.select(min(0.1, max(0, deadline-time.monotonic()))):
                    raw = os.read(key.fileobj.fileno(), 8192)
                    if not raw: sel.unregister(key.fileobj); continue
                    data = captures[streams[key.fileobj]]
                    must(len(data)+len(raw) <= p['stream_bytes'], 'INSPECTION_OUTPUT_BOUND_UNKNOWN'); data.extend(raw)
        receipt['exit_code'] = child.wait(timeout=max(0.01, deadline-time.monotonic()))
        if receipt['exit_code'] != 0:
            candidates = []
            for raw in [captures['stdout'], *captures['stderr'].splitlines()]:
                try:
                    detail = json.loads(raw)
                    if isinstance(detail, dict): candidates.append(detail)
                except (ValueError, UnicodeError):
                    pass
            reason = next((x['code'] for x in candidates if isinstance(x.get('code'), str)
                           and len(x['code']) < 120 and all(c.isupper() or c.isdigit() or c == '_' for c in x['code'])), None)
            if captures['kernel']:
                receipt['kernel'] = json.loads(captures['kernel'])
            if candidates: receipt['rejection'] = candidates[0]
            raise Stop(reason or 'INSPECTION_ENTRY_EXIT_NONZERO')
        kernel = json.loads(captures['kernel']); receipt['kernel'] = kernel
        must(kernel['pid'] == child.pid, 'INSPECTION_KERNEL_PID_MISMATCH')
        receipt['stdout'] = {'bytes':len(captures['stdout']),'sha256':sha(captures['stdout'])}
        receipt['stderr'] = {'bytes':len(captures['stderr']),'sha256':sha(captures['stderr'])}
        must(receipt['exit_code'] == 0, 'INSPECTION_ENTRY_EXIT_NONZERO')
        actual = json.loads(captures['stdout']); must(actual == p['expected_stdout'], 'INSPECTION_ORIGINAL_OUTPUT_MISMATCH')
        events = [json.loads(x) for x in captures['stderr'].decode().splitlines()]
        must(len(events) == 1 and events[0]['event'] == 'INSPECTION_EXIT' and events[0]['result'] == 'PASS'
             and events[0]['pid'] == child.pid and events[0]['loaded'] == ['admission.mjs','closure.mjs','run.mjs'], 'INSPECTION_GATE_EVIDENCE')
        must(events[0]['kernel']['Seccomp_filters'] >= kernel['after']['Seccomp_filters'], 'INSPECTION_KERNEL_INHERITANCE')
        receipt['gate'] = events[0]; receipt['original_stdout'] = actual
        receipt['status'] = 'PASS_ORIGINAL_OFFLINE_INSPECT_ONLY'
    except Exception as error:
        receipt['primary_error'] = str(error) if isinstance(error, Stop) else 'INSPECTION_UNKNOWN_' + type(error).__name__
        receipt['status'] = 'FAILED_OR_UNKNOWN'
    finally:
        try:
            if child and child.poll() is None: os.killpg(child.pid, signal.SIGKILL)
            if child: child.wait(timeout=p['cleanup_seconds'])
            for stream in streams: stream.close()
            if rfd >= 0: os.close(rfd)
            if wfd >= 0: os.close(wfd)
            receipt['cleanup'] = 'ACKNOWLEDGED_PROCESS_EXIT_PIPES_CLOSED' if child else 'UNKNOWN_PROCESS_CREATION_ACK'
            if not child:
                receipt['primary_error'] = receipt['primary_error'] or 'INSPECTION_CREATE_UNKNOWN'
                receipt['status'] = 'FAILED_OR_UNKNOWN'
        except Exception:
            receipt['cleanup'] = 'UNKNOWN'; receipt['primary_error'] = receipt['primary_error'] or 'INSPECTION_CLEANUP_UNKNOWN'
            receipt['status'] = 'FAILED_OR_UNKNOWN'
        for name, raw in captures.items(): save(out, name + '.private.log', raw)
        save(out, 'receipt.private.json', json.dumps(receipt,indent=2).encode()+b'\n')
    return receipt


def main():
    internal = '--kernel-child' in sys.argv[1:]
    args = parser(internal).parse_args(); p = policy()
    if internal:
        kernel_child(args, p)
    else:
        result = execute(args, p)
        print(json.dumps({'status':result['status'],'primary_error':result['primary_error'],'cleanup':result['cleanup'],'live':'HOLD'}))
        return 0 if result['status'] == 'PASS_ORIGINAL_OFFLINE_INSPECT_ONLY' else 2


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'status':'BLOCKED_BEFORE_ENTRY','code':str(error) if isinstance(error,Stop) else type(error).__name__,'live':'HOLD'}))
        sys.exit(2)
