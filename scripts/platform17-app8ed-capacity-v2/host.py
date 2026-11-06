"""Linux host for the exact, separately admitted V2 controller. No activation helper."""
from __future__ import annotations
import dataclasses
import hashlib
import types
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import sys
import time
import urllib.request

HERE = Path(__file__).resolve().parent
TOOL = HERE.parents[1]
TOOL_PARENT = 'f2b3c01f1ffb49b202d5f5a8409137e4ec6643d2'
APP_PORT = 3008
OBSERVATION_HEADER = 'x-cladora-start-observation'
AUTHORITY_ROOT = Path('/workspace/private/platform17-service-scope-adoption-01')
REGISTRY = AUTHORITY_ROOT / 'coordinator-accepted-executions.json'
C = None

def load_core():
    global C
    if C is None:
        path = canonical(HERE / 'controller.py')
        C = types.ModuleType('platform17_capacity_v2')
        C.__file__ = str(path)
        sys.modules[C.__name__] = C
        # Fixed reviewed source bytes only: no unsealed __pycache__ execution.
        exec(compile(path.read_bytes(), str(path), 'exec'), C.__dict__)
    return C

def load_resume():
    path = canonical(HERE / 'resume.py')
    module = types.ModuleType('platform17_exact_built_resume')
    module.__file__ = str(path)
    exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
    return module

def load_prepare():
    path = canonical(HERE / 'prepare.py')
    module = types.ModuleType('platform17_scope_adoption_prepare')
    module.__file__ = str(path)
    exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
    return module

def hash_bytes(b): return hashlib.sha256(b).hexdigest()

def canonical(path):
    p = Path(path)
    if not p.is_absolute() or p.resolve() != p or any(x.is_symlink() for x in (p, *p.parents)):
        raise ValueError('PATH_ALIAS_OR_SYMLINK')
    return p

def private_read(path):
    p = canonical(path)
    for parent in (p.parent,):
        s = parent.stat()
        if s.st_uid != os.getuid() or s.st_mode & 0o077:
            raise ValueError('PRIVATE_DIRECTORY_CUSTODY')
    fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        s = os.fstat(fd)
        if not stat.S_ISREG(s.st_mode) or s.st_uid != os.getuid() or s.st_mode & 0o077 or s.st_nlink != 1 or s.st_size > 1048576:
            raise ValueError('PRIVATE_FILE_CUSTODY')
        b = os.read(fd, s.st_size + 1); a = os.fstat(fd)
        if len(b) != s.st_size or (a.st_ino, a.st_size, a.st_mtime_ns) != (s.st_ino, s.st_size, s.st_mtime_ns) or p.lstat().st_ino != s.st_ino:
            raise ValueError('PRIVATE_FILE_CHANGED')
        return b
    finally: os.close(fd)

