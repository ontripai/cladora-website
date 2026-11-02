#!/usr/bin/env python3
"""Fixed Documents consumer hook for a currently owned runtime-lane-v1 fixture.

No standalone provision, installer, session creation, SQL, shell/--exec or Auth
fallback. The only CLI is offline inspection. The callable hook is entered by
Platform after health AND separately accepted native-fixture setup, before cleanup.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / 'scripts/docs-ce012-platform-v1/worker.mjs'
PROFILE = ROOT / 'supabase/local-profiles/runtime-lane-v1.json'
_spec = importlib.util.spec_from_file_location('docs_ce012_base_lane', ROOT / 'scripts/run-local-runtime-lane.py')
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)
Lane = base.Lane


class NotReady(RuntimeError):
    pass


def digest(b):
    return hashlib.sha256(b).hexdigest()


def node():
    value = shutil.which('node')
    if value is None:
        raise NotReady('NOT_READY_EXISTING_NODE_TOOL')
    return value


def private_file(p, maximum=262144):
    p = Path(p)
    s = p.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid != os.getuid() or s.st_mode & 0o077 or s.st_size > maximum:
        raise NotReady('PRIVATE_PLATFORM_INPUT_REQUIRED')
    return p.read_bytes()


def assert_lane(lane, descriptor):
    if not isinstance(lane, Lane) or sys.flags.optimize:
        raise NotReady('PLATFORM_OWNED_PGAUTH_LANE_REQUIRED')
    if (lane.p != json.loads(PROFILE.read_bytes()) or lane.r.get('profile_sha256') != digest(PROFILE.read_bytes())
            or lane.r.get('health_result') != 'PG17_AND_REAL_AUTH_HEALTH_PROVED_NO_DOMAIN_INSTALL'
            or lane.r.get('ended_utc') or lane.r.get('primary_error')):
        raise NotReady('CURRENT_PGAUTH_HEALTH_HANDOFF_REQUIRED')
    owned = {e['role']: e for e in lane.owned}
    if set(owned) != {'pg', 'auth'} or len(lane.owned) != 2:
        raise NotReady('PG_AUTH_EXCLUSIVE_CUSTODY_REQUIRED')
    for role in ('pg', 'auth'):
        if (descriptor[role + '_cid'] != owned[role]['cid'] or descriptor[role + '_name'] != owned[role]['name']
                or not owned[role]['cid']):
            raise NotReady('HANDOFF_RESOURCE_MISMATCH')
    handoff = lane.r.get('docs_ce012_handoff')
    if not handoff or descriptor['attempt_id'] != handoff['attempt_id'] or descriptor['custody_nonce'] != handoff['custody_nonce']:
        raise NotReady('PLATFORM_HANDOFF_NONCE_REQUIRED')
    if descriptor['run_id'] != lane.run or descriptor['owner_uid'] != os.getuid():
        raise NotReady('HANDOFF_RUN_MISMATCH')


def prepare_handoff(lane):
    """Platform-owned bookkeeping only, never installer/DB/Auth/session work.

    Called on the actual active Lane by its owner before independently admitted
    fixture production. It cannot manufacture database/system/receipt/session facts.
    Re-entry is refused; no old run or authorization is reused.
    """
    if not isinstance(lane, Lane) or lane.r.get('ended_utc') or lane.r.get('docs_ce012_handoff'):
        raise NotReady('FRESH_ACTIVE_PLATFORM_HANDOFF_REQUIRED')
    lane.r['docs_ce012_handoff'] = {'attempt_id': uuid.uuid4().hex, 'custody_nonce': uuid.uuid4().hex,
                                  'status': 'WAITING_ACCEPTED_PRODUCER_OUTPUTS'}
    lane.save()
    return dict(lane.r['docs_ce012_handoff'])


def admission(input_bytes):
    # Pure Node admission before runtime/target effects or child credential inheritance.
    child = subprocess.run([node(), str(WORKER), '--check-admission'], input=input_bytes,
                           env=base.environment(), capture_output=True, timeout=10)
    if child.returncode:
        try:
            reason = json.loads(child.stdout)['reason']
        except (ValueError, KeyError):
            reason = 'NOT_READY_PLATFORM_ADMISSION'
        raise NotReady(reason)
    return json.loads(child.stdout)


def consume_owned_lane(lane, session_fd):
    """Real dispatcher; only fixed worker + existing run's fixed input directory.

    session_fd is an owner-opened private file/memfd from the separately admitted
    synthetic Auth session producer, never a request/env-selected path or token.
    No consumer can invoke an installer or create a fixture via this interface.
    """
    private = lane.out / 'docs-ce012'
    if lane.r.get('ended_utc') or (private / 'dispatch.claim').exists():
        raise NotReady('CONSUMED_OR_ENDED_RUN_NO_REPLAY')
    state = {'status': 'NOT_RUN', 'session': 'NOT_RUN', 'consumer': 'NOT_RUN'}
    try:
        root_stat = private.lstat()
        if not stat.S_ISDIR(root_stat.st_mode) or root_stat.st_uid != os.getuid() or root_stat.st_mode & 0o077:
            raise NotReady('PRIVATE_PLATFORM_ROOT_REQUIRED')
        raw = private_file(private / 'inputs/invocation.json')
        value = json.loads(raw)
        admitted = admission(raw)
        assert_lane(lane, value['descriptor'])
        # Interpreter and tool identities are accepted binding inputs, not a PATH assertion.
        binding = json.loads((ROOT / 'supabase/local-profiles/docs-ce012-pgauth-binding-v1.json').read_bytes())['accepted']
        if digest(Path(sys.executable).read_bytes()) != binding['runtime']['tools']['python_sha256']:
            raise NotReady('PYTHON_RUNTIME_CHANGED')
        session_stat = os.fstat(session_fd)
        if not stat.S_ISREG(session_stat.st_mode) or session_stat.st_uid != os.getuid() or session_stat.st_mode & 0o077:
            raise NotReady('PRIVATE_ISSUED_SESSION_CHANNEL_REQUIRED')
        # Persist exclusive claim before starting the worker; interruption consumes this run.
        with (private / 'dispatch.claim').open('xb') as f:
            os.chmod(f.name, 0o600)
            f.write(json.dumps({'run': lane.run, 'identity': admitted['identity']}).encode())
            f.flush(); os.fsync(f.fileno())
        state.update(status='DISPATCHED', consumer='DISPATCHED')
        lane.r['consumer'] = state.copy(); lane.save()
        context = private / 'context.private.json'
        with context.open('x') as f:
            os.chmod(f.name, 0o600);json.dump({'private_root': str(private)}, f);f.flush();os.fsync(f.fileno())
        with context.open('rb') as ctx, (private / 'worker.stdout.private.log').open('xb') as stdout, (private / 'worker.stderr.private.log').open('xb') as stderr:
            os.chmod(stdout.name, 0o600);os.chmod(stderr.name, 0o600)
            env = base.environment()
            env.update(DOCS_PLATFORM_SESSION_FD=str(session_fd), DOCS_PLATFORM_CONTEXT_FD=str(ctx.fileno()))
            try:
                child = subprocess.run([node(), str(WORKER), '--run-owned'], env=env,
                    pass_fds=(session_fd, ctx.fileno()), stdout=stdout, stderr=stderr, timeout=200)
            except subprocess.TimeoutExpired:
                raise NotReady('UNKNOWN_WORKER_TIMEOUT_NO_RETRY')
        result_path = private / 'docs-ce012.result.private.json'
        result = json.loads(private_file(result_path))
        state = {k: result.get(k) for k in ('status','session','consumer','first_error','transport_cleanup','zero_write')}
        if child.returncode or state['status'] != 'PASSED' or state['transport_cleanup'] != 'ACKNOWLEDGED':
            state['status'] = 'FAILED_OR_UNKNOWN'
            state['first_error'] = state.get('first_error') or 'UNKNOWN_WORKER_COMPLETION'
        return state
    except Exception as error:
        state['status'] = 'NOT_READY' if isinstance(error, NotReady) and state['consumer'] == 'NOT_RUN' else 'FAILED_OR_UNKNOWN'
        state.setdefault('first_error', str(error) if isinstance(error, NotReady) else 'UNKNOWN_DISPATCH_OR_PERSISTENCE')
        state['zero_write'] = 'NOT_RUN' if state['consumer'] == 'NOT_RUN' else 'UNKNOWN'
        return state
    finally:
        lane.r['consumer'] = state.copy()
        if state.get('first_error'):
            lane.r.setdefault('primary_error', state['first_error'])
        lane.save()


def consume_and_cleanup(lane, session_fd):
    """Concrete owner slot: accepted health/setup -> consumer -> existing finally cleanup.

    No new provision or setup is performed. Parent receipt retains both health and
    first error; missing cleanup/unknown resources cannot turn into overall PASS.
    """
    if lane.r.get('ended_utc'):
        raise NotReady('ENDED_LIFECYCLE_NO_REPLAY')
    with (lane.out / 'docs-ce012.lifecycle.claim').open('xb') as claim:
        os.chmod(claim.name, 0o600);claim.write(lane.run.encode());claim.flush();os.fsync(claim.fileno())
    try:
        consume_owned_lane(lane, session_fd)
    finally:
        try:
            lane.cleanup()
        except Exception as error:
            lane.r.setdefault('primary_error', 'UNKNOWN_LIFECYCLE_CLEANUP')
            lane.r.setdefault('cleanup_errors', []).append(type(error).__name__)
        base.finalize_lifecycle(lane.r, lane.owned, lane.images)
        lane.r['ended_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime());lane.save()
    return lane.r


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inspect', action='store_true', required=True)
    parser.parse_args(argv)
    result = subprocess.run([node(), str(WORKER), '--inspect'], env=base.environment(), capture_output=True, timeout=10)
    sys.stdout.buffer.write(result.stdout)
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
