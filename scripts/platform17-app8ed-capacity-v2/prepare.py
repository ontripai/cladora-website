"""Read the accepted active full-transition delivery; prepare private data, never authority."""
import copy
import json
import os
import re
from pathlib import Path

PRIOR_ROOT = Path('/workspace/private/platform17-service-scope-adoption-01')
PRIOR_ADMISSION = Path('/workspace/private/platform-service-consumer-rehearsal-17/exact-consumer-f2b3c01f-01/consumer-admission.json')
PRIOR_TOOL = {'sha': 'e5fe6eabd3a0d77128f0863b7a5ac9ce35535436',
              'tree': '41b43275f7bf63db0fca44b93a6f764ecd515ae8',
              'seal_sha256': '0e17be1f02385f5413f95f35c913a9d0b440b0497141d8bcc7cd6c6edfd8bc22'}


def derive(outer, result, admission, tool, run_id, C):
    """Pure projection. Prior source/transport/build must agree before any write."""
    C.need(outer['contract'] == 'platform17.service-scope-adoption.request.v1', 'PREPARE_PRIOR_CONTRACT')
    prior = outer
    C.need(prior['tool'] == PRIOR_TOOL and prior['consumer'] == {
        'root': C.OLD_ROOT, 'sha': C.OLD, 'tree': C.OLD_TREE,
        'launcher_sha256': C.LAUNCHER}, 'PREPARE_EXACT_ACCEPTED_ACTIVE_SOURCE')
    C.need(result['state'] == 'ACK_EXACT_CONSUMER_RETAINED'
           and result['first_error'] is None and result['start_dispatch'] == 'ACK',
           'PREPARE_PRIOR_RETAINED_ACK')
    served = result['evidence']['served']
    C.need(served['source'] == C.OLD and served['tree'] == C.OLD_TREE
           and served['build'] == result['evidence']['new_build'],
           'PREPARE_PRIOR_SERVED_BUILD')
    listener = served['listener']
    C.need(listener['cwd'] == C.OLD_ROOT and listener['argv'] == ['next-server (v16.4.1)']
           and listener['uid'] == os.getuid(), 'PREPARE_PRIOR_LISTENER_IDENTITY')
    C.need(admission['contract'] == 'core17.exact-app-consumer-admission.v1'
           and admission['consumer'] == prior['consumer']
           and admission['source_base'] == C.ANCHOR and admission['installed_Core_base'] == C.CORE
           and admission['origin'] == 'http://localhost:3008'
           and admission['transport']['binding_sha256'] == prior['transport']['binding_sha256']
           and admission['transport']['relay_seal_sha256'] == prior['transport']['relay_seal_sha256'],
           'PREPARE_PRIOR_ADMISSION')
    record = {'source': C.OLD, 'tree': C.OLD_TREE, 'pid': listener['pid'],
              'start_ticks': listener['start_ticks'], 'build': copy.deepcopy(served['build']),
              'provenance': 'accepted-previous-retained-evidence-with-fresh-kernel-recheck'}
    new = copy.deepcopy(prior)
    new.update(contract='platform17.service-custody-adoption.request.v1', run_id=run_id, tool=tool,
               consumer={'root': C.APP_ROOT, 'sha': C.BASE, 'tree': C.NEW_TREE,
                         'launcher_sha256': C.LAUNCHER},
               old_app={**prior['consumer'], 'pid': listener['pid'], 'start_ticks': listener['start_ticks'],
                        'argv': listener['argv'], 'record_sha256': C.sha(encoded(record)),
                        'build': copy.deepcopy(served['build'])})
    new_admission = copy.deepcopy(admission)
    new_admission['consumer'] = copy.deepcopy(new['consumer'])
    new['admission'] = {'file': C.ADMISSION, 'sha256': C.sha(encoded(new_admission))}
    C.validate(new)
    return new, record, new_admission


def encoded(value):
    return (json.dumps(value, indent=2) + '\n').encode()


