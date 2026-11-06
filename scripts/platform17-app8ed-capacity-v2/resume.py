"""Start-only continuation of the exact ended R2 attempt; no build or old stop."""
import json
import re
import subprocess
from pathlib import Path

PRIOR_TOOL = {'sha': 'a2adc012d488fbb91a787c79e19ee54081f1a722',
              'tree': 'b6428c9eb1630c493b099ce0b981972656818045',
              'seal_sha256': '3171bbeea3510637cb839b5b801b5aaaf13b8ba4957a28da95bd4b282b91425f'}

def prepare_request(prior_raw, prior_result_raw, tool, run_id, C):
    old = C.validate(C.parse(prior_raw))
    C.need(old['tool'] == PRIOR_TOOL and run_id != old['run_id'], 'PREPARE_EXACT_PRIOR_R2')
    request = C.parse(prior_raw)  # Never mutate the archived prior request.
    request.update(tool=tool, run_id=run_id)
    result = C.parse(prior_result_raw)
    outer = {'contract': 'platform17.exact-built-start-continuation.v1', 'request': request,
             'prior': {'request_sha256': C.sha(prior_raw), 'result_sha256': C.sha(prior_result_raw)},
             'expected_build': result['evidence']['new_build']}
    validate((json.dumps(outer, indent=2) + '\n').encode(), C)
    return outer

def prepare_private(H, prior_digest, run_id, C):
    C.digest(prior_digest)
    C.need(re.fullmatch(r'app8ed-[a-z0-9-]{8,64}', run_id) is not None, 'RUN_ID')
    def git(*args):
        return subprocess.check_output(['git', '-C', str(H.TOOL), *args], timeout=20).decode().strip()
    C.need(not git('status', '--porcelain') and git('rev-parse', 'HEAD^') == H.TOOL_PARENT,
           'PREPARE_TOOL_SOURCE_NOT_EXACT')
    tool = {'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
            'seal_sha256': H.seal_identity()}
    raw = H.private_read(H.AUTHORITY_ROOT / 'requests' / (prior_digest + '.json'))
    C.need(C.sha(raw) == prior_digest, 'PRIOR_REQUEST_DIGEST')
    old = C.validate(C.parse(raw))
    result = H.private_read(H.AUTHORITY_ROOT / 'runs' / old['run_id'] / 'result.private.json')
    outer = prepare_request(raw, result, tool, run_id, C)
    data = (json.dumps(outer, indent=2) + '\n').encode(); digest = C.sha(data)
    destination = H.AUTHORITY_ROOT / 'requests' / (digest + '.json')
    H.persist(destination, outer)
    C.need(H.private_read(destination) == data, 'PREPARED_REQUEST_READBACK')
    return {'state': 'REQUEST_PREPARED_NOT_AUTHORIZED', 'request_sha256': digest,
            'run_id': run_id, 'registry': 'NOT_WRITTEN', 'native': 'NOT_RUN'}

def validate(raw, C):
    outer = C.parse(raw)
    C.fields(outer, ('contract', 'request', 'prior', 'expected_build'), 'RESUME_FIELDS')
    C.need(outer['contract'] == 'platform17.exact-built-start-continuation.v1', 'RESUME_CONTRACT')
    r = C.validate(outer['request'])
    C.fields(outer['prior'], ('request_sha256', 'result_sha256'), 'RESUME_PRIOR_FIELDS')
    for value in outer['prior'].values(): C.digest(value)
    build = outer['expected_build']
    C.fields(build, ('id', 'files', 'served_manifest_sha256'), 'RESUME_BUILD_FIELDS')
    C.need(type(build['id']) is str and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', build['id']) is not None,
           'RESUME_BUILD_ID')
    C.fields(build['files'], C.BUILD_FILES, 'RESUME_BUILD_FILE_SET')
    for value in (*build['files'].values(), build['served_manifest_sha256']): C.digest(value)
    return outer, r

