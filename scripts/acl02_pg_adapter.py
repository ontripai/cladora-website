"""One fixed producer adapter. Registry intentionally inactive pending exact review."""
from dataclasses import dataclass
import json
from pathlib import Path
import re
from local_runtime_consumer import AdmissionError, digest, exact_keys, unique_object
from acl02_pg_wire import Wire, WireError, require_rollback, require_residue

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'supabase/local-profiles/acl02-pg-only'
PROFILE = ROOT / 'supabase/local-profiles/runtime-pg-only-acl02-v1.json'
REGISTRY = ROOT / 'supabase/local-profiles/acl02-pg-only-reviews.json'
SOURCE = '3cbfc877e5334c5189778b2003e308e3dddf0b2e'
PINS = {
    'request.json': (4660, 'fecd8012f0ad9a82e098d8f513f9e9d694b2731e06067c49e70e029eb1671155'),
    'witness.sql': (11271, '514b3d01c1b0dcca967923128348856cdf9b6871ff86db1b76766dc9551e4ddc'),
    'verify-clean.sql': (651, 'c5aad25fcc2c6ac1c1c9690631464442d4585cf2a00db8ba6ae50963dee85b23')}
EXECUTABLES = ('scripts/run-local-runtime-lane.py', 'scripts/local_runtime_consumer.py',
               'scripts/run-acl02-pg-only.py', 'scripts/acl02_pg_adapter.py', 'scripts/acl02_pg_wire.py')


def seal():
    records = {name: digest((ROOT / name).read_bytes()) for name in EXECUTABLES}
    records[str(PROFILE.relative_to(ROOT))] = digest(PROFILE.read_bytes())
    for name, (size, sha) in PINS.items():
        raw = (DIRECTORY / name).read_bytes()
        if len(raw) != size or digest(raw) != sha:
            raise AdmissionError('PRODUCER_BYTES_CHANGED:' + name)
        records[str((DIRECTORY / name).relative_to(ROOT))] = sha
    return {'files': records, 'sha256': digest(json.dumps(records, sort_keys=True, separators=(',', ':')).encode())}


def envelope():
    return {'format': 'acl02-pure-pg-envelope-v1', 'target': 'owned-disposable-pg17-only',
            'adapter': 'acl02-pg-wire-v1', 'source_commit': SOURCE,
            'producer_request_sha256': PINS['request.json'][1],
            'order': ['witness.sql', 'verify-clean.sql'], 'seal': seal(),
            'execution_binding': None, 'authority': None}


def admit(raw, reviews=None):
    if not isinstance(raw, bytes) or len(raw) > 16384:
        raise AdmissionError('ENVELOPE_SIZE')
    try:
        value = json.loads(raw, object_pairs_hook=unique_object)
    except (ValueError, UnicodeError) as error:
        raise AdmissionError('ENVELOPE_JSON') from error
    expected = envelope()
    exact_keys(value, expected.keys())
    if value != expected:
        raise AdmissionError('EXACT_ENVELOPE_BINDING')
    records = json.loads(REGISTRY.read_bytes())['reviews'] if reviews is None else reviews
    record = records.get(digest(raw))
    if (not isinstance(record, dict) or set(record) != {'seal_sha256', 'source_commit', 'review', 'single_use'}
            or record['seal_sha256'] != expected['seal']['sha256'] or record['source_commit'] != SOURCE
            or record['single_use'] is not True
            or not re.fullmatch(r'https://github.com/ontripai/cladora-website/issues/463#issuecomment-[0-9]+', str(record['review']))):
        raise AdmissionError('HOLD_EXACT_BINDING_NOT_REVIEWED')
    return digest(raw + json.dumps(record, sort_keys=True, separators=(',', ':')).encode())


@dataclass(frozen=True)
class PurePGFixture:
    run_id: str
    attempt: str
    pg_cid: str
    database: str = 'postgres'
    kind: str = 'owned-disposable-pg17-only'