def directory(path, H, C):
    path = H.canonical(path)
    if not path.exists(): path.mkdir(mode=0o700, parents=True)
    C.need(path.stat().st_uid == os.getuid() and not path.stat().st_mode & 0o077,
           'PREPARE_DIRECTORY_CUSTODY')


def prepare_private(H, run_id, C):
    # This command reads historical authority as evidence only. It cannot reuse
    # its expiry/claim and never writes the new registry or a claim directory.
    H.seal_identity()
    def git(*args):
        return H.NativeHost.git(None, H.TOOL, *args).decode().strip()
    C.need(not git('status', '--porcelain') and git('rev-parse', 'HEAD^') == H.TOOL_PARENT,
           'PREPARE_EXACT_CLEAN_TOOL')
    tool = {'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
            'seal_sha256': H.seal_identity()}
    registry = C.parse(H.private_read(PRIOR_ROOT / 'coordinator-accepted-executions.json'))
    C.fields(registry, ('contract', 'entries'), 'PREPARE_PRIOR_REGISTRY_FIELDS')
    C.need(registry['contract'] == 'platform17.coordinator-execution-registry.v2'
           and type(registry['entries']) is list and len(registry['entries']) == 1,
           'PREPARE_ONE_PRIOR_ENTRY')
    entry = registry['entries'][0]; digest = entry['request_sha256']; C.digest(digest)
    raw = H.private_read(PRIOR_ROOT / 'requests' / (digest + '.json'))
    C.need(C.sha(raw) == digest, 'PREPARE_PRIOR_REQUEST_DIGEST')
    outer = C.parse(raw); prior = outer
    C.need(entry['tool'] == prior['tool'] == PRIOR_TOOL
           and entry['run_id'] == prior['run_id'], 'PREPARE_PRIOR_ENTRY_BINDING')
    C.need(type(prior['run_id']) is str and re.fullmatch(r'app8ed-[a-z0-9-]{8,64}', prior['run_id']),
           'PREPARE_PRIOR_RUN_ID')
    result = C.parse(H.private_read(PRIOR_ROOT / 'runs' / prior['run_id'] / 'result.private.json'))
    admission_raw = H.private_read(PRIOR_ADMISSION)
    admission = C.parse(admission_raw)
    C.need(C.sha(admission_raw) == prior['admission']['sha256'],
           'PREPARE_PRIOR_ADMISSION_DIGEST')
    r, record, new_admission = derive(outer, result, admission, tool, run_id, C)
    observed = H.process_full(record['pid'])
    C.need(observed['start_ticks'] == record['start_ticks']
           and observed['state'] != 'Z' and observed['cwd'] == C.OLD_ROOT
           and observed['argv'] == r['old_app']['argv'] and observed['uid'] == os.getuid(),
           'PREPARE_FRESH_ACTIVE_KERNEL_IDENTITY')
    for path in (Path(C.PRIVATE), H.AUTHORITY_ROOT, H.AUTHORITY_ROOT / 'requests'):
        directory(path, H, C)
    H.persist(Path(C.OLD_RECORD), record)
    H.persist(Path(C.ADMISSION), new_admission)
    # Fully re-observe sources, old build, protected Core, binding and relay
    # before a request is offered for independent authorization.
    data = encoded(r); digest = C.sha(data)
    h = H.NativeHost(r, digest, b'', {})
    C.check_snapshot(h.observe(r), r)
    H.persist(H.AUTHORITY_ROOT / 'requests' / (digest + '.json'), r)
    C.need(H.private_read(H.AUTHORITY_ROOT / 'requests' / (digest + '.json')) == data,
           'PREPARE_REQUEST_READBACK')
    return {'state': 'EXACT_REQUEST_PREPARED_NOT_AUTHORIZED', 'request_sha256': digest,
            'run_id': run_id, 'tool': tool, 'registry': 'NOT_WRITTEN', 'claim': 'NOT_CREATED',
            'build_start_stop': 'NOT_RUN'}