def persist(path, value):
    b = (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        if os.write(fd, b) != len(b): raise OSError('SHORT_RECEIPT_WRITE')
        os.fsync(fd)
    finally: os.close(fd)
    directory = os.open(Path(path).parent, os.O_RDONLY)
    try: os.fsync(directory)
    finally: os.close(directory)
    if Path(path).read_bytes() != b: raise OSError('RECEIPT_READBACK_MISMATCH')

def proc_identity(pid):
    p = Path('/proc') / str(pid)
    f = (p / 'stat').read_text().split(') ', 1)[1].split()
    return {'pid': pid, 'start_ticks': f[19], 'state': f[0], 'ppid': int(f[1]), 'pgrp': int(f[2]), 'session': int(f[3]), 'uid': p.stat().st_uid}

def process_full(pid):
    p = Path('/proc') / str(pid); value = proc_identity(pid)
    value.update(cwd=os.readlink(p / 'cwd'), argv=[x.decode() for x in (p / 'cmdline').read_bytes().split(b'\0') if x])
    return value

def stable_process_same(before, after):
    return after.get('state') != 'Z' and {k: v for k, v in before.items() if k != 'state'} == {k: v for k, v in after.items() if k != 'state'}

def group_members(group):
    result = []
    for p in Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            i = proc_identity(int(p.name))
            if i['pgrp'] == group and i['state'] != 'Z': result.append(i)
        except FileNotFoundError: pass
    return result

def safe_group(born, members, leader, protected, own_uid):
    """Pure custody check also exercised by offline tests; no signal is sent here."""
    if born['pid'] != born['pgrp'] or born['pid'] != born['session'] or born['pid'] in protected:
        raise ValueError('NOT_OWN_DEDICATED_GROUP')
    if leader and leader['start_ticks'] != born['start_ticks']: raise ValueError('BUILD_LEADER_PID_RECYCLED')
    for i in members:
        if i['uid'] != own_uid or i['session'] != born['pid'] or i['pgrp'] != born['pid'] or int(i['start_ticks']) < int(born['start_ticks']) or i['pid'] in protected:
            raise ValueError('UNKNOWN_GROUP_CUSTODY')
    return members

def seal_identity(root=TOOL):
    path = canonical(root / 'scripts/platform17-app8ed-capacity-v2/source-seal.json')
    raw = path.read_bytes(); seal = json.loads(raw)
    expected = {
        'scripts/platform17-app8ed-capacity-v2/controller.py',
        'scripts/platform17-app8ed-capacity-v2/host.py',
        'scripts/platform17-app8ed-capacity-v2/contract.md',
        'scripts/platform17-app8ed-capacity-v2/request.template.json',
        'scripts/platform17-app8ed-capacity-v2/registry.template.json',
        'tests/platform17-app8ed-capacity-v2/test_controller.py',
        'scripts/platform17-app8ed-capacity-v2/listen-observer.mjs',
        'scripts/platform17-app8ed-capacity-v2/observation-probe.mjs',
        'scripts/platform17-app8ed-capacity-v2/resume.py',
        'tests/platform17-app8ed-capacity-v2/test_resume.py',
        'scripts/platform17-app8ed-capacity-v2/prepare.py',
        'tests/platform17-app8ed-capacity-v2/test_scope_adoption.py',
    }
    if seal['contract'] != 'platform17.app8ed-controller.source-seal.v2' or {x['path'] for x in seal['files']} != expected or len(seal['files']) != len(expected):
        raise ValueError('SEAL_FILE_SET')
    for item in seal['files']:
        data = canonical(root / item['path']).read_bytes()
        if len(data) != item['bytes'] or hash_bytes(data) != item['sha256']: raise ValueError('SEALED_SOURCE_DRIFT')
    return hash_bytes(raw)

def validate_registry_entry(entry, r, digest, now):
    fields = {'request_sha256', 'tool', 'run_id', 'issued_at_epoch', 'expires_at_epoch', 'single_use', 'owner_decision_sha256'}
    if type(entry) is not dict or set(entry) != fields: raise ValueError('REGISTRY_ENTRY_FIELDS')
    if entry['request_sha256'] != digest or entry['tool'] != r['tool'] or entry['run_id'] != r['run_id'] or entry['single_use'] is not True:
        raise ValueError('REGISTRY_EXACT_BINDING')
    for k in ('issued_at_epoch', 'expires_at_epoch'):
        if type(entry[k]) is not int: raise ValueError('REGISTRY_TIME')
    if not entry['issued_at_epoch'] <= now < entry['expires_at_epoch'] or not 0 < entry['expires_at_epoch'] - entry['issued_at_epoch'] <= 1200:
        raise ValueError('REGISTRY_EXPIRED_OR_WINDOW')
    if not re.fullmatch('[a-f0-9]{64}', entry['owner_decision_sha256'] or ''): raise ValueError('OWNER_DECISION_REFERENCE')

class NativeHost:
    def __init__(self, request, digest, registry_raw, entry):
        self.request = request; self.digest = digest; self.registry_raw = registry_raw; self.entry = entry
        self._authorized = False
        self.run = AUTHORITY_ROOT / 'runs' / request['run_id']; self.seq = 0
        self._build = self._start = None; self.old_stopped = False; self.protected = set()
        self._probe = None; self.probe_cleanup = None; self.observation = None
        self.sample_fd = None; self.last_sample_write = -float('inf'); self.last_sample_sync = -float('inf')

    def git(self, root, *args):
        # File-backed stdout avoids Node pipe/IPC ambiguity. Git output is
        # bounded source metadata, never a credential-bearing environment dump.
        result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, timeout=20)
        if result.returncode: raise C.Rejected('GIT_SOURCE_CHECK_FAILED')
        return result.stdout

    def authorize(self, r, digest):
        C.need(not self._authorized, 'REQUEST_BINDING_ALREADY_AUTHORIZED')
        # main and Controller independently validate the same sealed bytes.
        # Bind their equal values/digest once; preserve strict identity for
        # every subsequent currentness check rather than requiring two JSON
        # parses to return the same Python object.
        C.need(type(r) is dict and r == self.request and digest == self.digest, 'INTERNAL_REQUEST_BINDING')
        self.current(self.request)
        C.need(hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'), 'PIDFD_CAPABILITY_REQUIRED')
        self.request = r
        self._authorized = True

    def current(self, r):
        C.need(r is self.request, 'REQUEST_OBJECT_CHANGED')
        # File reads can wait. Inspect source/request first, then re-read the
        # authority bytes and sample its clock last, immediately before return.
        C.need(seal_identity() == r['tool']['seal_sha256'], 'TOOL_SEAL_CHANGED')
        C.need(hash_bytes(private_read(AUTHORITY_ROOT / 'requests' / (self.digest + '.json'))) == self.digest, 'REQUEST_DRIFT')
        C.need(private_read(REGISTRY) == self.registry_raw, 'COORDINATOR_REGISTRY_CHANGED_OR_REVOKED')
        validate_registry_entry(self.entry, r, self.digest, time.time())

    def _source(self, root):
        canonical(Path(root))
        C.need(not self.git(root, 'status', '--porcelain').strip(), 'SOURCE_NOT_CLEAN')
        for n in ('.env', '.env.local', '.env.production', '.env.production.local'):
            C.need(not (Path(root) / n).exists(), 'UNREVIEWED_DOTENV')
        return {'root': root, 'sha': self.git(root, 'rev-parse', 'HEAD').decode().strip(), 'tree': self.git(root, 'rev-parse', 'HEAD^{tree}').decode().strip(), 'launcher_sha256': hash_bytes(canonical(Path(root) / 'scripts/run-core-service-app-assembly-17.mjs').read_bytes())}

    def read_build(self, r):
        root = Path(C.APP_ROOT); files = {n: hash_bytes(canonical(root / n).read_bytes()) for n in C.BUILD_FILES}
        build_id = (root / '.next/BUILD_ID').read_text().strip()
        C.need(re.fullmatch('[A-Za-z0-9_-]{1,64}', build_id) is not None, 'NEW_BUILD_ID')
        served = canonical(root / '.next/static' / build_id / '_buildManifest.js').read_bytes()
        return {'id': build_id, 'files': files, 'served_manifest_sha256': hash_bytes(served)}

    def observe(self, r, old_stopped=False):
        consumer = self._source(C.APP_ROOT); old_source = self._source(C.OLD_ROOT); anchor = self._source(C.ANCHOR_ROOT)
        C.need(anchor == {k: r['transport'][k] for k in ('root', 'sha', 'tree', 'launcher_sha256')}, 'ANCHOR_SOURCE_DRIFT')
        tool_sha = self.git(TOOL, 'rev-parse', 'HEAD').decode().strip(); tool_tree = self.git(TOOL, 'rev-parse', 'HEAD^{tree}').decode().strip()
        C.need(not self.git(TOOL, 'status', '--porcelain').strip(), 'TOOL_NOT_CLEAN')
        C.need(self.git(TOOL, 'rev-parse', 'HEAD^').decode().strip() == TOOL_PARENT, 'TOOL_EXACT_REVIEWED_PARENT')
        tool = {'sha': tool_sha, 'tree': tool_tree, 'seal_sha256': seal_identity()}
        lineage = [old_source['sha'], self.git(C.APP_ROOT, 'rev-parse', 'HEAD^').decode().strip(), consumer['sha']]
        self.git(C.APP_ROOT, 'merge-base', '--is-ancestor', C.OLD, C.BASE)
        for n in ('package.json', 'package-lock.json', 'src/lib/core/functional-command-runtime-v1.ts', 'src/lib/core/functional-request-auth-v1.ts', 'src/lib/core/private-service-development-binding-v1.ts', 'src/lib/core/service-functional-binding-v1.ts', 'src/lib/core/current-authority-postgres-provider-v1.ts', 'src/lib/core/postgres-transaction-host-v1.ts', 'src/lib/core/service-app-read-v1.ts', 'supabase/install/core-service-app-assembly-v1/catalog-compatibility.sql', 'supabase/install/core-service-app-assembly-v1/read-access.sql', 'supabase/install/core-service-app-assembly-v1/manifest.json'):
            C.need(hash_bytes(self.git(C.APP_ROOT, 'show', C.CORE + ':' + n)) == hash_bytes((Path(C.APP_ROOT) / n).read_bytes()), 'PROTECTED_CORE_SOURCE_CHANGED')
        adraw = private_read(C.ADMISSION); ad = json.loads(adraw)
        C.need(ad['contract'] == 'core17.exact-app-consumer-admission.v1' and ad['source_base'] == C.ANCHOR and ad['installed_Core_base'] == C.CORE and ad['origin'] == 'http://localhost:3008', 'ADMISSION_CONTRACT')
        C.need(ad['consumer'] == consumer and ad['transport']['app'] == anchor and ad['transport']['binding_sha256'] == r['transport']['binding_sha256'] and ad['transport']['relay_seal_sha256'] == r['transport']['relay_seal_sha256'], 'ADMISSION_CONTENT_BINDING')
        protected = {path: hash_bytes(private_read(path)) for path in C.PROTECTED_FILES}
        old_raw = private_read(C.OLD_RECORD); C.need(hash_bytes(old_raw) == r['old_app']['record_sha256'], 'OLD_PROCESS_RECORD_DRIFT')
        old_record = json.loads(old_raw); old = None; ended = False
        C.need(old_record['pid'] == r['old_app']['pid'] and old_record['start_ticks'] == r['old_app']['start_ticks'] and old_record['source'] == C.OLD and old_record['tree'] == C.OLD_TREE, 'OLD_RECORDED_PIN')
        old_files = {n: hash_bytes(canonical(Path(C.OLD_ROOT) / n).read_bytes()) for n in C.BUILD_FILES}
        C.need(old_source == {'root': C.OLD_ROOT, 'sha': C.OLD, 'tree': C.OLD_TREE, 'launcher_sha256': C.LAUNCHER} and old_files == r['old_app']['build']['files'], 'OLD_SOURCE_BUILD')
        try:
            old_proc = process_full(old_record['pid'])
            ended = old_proc['state'] == 'Z' or old_proc['start_ticks'] != r['old_app']['start_ticks']
        except FileNotFoundError: ended = True
        if not old_stopped:
            C.need(not ended and old_proc['uid'] == os.getuid(), 'OLD_PROCESS_NOT_CURRENT')
            old = {**old_proc, 'source': C.OLD, 'tree': C.OLD_TREE, 'live': True, 'build': {**old_record['build'], 'served_manifest_sha256': r['old_app']['build']['served_manifest_sha256']}}
            # The hash is checked against the actual old build, never merely copied.
            data = (Path(C.OLD_ROOT) / '.next/static' / r['old_app']['build']['id'] / '_buildManifest.js').read_bytes()
            C.need(hash_bytes(data) == r['old_app']['build']['served_manifest_sha256'], 'OLD_SERVED_BUILD_PIN')
            self.protected.update((old_proc['pid'], old_proc['pgrp']))
        else: C.need(self.old_stopped and ended, 'OLD_STOP_ACK_REQUIRED')
        relay = json.loads(private_read(C.RELAY_RECORD)); observed = process_full(relay['pid'])
        C.need(observed['start_ticks'] == str(relay['start_ticks']) and observed['state'] != 'Z' and observed['uid'] == os.getuid(), 'RELAY_PID_DRIFT')
        if 'argv' in relay: C.need(observed['argv'] == relay['argv'], 'RELAY_ARGV_DRIFT')
        if 'cwd' in relay: C.need(observed['cwd'] == relay['cwd'], 'RELAY_CWD_DRIFT')
        self.protected.update((observed['pid'], observed['pgrp']))
        return {'consumer': consumer, 'tool': tool, 'lineage': lineage, 'admission_sha256': hash_bytes(adraw), 'protected_files': protected, 'relay_identity_current': True, 'sources_clean': True, 'protected_sources_match': True, 'old': old, 'old_ended': ended, **self.sample()}

    def claim(self, r, digest):
        parent = AUTHORITY_ROOT / 'runs'
        if not parent.exists(): parent.mkdir(mode=0o700)
        canonical(parent)
        C.need(parent.stat().st_uid == os.getuid() and not parent.stat().st_mode & 0o077, 'RUNS_CUSTODY')
        self.run.mkdir(mode=0o700)  # exclusive, no reset or reuse
        persist(self.run / 'once.claim.json', {'run_id': r['run_id'], 'request_sha256': digest, 'tool': r['tool'], 'build': 'NOT_RUN', 'start': 'NOT_RUN'})

    def record(self, name, value):
        if name == 'sample':
            now = time.monotonic()
            if self.sample_fd is None:
                self.sample_fd = os.open(self.run / 'space-samples.private.ndjson', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            if now - self.last_sample_write >= .25 or value['available_bytes'] <= C.EARLY_STOP:
                raw = (json.dumps({'monotonic': now, **value}) + '\n').encode()
                if os.write(self.sample_fd, raw) != len(raw): raise OSError('MONITOR_LEDGER_SHORT_WRITE')
                self.last_sample_write = now
            if now - self.last_sample_sync >= 1:
                os.fsync(self.sample_fd); self.last_sample_sync = now
            return
        self.seq += 1
        persist(self.run / ('%06d-%s.private.json' % (self.seq, name)), value)

    def environment(self, r):
        env = dict(os.environ)
        for k in tuple(env):
            if k.startswith(('CLADORA_CORE17_TRANSPORT_', 'CLADORA_CORE17_CONSUMER_', 'SUPABASE_', 'CLADORA_STAGING_')): env.pop(k)
        # Do not remove the inherited session proxy, CA, authentication headers,
        # or runtime guard variables. The official launcher further filters children.
        env.update(CLADORA_CORE17_TRANSPORT_PROFILE=r['transport']['abi'], CLADORA_CORE17_TRANSPORT_BINDING_SHA256=r['transport']['binding_sha256'], CLADORA_CORE17_CONSUMER_PROFILE='core17.exact-app-consumer-admission.v1', CLADORA_CORE17_CONSUMER_ADMISSION_FILE=C.ADMISSION, CLADORA_CORE17_CONSUMER_ADMISSION_SHA256=r['admission']['sha256'])
        return env

    def preflight(self, r):
        self.current(r)
        program = "import{core17ConsumerAdoptionPreflightV1 as p}from'./scripts/lib/core17-exact-consumer-admission-v1.mjs';console.log(JSON.stringify({ready:p(process.cwd(),process.env)}));"
        prefix = '%06d-preflight' % (self.seq + 1)
        with (self.run / (prefix + '.stdout.private.log')).open('xb') as out, (self.run / (prefix + '.stderr.private.log')).open('xb') as err:
            os.chmod(out.name, 0o600); os.chmod(err.name, 0o600)
            result = subprocess.run(['node', '--input-type=module', '-e', program], cwd=C.APP_ROOT, env=self.environment(r), stdout=out, stderr=err, stdin=subprocess.DEVNULL, timeout=90)
        C.need(result.returncode == 0, 'OFFICIAL_PREFLIGHT_FAILED')
        raw = (self.run / (prefix + '.stdout.private.log')).read_bytes(); C.need(len(raw) < 1048576 and json.loads(raw)['ready'] is True, 'OFFICIAL_PREFLIGHT_NOT_READY')
        self.record('preflight-ACK', {'exit': 0})

    def _spawn(self, kind, argv, r, expected_build=None):
        slot = {'kind': kind, 'dispatch': 'NOT_DISPATCHED', 'child': None, 'born': None, 'pidfd': None}
        if kind == 'build': self._build = slot
        else: self._start = slot
        self.current(r)
        env = self.environment(r)
        if kind == 'start':
            env, _ = self.prepare_observation(r, expected_build, 'app')
        with (self.run / (kind + '.stdout.private.log')).open('xb') as out, (self.run / (kind + '.stderr.private.log')).open('xb') as err:
            os.chmod(out.name, 0o600); os.chmod(err.name, 0o600)
            self.current(r)
            if kind == 'build':
                old = process_full(r['old_app']['pid'])
                C.need(old['start_ticks'] == r['old_app']['start_ticks'] and old['cwd'] == C.OLD_ROOT and old['argv'] == r['old_app']['argv'] and old['state'] != 'Z' and old['uid'] == os.getuid(), 'OLD_CHANGED_AT_BUILD_POINT')
                C.enough(self.sample())
            else:
                C.check_snapshot(self.observe(r, old_stopped=True), r, old_stopped=True)
                C.need(expected_build is not None and self.read_build(r) == expected_build, 'NEW_BUILD_CHANGED_AT_START_POINT')
                C.need(self.port_free(), 'PORT_CHANGED_AT_START_POINT')
                sample = self.sample()
                C.need(sample['available_bytes'] > C.EARLY_STOP and sample['free_inodes'] > 0,
                       'START_CAPACITY_CHANGED_AT_DISPATCH')
            self.current(r)
            slot['dispatch'] = 'CALLING_POPEN_MAY_CREATE_CHILD'
            child = subprocess.Popen(list(argv), cwd=C.APP_ROOT, env=env, stdout=out, stderr=err, stdin=subprocess.DEVNULL, start_new_session=True)
        slot['child'] = child
        try:
            slot['pidfd'] = os.pidfd_open(child.pid)
            slot['born'] = proc_identity(child.pid)
            self._safe(slot)
            self.record(kind + '-process', {'identity': slot['born'], 'argv': argv, 'source': C.BASE, 'tool': r['tool']})
        except BaseException as error:
            raise C.Unknown(kind.upper() + '_CREATED_IDENTITY_OR_PERSISTENCE_UNKNOWN:' + type(error).__name__) from error
        return slot

    def spawn_build(self, r): return self._spawn('build', C.BUILD_ARGV, r)
    def spawn_start(self, r, build): return self._spawn('start', C.START_ARGV, r, build)
    def possible_build(self): return self._build
    def possible_start(self): return self._start
    def sample(self):
        s = os.statvfs('/workspace'); return {'available_bytes': s.f_bavail * s.f_frsize, 'free_inodes': s.f_favail}
    def monotonic(self): return time.monotonic()
    def sleep(self, delay): time.sleep(delay)
    def build_poll(self, slot): return slot['child'].poll()
    def _safe(self, slot):
        if not slot or slot['born'] is None: raise C.Unknown('CHILD_CUSTODY_UNKNOWN')
        born = slot['born']; leader = None
        try: leader = proc_identity(born['pid'])
        except FileNotFoundError: pass
        return safe_group(born, group_members(born['pid']), leader, self.protected | {os.getpgrp()}, os.getuid())
    def build_members(self, slot): return self._safe(slot)

    def _cleanup(self, slot, resource):
        if slot is not None and slot['dispatch'] == 'NOT_DISPATCHED':
            return {'resource': resource, 'state': 'SKIPPED', 'reason': 'Popen not called'}
        if not slot or slot['born'] is None:
            return {'resource': resource, 'state': 'UNKNOWN', 'child_may_exist': True, 'owner': 'Platform', 'followup_seconds': 600}
        signals = []
        if self._safe(slot):
            os.killpg(slot['born']['pid'], signal.SIGTERM); signals.append('SIGTERM')
            deadline = time.monotonic() + 2
            while self._safe(slot):
                if time.monotonic() >= deadline or self.sample()['available_bytes'] <= C.URGENT_KILL:
                    os.killpg(slot['born']['pid'], signal.SIGKILL); signals.append('SIGKILL'); break
                time.sleep(C.POLL)
            deadline = time.monotonic() + 10
            while self._safe(slot):
                if time.monotonic() >= deadline: raise C.Unknown('OWN_CHILD_STOP_ACK_UNKNOWN')
                time.sleep(C.POLL)
        slot['child'].wait(timeout=2)
        if slot['child'].stdin is not None and not slot['child'].stdin.closed:
            slot['child'].stdin.close()
        if slot['pidfd'] is not None: os.close(slot['pidfd']); slot['pidfd'] = None
        return {'resource': resource, 'state': 'ACK', 'signals': signals, 'exit': slot['child'].returncode}
    def cleanup_build(self, slot): return self._cleanup(slot, 'new_build')
    def cleanup_start(self, slot): return self._cleanup(slot, 'new_app')

    def stop_old(self, r):
        # pidfd pins the real process across the check -> signal boundary.
        expected = r['old_app']; pid = expected['pid']; fd = os.pidfd_open(pid)
        try:
            self.current(r); C.check_snapshot(self.observe(r), r)
            before = process_full(pid)
            C.need(before['start_ticks'] == expected['start_ticks'] and before['cwd'] == C.OLD_ROOT and before['argv'] == expected['argv'] and before['uid'] == os.getuid(), 'OLD_CHANGED_BEFORE_SIGNAL')
            self.current(r)
            signal.pidfd_send_signal(fd, signal.SIGTERM)
            deadline = time.monotonic() + 20
            while True:
                try: now = proc_identity(pid); ended = now['state'] == 'Z' or now['start_ticks'] != expected['start_ticks']
                except FileNotFoundError: ended = True
                if ended: break
                if time.monotonic() >= deadline: raise C.Unknown('OLD_STOP_ACK_UNKNOWN_NO_START')
                time.sleep(C.POLL)
            self.old_stopped = True
            self.record('old-stop-ACK', {'source': C.OLD, 'signal': 'SIGTERM', 'pidfd': True})
        finally: os.close(fd)

    def port_free(self):
        for file in ('/proc/net/tcp', '/proc/net/tcp6'):
            for line in Path(file).read_text().splitlines()[1:]:
                fields = line.split()
                if fields[1].split(':')[-1] == format(APP_PORT, '04X') and fields[3] == '0A': return False
        return True

    def prepare_observation(self, r, build, mode):
        directory = self.run / (mode + '-observation')
        directory.mkdir(mode=0o700)
        canonical(directory)
        evidence = directory / 'listen.private.ndjson'
        config = {'contract': 'platform17.listen-observation.v1', 'mode': mode,
                  'nonce': secrets.token_hex(32), 'run_id': r['run_id'],
                  'app_root': C.APP_ROOT, 'port': APP_PORT if mode == 'app' else 0,
                  'evidence_file': str(evidence),
                  'manifest_path': '/_next/static/' + build['id'] + '/_buildManifest.js'}
        persist(directory / 'config.private.json', config)
        bootstrap = directory / 'bootstrap.private.mjs'
        raw = ('import {install} from ' + json.dumps((HERE / 'listen-observer.mjs').as_uri()) +
               ';install(' + json.dumps(config) + ');\n').encode()
        fd = os.open(bootstrap, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            C.need(os.write(fd, raw) == len(raw), 'OBSERVER_BOOTSTRAP_SHORT_WRITE')
            os.fsync(fd)
        finally: os.close(fd)
        C.need(private_read(bootstrap) == raw, 'OBSERVER_BOOTSTRAP_READBACK')
        env = self.environment(r)
        # Append to existing guard/proxy preloads; never replace NODE_OPTIONS.
        env['NODE_OPTIONS'] = env.get('NODE_OPTIONS', '') + ' --import=' + str(bootstrap)
        meta = {'config': config, 'bootstrap': bootstrap, 'bootstrap_sha256': hash_bytes(raw)}
        if mode == 'app': self.observation = meta
        self.record(mode + '-observation-setup', {'contract': config['contract'],
                    'bootstrap_sha256': hash_bytes(raw), 'mode': mode})
        return env, meta

    def probe_observation(self, r, build):
        env, meta = self.prepare_observation(r, build, 'probe')
        slot = {'kind': 'probe', 'dispatch': 'NOT_DISPATCHED', 'child': None, 'born': None, 'pidfd': None}
        self._probe = slot
        first = None
        try:
            self.current(r)
            with (self.run / 'probe.stdout.private.log').open('xb') as out, (self.run / 'probe.stderr.private.log').open('xb') as err:
                os.chmod(out.name, 0o600); os.chmod(err.name, 0o600)
                self.current(r)
                slot['dispatch'] = 'CALLING_POPEN_MAY_CREATE_CHILD'
                child = subprocess.Popen(['node', str(HERE / 'observation-probe.mjs'),
                    str(meta['bootstrap'].parent / 'config.private.json')], cwd=C.APP_ROOT,
                    env=env, stdout=out, stderr=err, stdin=subprocess.PIPE, start_new_session=True, bufsize=0)
                slot['child'] = child
                slot['pidfd'] = os.pidfd_open(child.pid); slot['born'] = proc_identity(child.pid)
                self._safe(slot)
                deadline = time.monotonic() + 15
                while True:
                    data = (self.run / 'probe.stdout.private.log').read_bytes()
                    C.need(len(data) <= 4096, 'PROBE_OUTPUT_LIMIT')
                    if data.endswith(b'\n'): break
                    C.need(child.poll() is None and time.monotonic() < deadline, 'OBSERVATION_PROBE_FAILED')
                    time.sleep(C.POLL)
                C.need(self.listen_evidence(slot, meta) is not None, 'PROBE_PARENT_OBSERVATION_NOT_READY')
                self.current(r)
                C.need(child.stdin.write(b'K') == 1, 'PROBE_PARENT_ACK_SHORT_WRITE')
                child.stdin.close()
                code = child.wait(timeout=5)
            C.need(code == 0 and not self._safe(slot), 'OBSERVATION_PROBE_FAILED')
            result = json.loads(data)
            C.need(result == {'contract': 'platform17.observation-probe.v1', 'state': 'PASS',
                'observation': 'child-owned-listen-and-http-nonce', 'private_fd_scan': False},
                'OBSERVATION_PROBE_NOT_ACK')
            self.current(r)
            self.record('observation-probe-ACK', result)
        except BaseException as error:
            first = error
        finally:
            try: self.probe_cleanup = self._cleanup(slot, 'observation_probe')
            except BaseException as secondary:
                self.probe_cleanup = {'resource': 'observation_probe', 'state': 'UNKNOWN',
                                      'error': str(secondary), 'owner': 'Platform', 'followup_seconds': 600}
                first = first or secondary
        if self.probe_cleanup['state'] == 'UNKNOWN' and first is None:
            first = C.Unknown('OBSERVATION_PROBE_CLEANUP_UNKNOWN')
        if first is not None: raise first

    def listen_evidence(self, slot, meta=None):
        meta = meta if meta is not None else self.observation
        C.need(meta is not None, 'NO_OWN_LISTEN_OBSERVATION')
        config = meta['config']
        C.need(hash_bytes(private_read(meta['bootstrap'])) == meta['bootstrap_sha256'], 'OBSERVER_BOOTSTRAP_DRIFT')
        try: raw = private_read(config['evidence_file'])
        except FileNotFoundError: return None  # not yet atomically published
        C.need(len(raw) <= 65536, 'OBSERVER_EVIDENCE_LIMIT')
        C.need(raw and raw.endswith(b'\n'), 'OBSERVER_EVIDENCE_INCOMPLETE')
        lines = raw.splitlines()
        C.need(len(lines) == 1, 'OBSERVER_LISTENER_AMBIGUOUS')
        proof = C.parse(lines[0]); C.fields(proof, ('contract', 'mode', 'run_id', 'nonce',
            'pid', 'start_ticks', 'pgrp', 'session', 'uid', 'cwd', 'address', 'port'), 'OBSERVER_FIELDS')
        for k in ('contract', 'mode', 'run_id', 'nonce'):
            C.need(proof[k] == config[k], 'OBSERVER_REQUEST_BINDING')
        C.need((proof['port'] == config['port'] or (config['mode'] == 'probe' and config['port'] == 0 and
               type(proof['port']) is int and 0 < proof['port'] < 65536)) and
               proof['address'] == '127.0.0.1', 'OBSERVER_ADDRESS')
        members = {m['pid']: m for m in self._safe(slot)}
        C.need(type(proof['pid']) is int and proof['pid'] in members, 'OBSERVER_NOT_OWN_GROUP')
        actual = process_full(proof['pid'])
        for k in ('pid', 'start_ticks', 'pgrp', 'session', 'uid', 'cwd'):
            C.need(actual[k] == proof[k], 'OBSERVER_PROCESS_DRIFT')
        C.need(actual['cwd'] == C.APP_ROOT and actual['argv'] == ['next-server (v16.4.1)'] and
               actual['uid'] == os.getuid() and actual['state'] != 'Z', 'START_LISTENER_IDENTITY')
        return actual

    def start_ack(self, slot, r, build):
        deadline = time.monotonic() + 40
        C.need(self.observation is not None, 'NO_OWN_LISTEN_OBSERVATION')
        config = self.observation['config']
        url = 'http://127.0.0.1:' + str(APP_PORT) + config['manifest_path']
        while True:
            self.current(r)
            C.need(slot['child'].poll() is None, 'OFFICIAL_START_EXITED')
            sample = self.sample()
            C.need(sample['available_bytes'] > C.RESERVE and sample['free_inodes'] > 0, 'START_RESERVE_GUARD')
            actual = self.listen_evidence(slot)
            if actual:
                try:
                    request = urllib.request.Request(url, headers={OBSERVATION_HEADER: config['nonce']})
                    with urllib.request.urlopen(request, timeout=1) as response:
                        data = response.read(1048577); status = response.status
                        nonce = response.headers.get(OBSERVATION_HEADER)
                except (OSError, TimeoutError): data = None; status = None; nonce = None
                if status == 200 and data is not None:
                    C.need(nonce == config['nonce'], 'HTTP_LISTENER_PROOF_MISMATCH')
                    C.need(hash_bytes(data) == build['served_manifest_sha256'], 'SERVED_BUILD_HASH_MISMATCH')
                    self.current(r)
                    sample = self.sample()
                    C.need(sample['available_bytes'] > C.RESERVE and sample['free_inodes'] > 0, 'START_RESERVE_GUARD')
                    final = process_full(actual['pid']); C.need(stable_process_same(actual, final), 'LISTENER_CHANGED_AFTER_HTTP_AWAIT')
                    return {'source': C.BASE, 'tree': C.NEW_TREE, 'build': build, 'listener': final,
                        'official_start': slot['born'], 'HTTP': 200, 'tool': r['tool'],
                        'observation': 'child-owned-listen-and-http-nonce.v1'}
            if time.monotonic() >= deadline: raise C.Unknown('START_ACK_TIMEOUT_MAY_EXIST_NO_RETRY')
            time.sleep(C.POLL)

    def finish(self, result):
        try:
            if self.sample_fd is not None: os.fsync(self.sample_fd)
            persist(self.run / 'result.private.json', dataclasses.asdict(result))
        finally:
            if self.sample_fd is not None: os.close(self.sample_fd); self.sample_fd = None
            for slot in (self._build, self._start):
                if slot is not None and slot['pidfd'] is not None: os.close(slot['pidfd']); slot['pidfd'] = None


def main(argv):
    global C
    if argv == ['inspect-source']:
        print(json.dumps({'contract': 'platform17.app8ed-capacity-controller.v2', 'seal_sha256': seal_identity(), 'runtime': 'NOT_RUN', 'activation': 'EXTERNAL_COORDINATOR_GATE_REQUIRED'})); return 0
    if len(argv) == 2 and argv[0] == 'prepare-next' and re.fullmatch(r'app8ed-[a-z0-9-]{8,64}', argv[1]):
        seal_identity(); C = load_core()
        print(json.dumps(load_prepare().prepare_private(sys.modules[__name__], argv[1], C)))
        return 0
    if len(argv) != 2 or argv[0] != 'execute-once' or not re.fullmatch('[a-f0-9]{64}', argv[1]):
        print('HOLD_FIXED_MODE_ONLY'); return 2
    # No request path, SQL, shell, argv/env override, registry edit or activation
    # is accepted. The fixed coordinator registry is out-of-band authority.
    seal_identity(); C = load_core(); digest = argv[1]
    registry_raw = private_read(REGISTRY); registry = C.parse(registry_raw)
    C.fields(registry, ('contract', 'entries'), 'REGISTRY_FIELDS')
    C.need(registry['contract'] == 'platform17.coordinator-execution-registry.v2' and type(registry['entries']) is list and len(registry['entries']) == 1, 'REGISTRY_ONE_EXACT_EXECUTION_REQUIRED')
    raw = private_read(AUTHORITY_ROOT / 'requests' / (digest + '.json')); C.need(hash_bytes(raw) == digest, 'REQUEST_DIGEST')
    r = C.validate(C.parse(raw))
    matching = [x for x in registry['entries'] if type(x) is dict and x.get('request_sha256') == digest]
    C.need(len(matching) == 1, 'NO_UNIQUE_COORDINATOR_AUTHORIZATION')
    host = NativeHost(r, digest, registry_raw, matching[0])
    result = C.Controller(host).run(raw)
    print(json.dumps({'state': result.state, 'first_error_code': result.first_error, 'raw_receipt': 'PRIVATE', 'old_stop': result.old_stop, 'start_dispatch': result.start_dispatch}))
    return 0 if result.state == 'ACK_EXACT_CONSUMER_RETAINED' else 1

if __name__ == '__main__':
    try: raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        # No raw request, credential, URL/key, environment or stack is emitted.
        print(json.dumps({'state': 'HOLD_OR_FAILED_NO_RETRY', 'error_type': type(error).__name__, 'code': str(error)}))
        raise SystemExit(2)