def validate_fixture(fixture):
    if (type(fixture) is not PurePGFixture or fixture.kind != 'owned-disposable-pg17-only'
            or fixture.database != 'postgres' or not re.fullmatch(r'[0-9a-f]{64}', fixture.pg_cid)
            or not re.fullmatch(r'cladora-lane-[0-9a-f]{12}', fixture.run_id)
            or not re.fullmatch(r'[0-9a-f]{32}', fixture.attempt)):
        raise AdmissionError('PURE_PG_FIXTURE_REQUIRED')


def execute(raw, admitted, fixture, output, docker, env, assert_target, persist):
    """Not registered/executable in delivered registry. No caller code or SQL path."""
    validate_fixture(fixture)
    def gate():
        if admit(raw) != admitted:
            raise AdmissionError('RE_ADMISSION_CHANGED')
        assert_target()  # actual fresh owned CID/profile/run assertion, never request identity
    gate()
    # Exclusive durable claim: an interrupted dispatch is consumed, never replayed.
    claim = Path(output) / 'consumer-attempt.claim'
    with claim.open('xb') as f:
        import os
        os.chmod(claim, 0o600)
        f.write((fixture.run_id + ':' + fixture.attempt + ':' + admitted).encode())
        f.flush()
        os.fsync(f.fileno())
    state = {'status': 'DISPATCHED', 'witness': 'NOT_RUN', 'observer': 'NOT_RUN',
             'residue': 'UNKNOWN', 'rollback': {'state': 'not_observed'},
             'run': fixture.run_id, 'attempt': fixture.attempt, 'cid': fixture.pg_cid}
    persist(state)
    installer = observer = None
    primary = None
    try:
        installer = Wire(fixture.pg_cid, fixture.run_id, fixture.attempt, 'installer', output, docker, env, gate)
        first = installer.identity(gate)
        state['installer_identity'] = first
        persist(state)
        result = installer.query((DIRECTORY / 'witness.sql').read_bytes(), gate)
        state['witness_terminal'] = result
        persist(state)
        if result['errors']:
            raise WireError('WITNESS_SQL_ERROR:' + result['errors'][0])
        require_rollback(result)
        state['rollback'] = {'state': 'acknowledged', 'pid': installer.pid, 'chain': result['chain']}
        if (len(result['rows']) != 1 or result['rows'][0] != {
                'stage': 'ACL02_ASSERTIONS_REACHED', 'synthetic_only': True, 'backend_pid': installer.pid,
                'case_ids': ['D00','D01','D02','D03','P01','P02','D04','D05','D06','D07','D08']}):
            raise WireError('UNKNOWN_ASSERTION_RESULT')
        state['witness'] = 'PASSED_SYNTHETIC_ONLY'
    except Exception as error:
        primary = str(error)
        state['primary_error'] = primary
        if installer is not None and state['rollback']['state'] != 'acknowledged':
            try:
                state['rollback'] = installer.rollback_known()
            except Exception as settlement:
                state['rollback'] = {'state': 'unknown', 'error': str(settlement)}
        persist(state)
    try:
        # Observer only when rollback independently acknowledged, even on SQL error.
        if state['rollback']['state'] == 'acknowledged':
            gate()
            observer = Wire(fixture.pg_cid, fixture.run_id, fixture.attempt, 'observer', output, docker, env, gate)
            other = observer.identity(gate)
            state['observer_identity'] = other
            result = observer.query((DIRECTORY / 'verify-clean.sql').read_bytes(), gate, 15)
            state['observer_terminal'] = result
            require_residue(result, first, other)
            state.update(observer='COMPLETED', residue='ZERO_OBSERVED')
        else:
            state['observer'] = 'NOT_RUN_ROLLBACK_UNPROVED'
    except Exception as error:
        state.setdefault('primary_error', str(error))
        state['observer'] = 'FAILED_OR_UNKNOWN'
    finally:
        for connection in (observer, installer):
            if connection is not None:
                try:
                    connection.close()
                except Exception as error:
                    state.setdefault('primary_error', str(error))
                    state.setdefault('close_errors', []).append(str(error))
        state['status'] = ('PASSED' if not state.get('primary_error') and
                           state['residue'] == 'ZERO_OBSERVED' else 'FAILED_OR_UNKNOWN')
        persist(state)
    return state
