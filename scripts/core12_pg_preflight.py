#!/usr/bin/env python3
"""Pure fixed Core12 admission/receipt preflight. No dispatch, SQL parser or transport."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '1eb8b5a1e522a529b39af02e32748756ee04dfec'
PROFILE = ROOT / 'supabase/local-profiles/runtime-pg-only-core12-preflight-v1.json'
REQUEST = ROOT / 'supabase/local-profiles/core12-pg-only.request.json'
REGISTRY = ROOT / 'supabase/local-profiles/core12-pg-only-reviews-v1.json'
PROFILE_SHA = '3daa756dc51c6f86c30231954775a639a766adcb6d75564f713041ad58600cac'
PAYLOAD = {'id':'core12-boundary-witness','source_commit':SOURCE,
           'path':'supabase/proposals/core-canonical-sqlstate-boundary-v1/pg-only-boundary.test.sql',
           'bytes':20744,'sha256':'07072fdae234825786709260befa0b2c5337b0379ce852f072fdbfb9d17a9158',
           'git_blob':'0a187e6d8d8025108578583b5401c78114883c64'}
REUSED = {
    'scripts/run-local-runtime-lane.py':'8f0a964041cb4c2a78ab37ec7fc5c36be817d106cb396f598e625ef62907068e',
    'scripts/local_runtime_consumer.py':'b240725de9119e0176e49fb0bc55f4917ef8df79a9383cb8d77ed97ca579d439',
    'scripts/run-acl02-pg-only.py':'bde75479e6b90c4ebec91742e19f8962d50b8842597b8362459d91dc0b5e5c4a',
    'scripts/acl02_pg_adapter.py':'72d7a69026cfe5d0dd15d6d5d4394ef62c4fced016919064150d3bc5ab5c361a',
    'scripts/acl02_pg_wire.py':'4fa852fbdb6047ec3c264e1fee53b6218d9db9abf8b462d29e10d24fc4b242c3',
    'supabase/local-profiles/runtime-pg-only-acl02-v1.json':'aa394a6068f75a438a3118f63c949984745d8ce46fc9cb69c525e51dd67cfaaa'}


class Hold(ValueError):
    pass


def need(value, reason):
    if not value:
        raise Hold(reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def unique(pairs):
    out = {}
    for key, value in pairs:
        need(key not in out, 'DUPLICATE_REQUEST_KEY')
        out[key] = value
    return out


def profile():
    raw = PROFILE.read_bytes(); need(sha(raw) == PROFILE_SHA, 'CORE12_PROFILE_DRIFT')
    return json.loads(raw)


def source_seal():
    for name, value in REUSED.items():
        need(sha((ROOT/name).read_bytes()) == value, 'REUSED_LANE_SOURCE_DRIFT')
    profile()
    files = {**REUSED, str(PROFILE.relative_to(ROOT)):PROFILE_SHA,
             'scripts/core12_pg_preflight.py':sha(Path(__file__).read_bytes())}
    return {'files':files,'sha256':sha(canonical(files))}


def expected_request():
    p = profile()
    return {
        'format':'core12-pg-only-admission-request.v1','consumer':'Core/SQLSTATE-BOUNDARY-12',
        'source_commit':SOURCE,'payloads':[PAYLOAD.copy()], 'source_seal':source_seal(),
        'profile':{'path':str(PROFILE.relative_to(ROOT)),'sha256':PROFILE_SHA},
        'proof_scope':'exact extracted exception clauses only; no canonical authorization or genuine SSI',
        'planned_calls':176,'executed_calls':None,'target':None,'executor':None,'observer':None,
        'authority':None,'execution_binding':None,'live':'HOLD','registry':'EMPTY',
        'prerequisites':{
            'database_name':'core_sqlstate_boundary_proof','pg_major':17,'kind':'owned-disposable-pg17-only',
            'auth_present':False,'executor_requirements':p['executor_required'],
            'namespaces_absent':p['namespaces_absent'],'setup_payload':None,
            'identity_payload':None,'observer_payload':None,'baseline':None,
            'guard_latch':p['guard_latch'],'allow_set_role':False,
            'ordinary_executor_current_identity_required':True},
        'existing_runtime':p['existing_runtime'],
        'send_contract':{'order':['identity-and-independent-baseline','single-exact-core12-payload','same-stream-terminal','independent-observer','owned-cleanup'],
            'payload_transformation':'FORBIDDEN_NO_SPLIT_OR_RENDER','attempts':1,'automatic_retry':False,
            'transaction':'source contains one SERIALIZABLE BEGIN and final ROLLBACK; no added COMMIT',
            'sql_local_limits':{'lock_timeout_ms':2000,'statement_timeout_ms':10000},
            'deadlines_seconds':p['deadlines_seconds'],'wire_limits':p['wire_limits'],
            'terminal_required':{'errors':[],'last_two_CommandComplete':['DO','ROLLBACK'],'ReadyForQuery':'I',
                'same_physical_backend':True,'same_connection':True,'raw_ledger_fsync_before_ack':True},
            'unknown':'STOP_AND_QUARANTINE_NO_REPLAY_OR_SUCCESS','fallback_rollback':'only a known same stream in T/E; never on unknown backend; skipped is not ACK'},
        'custody_contract':{'fresh_run_and_attempt':True,'cid_database_oid_system_identifier':'bind observed values; never request label or old fixture',
            'check_before_every_effect_and_after_wait':True,'single_use_claim':'durable before dispatch; interruption consumes attempt',
            'privilege_source':'fresh physical principal/catalog evidence, not GUC/approved flag/OS uid'},
        'observer_contract':{'independent_physical_connection':True,'different_backend_pid':True,
            'same_cid_database_oid_system_identifier':True,'only_after_rollback_ack':True,
            'residue':'zero witness functions/table and protected roles/schemas/ACL/defaults equal independent pre-witness baseline',
            'temp_namespace_address':'actual catalog addresses, not observer pg_temp alias','partial_snapshot':'UNKNOWN_NOT_ZERO',
            'exact_payload_and_baseline_binding':None,'laboratory_deletion_is_residue_proof':False},
        'receipt_plan':{'default_stage':'NOT_RUN','identity_fields':['request_sha256','source_commit','payload_sha256','profile_sha256','source_seal_sha256','run_id','attempt','cid','database','database_oid','system_identifier','session_user','current_user','backend_pid','connection_id'],
            'wire':'ordered raw bytes/length/hash-chain/fsync with actual CommandComplete and ReadyForQuery; no cancellation key persistence',
            'xid':'record only observed textual XID; no inference after opaque payload or DDL',
            'first_error':'immutable primary; settlement/observer/cleanup failures separate',
            'planned_calls_not_observed_counter':True,'stages':['provision','identity','baseline','witness','rollback','observer','residue','cleanup'],
            'privacy':'raw wire/catalog/custody private; safe status and digests only'},
        'cleanup_plan':{'implementation':'scripts/run-local-runtime-lane.py:Lane.cleanup + finalize_lifecycle',
            'scope':'only actual owned CID and newly acquired unused pinned image; never prune or shared resources',
            'expected_resources':'derive complete list from actual custody, not request supplied labels',
            'states':['attempted','acknowledged-absent','removal-acknowledged','skipped-preexisting','failed','unknown'],
            'skip_rule':'preexisting image skip only; cannot stand for owned container removal',
            'missing_duplicate_partial_or_unknown':'nonzero overall result even if health/witness looked successful',
            'residue_before_destruction':True,'custodian':'Platform','unknown_followup':'retain exact receipt/resource identity and refer coordinator; no blind retry'},
        'readiness_gaps':p['readiness_gaps']}


def request_bytes():
    return (json.dumps(expected_request(),indent=2)+'\n').encode()


def validate_payload(raw):
    need(type(raw) is bytes and len(raw) == PAYLOAD['bytes'] and sha(raw) == PAYLOAD['sha256'], 'CORE12_EXACT_PAYLOAD_REQUIRED')
    need(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == PAYLOAD['git_blob'], 'CORE12_GIT_IDENTITY')


def inspect_request(raw, payload):
    need(type(raw) is bytes and 0 < len(raw) <= 32768, 'CORE12_REQUEST_BOUND')
    try:
        value = json.loads(raw,object_pairs_hook=unique)
    except (ValueError,UnicodeError) as error:
        if isinstance(error,Hold): raise
        raise Hold('CORE12_REQUEST_JSON') from error
    need(value == expected_request(), 'CORE12_EXACT_DRAFT_BINDING')
    need(raw == request_bytes(), 'CORE12_EXACT_REQUEST_BYTES')
    validate_payload(payload)
    return {'status':'DRAFT_BYTES_VALID_NOT_EXECUTABLE','request_sha256':sha(raw),'source_seal':source_seal()['sha256'],
            'planned_calls':176,'executed_calls':None,'target':None,'executor':None,'authority':None,'live':'HOLD'}


def admit(raw, payload):
    inspect_request(raw,payload)
    registry = json.loads(REGISTRY.read_bytes(),object_pairs_hook=unique)
    need(set(registry) == {'format','reviews'} and registry['format'] == 'core12-pg-only-preflight-reviews.v1'
         and isinstance(registry['reviews'],dict), 'CORE12_REGISTRY_SHAPE')
    # No registry entry, GUC, approved flag or URL alone can activate this draft.
    need(not registry['reviews'], 'HOLD_INACTIVE_CORE12_BINDING')
    raise Hold('HOLD_REVIEW_TARGET_EXECUTOR_AND_ADAPTER_UNBOUND')


def validate_identity_model(value):
    """Offline proposed observation SHAPE only. Never an authority or fixture."""
    keys = {'kind','database','database_oid','system_identifier','version','pid','current_user','session_user','rolsuper','rolbypassrls',
            'rolcreaterole','rolcreatedb','rolreplication','database_connect','database_temp','own_pg_temp_function_rights','plpgsql_usage','function_default_acl_rows','namespaces_present'}
    need(type(value) is dict and set(value) == keys, 'CORE12_IDENTITY_SHAPE')
    need(value['kind'] == 'owned-disposable-pg17-only' and value['database'] == 'core_sqlstate_boundary_proof'
         and type(value['version']) is int and 170000 <= value['version'] < 180000, 'CORE12_WRONG_TARGET')
    need(type(value['pid']) is int and value['pid'] > 0 and re.fullmatch(r'[1-9][0-9]*',str(value['database_oid']))
         and re.fullmatch(r'[1-9][0-9]*',str(value['system_identifier'])), 'CORE12_PHYSICAL_IDENTITY_REQUIRED')
    need(isinstance(value['current_user'],str) and re.fullmatch('[a-z][a-z0-9_]{0,62}',value['current_user'])
         and value['current_user'] == value['session_user'] and value['current_user'] not in ('postgres','supabase_admin','service_role'), 'CORE12_WRONG_EXECUTOR')
    for k in ('rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'):
        need(value[k] is False, 'CORE12_PRIVILEGED_EXECUTOR')
    for k in ('database_connect','database_temp','own_pg_temp_function_rights','plpgsql_usage'):
        need(value[k] is True, 'CORE12_REQUIRED_RIGHT_UNKNOWN')
    need(type(value['function_default_acl_rows']) is int and value['function_default_acl_rows'] == 0
         and value['namespaces_present'] == [], 'CORE12_NONEMPTY_OR_DEFAULT_ACL')
    return 'MODEL_SHAPE_ONLY_NOT_RUNTIME_PROOF'


def _base_lifecycle():
    source_seal()
    helper_path = ROOT/'scripts/local_runtime_consumer.py'
    helper = sys.modules.get('local_runtime_consumer')
    if helper:
        need(Path(helper.__file__).resolve() == helper_path, 'CORE12_FOREIGN_HELPER_MODULE')
    else:
        spec = importlib.util.spec_from_file_location('local_runtime_consumer',helper_path)
        helper = importlib.util.module_from_spec(spec); sys.modules[spec.name] = helper; spec.loader.exec_module(helper)
    spec = importlib.util.spec_from_file_location('core12_existing_lifecycle',ROOT/'scripts/run-local-runtime-lane.py')
    base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
    return base


def closeout_model(receipt, owned, images):
    """Offline contract exercise; calls existing pure finalizer, NEVER Wire/Lane.

    JSON is not physical evidence. This return never claims a real proof PASS.
    """
    r = copy.deepcopy(receipt)
    terminal, first = r.get('terminal',{}), r.get('installer_identity',{})
    other, observer = r.get('observer_identity',{}), r.get('observer',{})
    wire_ok = (not terminal.get('errors') and terminal.get('ready') == 'I' and terminal.get('tags',[])[-2:] == ['DO','ROLLBACK']
               and terminal.get('pid') == first.get('pid') and first.get('pid') is not None
               and terminal.get('fsync_ack') is True and re.fullmatch('[a-f0-9]{64}',str(terminal.get('chain'))))
    wire_ok = wire_ok and r.get('request_sha256') == sha(request_bytes()) and terminal.get('request_sha256') == r['request_sha256']
    wire_ok = wire_ok and terminal.get('payload_sha256') == PAYLOAD['sha256']
    wire_ok = wire_ok and bool(re.fullmatch('core12-witness-[a-f0-9]{16}',str(r.get('installer_connection_id')))) and terminal.get('connection_id') == r['installer_connection_id']
    for key, pattern in [('run_id','cladora-lane-[a-f0-9]{12}'),('attempt','[a-f0-9]{32}'),('cid','[a-f0-9]{64}')]:
        wire_ok = wire_ok and bool(re.fullmatch(pattern,str(r.get(key)))) and terminal.get(key) == r[key]
    identities_ok = bool(first and other)
    for identity in (first,other):
        try: validate_identity_model(identity)
        except Hold: identities_ok = False
    identities_ok = identities_ok and first['pid'] != other['pid'] and all(first[k] == other[k] for k in ('database','database_oid','system_identifier','version'))
    residue_ok = (observer.get('state') == 'completed' and observer.get('pid') == other.get('pid') and observer.get('witness_functions_remaining') == 0
                  and type(observer.get('witness_functions_remaining')) is int and observer.get('matrix_remaining') == 0
                  and type(observer.get('matrix_remaining')) is int and observer.get('protected_before') == observer.get('protected_after')
                  and bool(re.fullmatch('[a-f0-9]{64}',str(observer.get('protected_before')))) and observer.get('snapshot_complete') is True)
    if not (wire_ok and identities_ok and residue_ok) and not r.get('primary_error'): r['primary_error'] = 'UNKNOWN_CORE12_TERMINAL_OBSERVER_OR_RESIDUE'
    r['consumer'] = {'status':'PASSED' if wire_ok and identities_ok and residue_ok and not r.get('primary_error') else 'FAILED_OR_UNKNOWN'}
    _base_lifecycle().finalize_lifecycle(r,owned,images,pg_only=True)
    return {'assessment':'OFFLINE_MODEL_NOT_RUNTIME_PROOF','model_criteria_satisfied':r['overall_result'] == 'PASSED',
            'required_exit_code':r['exit_code'],'primary_error':r.get('primary_error'),'cleanup_completeness':r['cleanup_completeness'],
            'cleanup_gaps':r['cleanup_gaps'],'health_result_preserved':r.get('health_result'),'live':'HOLD'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,allow_abbrev=False)
    parser.add_argument('--inspect-source',required=True,help='read-only source byte check, never SQL parsing/execution')
    args = parser.parse_args(argv)
    source = Path(args.inspect_source)
    need(not source.is_symlink() and source.is_file() and source.stat().st_nlink == 1, 'CORE12_SOURCE_FILE_ALIAS')
    with source.open('rb') as stream: payload = stream.read(PAYLOAD['bytes']+1)
    print(json.dumps(inspect_request(REQUEST.read_bytes(),payload)))
    return 0


if __name__ == '__main__':
    try: sys.exit(main())
    except Hold as error:
        print(json.dumps({'status':'HOLD','reason':str(error),'live':'HOLD'})); sys.exit(2)