def verify_prior(h, outer, r, H, C):
    prior = outer['prior']; digest = prior['request_sha256']
    raw = H.private_read(H.AUTHORITY_ROOT / 'requests' / (digest + '.json'))
    C.need(C.sha(raw) == digest, 'PRIOR_REQUEST_DIGEST')
    old = C.validate(C.parse(raw))
    C.need(old['tool'] == PRIOR_TOOL and old['run_id'] != r['run_id'], 'PRIOR_EXACT_R2_NOT_REUSED')
    C.need({k: v for k, v in old.items() if k not in ('tool', 'run_id')} ==
           {k: v for k, v in r.items() if k not in ('tool', 'run_id')}, 'PRIOR_TARGET_OR_BINDING_DRIFT')
    directory = H.canonical(H.AUTHORITY_ROOT / 'runs' / old['run_id'])
    data = H.private_read(directory / 'result.private.json')
    C.need(C.sha(data) == prior['result_sha256'], 'PRIOR_RESULT_DIGEST')
    result = C.parse(data)
    C.need(result['state'] == 'UNKNOWN_STOPPED_NO_RETRY' and
           result['first_error'] == {'type': 'Unknown', 'message': 'START_LISTENER_PID_OBSERVATION_DENIED'} and
           result['old_stop'] == 'ACK' and result['start_dispatch'] == 'DISPATCHED_MAY_EXIST',
           'PRIOR_EXACT_END_STATE')
    cleanup = result['cleanup']
    C.need(type(cleanup) is list and len(cleanup) == 2 and
           {x.get('resource') for x in cleanup} == {'new_app', 'new_build'} and
           all(x.get('state') == 'ACK' for x in cleanup), 'PRIOR_CLEANUP_NOT_ACK')
    C.need(next(x for x in cleanup if x['resource'] == 'new_build')['exit'] == 0,
           'PRIOR_BUILD_EXIT_NOT_ZERO')
    C.need(result['evidence']['new_build'] == outer['expected_build'] == h.read_build(r),
           'PRIOR_SUCCESSFUL_BUILD_DRIFT')
    records = {}
    for kind, argv in (('build', C.BUILD_ARGV), ('start', C.START_ARGV)):
        paths = [p for p in directory.iterdir() if re.fullmatch(r'[0-9]{6}-' + kind + r'-process\.private\.json', p.name)]
        C.need(len(paths) == 1, 'PRIOR_PROCESS_RECORD_NOT_UNIQUE')
        raw_record = H.private_read(paths[0]); record = C.parse(raw_record); born = record['identity']
        C.need(record['tool'] == PRIOR_TOOL and record['source'] == C.BASE and record['argv'] == list(argv),
               'PRIOR_PROCESS_RECORD_BINDING')
        C.need(type(born['pid']) is int and born['pid'] > 1 and
               born['pid'] == born['pgrp'] == born['session'] and born['uid'] == H.os.getuid(),
               'PRIOR_GROUP_CUSTODY')
        C.need(not H.group_members(born['pid']), 'PRIOR_CHILD_GROUP_STILL_LIVE')
        try:
            now = H.proc_identity(born['pid'])
            C.need(now['start_ticks'] != born['start_ticks'] or now['state'] == 'Z', 'PRIOR_CHILD_STILL_LIVE')
        except FileNotFoundError: pass
        records[kind] = C.sha(raw_record)
    h.old_stopped = True  # Independently re-observed below; never signal it again.
    C.check_snapshot(h.observe(r, old_stopped=True), r, old_stopped=True)
    C.need(h.port_free(), 'RESUME_PORT_ALREADY_OCCUPIED')
    return {'request_sha256': digest, 'result_sha256': prior['result_sha256'],
            'process_record_sha256': records, 'build': outer['expected_build'],
            'old_stop': 'PREVIOUS_ACK_NOT_REPLAYED', 'build_action': 'REUSED_NOT_REBUILT'}

def enough_start(h, C):
    sample = h.sample()
    C.need(sample['available_bytes'] > C.EARLY_STOP and sample['free_inodes'] > 0,
           'RESUME_START_CAPACITY_HOLD')

def run(h, raw, H, C):
    outer, r = validate(raw, C)
    h.authorize(r, C.sha(raw))
    prior = verify_prior(h, outer, r, H, C)
    enough_start(h, C); h.current(r)
    facts = {'prior': prior, 'new_build': outer['expected_build']}
    start = 'NOT_RUN'; new = None; claimed = False; clean = []
    try:
        h.claim(r, C.sha(raw)); claimed = True
        h.record('resume-prior-verified', prior)
        h.preflight(r)
        h.probe_observation(r, outer['expected_build'])
        clean.append(h.probe_cleanup)
        h.current(r)
        C.need(verify_prior(h, outer, r, H, C) == prior, 'PRIOR_CHANGED_AFTER_PREFLIGHT')
        enough_start(h, C); h.current(r)
        h.record('resume-start-intent', {'argv': C.START_ARGV, 'build': outer['expected_build'],
                                       'build_action': 'NOT_DISPATCHED', 'old_stop_action': 'NOT_DISPATCHED'})
        start = 'DISPATCHING_MAY_EXIST'
        new = h.spawn_start(r, outer['expected_build'])
        start = 'DISPATCHED_MAY_EXIST'
        facts['served'] = h.start_ack(new, r, outer['expected_build'])
        h.current(r)
        C.check_snapshot(h.observe(r, old_stopped=True), r, old_stopped=True)
        C.need(h.read_build(r) == outer['expected_build'], 'RESUME_BUILD_DRIFT_AFTER_ACK')
        h.current(r); h.record('app-retained', facts['served']); h.current(r)
        result = C.Outcome('ACK_EXACT_APP8ED_RETAINED', None, clean,
                           'PREVIOUS_ACK_NOT_REPLAYED', 'ACK', facts)
    except BaseException as error:
        new = new or h.possible_start()
        if new is not None or start != 'NOT_RUN':
            try: clean.append(h.cleanup_start(new))
            except BaseException as secondary:
                clean.append({'resource': 'new_app', 'state': 'UNKNOWN', 'error': str(secondary)})
        if h.probe_cleanup is not None and h.probe_cleanup not in clean: clean.append(h.probe_cleanup)
        unknown = isinstance(error, C.Unknown) or any(x['state'] == 'UNKNOWN' for x in clean)
        result = C.Outcome('UNKNOWN_STOPPED_NO_RETRY' if unknown else 'FAILED_STOPPED_NO_RETRY',
            {'type': type(error).__name__, 'message': str(error)}, clean,
            'PREVIOUS_ACK_NOT_REPLAYED', start, facts)
    if claimed:
        try: h.finish(result)
        except BaseException as error:
            failure = {'type': type(error).__name__, 'message': str(error)}
            result.evidence['finish_error'] = failure
            result.first_error = result.first_error or failure
            result.state = 'UNKNOWN_RECEIPT_PERSISTENCE_NO_RETRY'
            result.evidence['custody_followup'] = {'owner': 'Platform', 'deadline_seconds': 600,
                'new_app': 'RETAINED_ACK' if result.start_dispatch == 'ACK' else 'SEE_CLEANUP_AND_DISPATCH_STATE',
                'no_retry': True}
    return result
