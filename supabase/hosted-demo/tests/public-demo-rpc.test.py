"""Real-hosted two-user test. Native role/MFA guards stay unchanged.

Run with CLADORA_PUBLIC_DEMO_HOSTED_TEST=1 and dedicated staging variables.
After independent owner readback, run the same command with argument cleanup.
Credentials remain in a mode0600 temporary file and are never printed.
"""
import base64
import collections
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid

TARGET = 'ryygcqiunqqtfkpkflzf'
ROOT = Path(os.environ.get('CLADORA_DEMO_TEST_ARTIFACT_DIR', str(Path(tempfile.gettempdir()) / 'cladora-public-demo-tests')))
ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
PRIVATE = ROOT / '.private'
STATE_FILE = PRIVATE / 'public-demo-test-sessions.json'
RECEIPT = ROOT / 'public-demo-hosted.receipt.json'
assert os.environ.get('CLADORA_PUBLIC_DEMO_HOSTED_TEST') == '1'
assert os.environ['CLADORA_STAGING_PROJECT_REF'] == TARGET
URL = os.environ['CLADORA_STAGING_SUPABASE_URL'].rstrip('/')
assert urllib.parse.urlparse(URL).hostname == TARGET + '.supabase.co'
ADMIN = os.environ['CLADORA_STAGING_SUPABASE_SECRET_KEY']
PUBLIC = os.environ['CLADORA_STAGING_SUPABASE_PUBLISHABLE_KEY']


def http(path, method='GET', body=None, token=None, admin=False, schema=None):
    headers = {'apikey': ADMIN if admin else PUBLIC}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if schema:
        headers['Content-Profile'] = schema
        headers['Accept-Profile'] = schema
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None


def rpc(actor, name, body=None):
    code, result = http('/rest/v1/rpc/' + name, 'POST', body or {},
                       token=actor['access_token'], schema='customer_api')
    if code >= 400:
        receipt['last_error'] = {'rpc': name, 'http': code,
                                 'code': result.get('code') if isinstance(result, dict) else None,
                                 'message': str(result.get('message', ''))[:300] if isinstance(result, dict) else ''}
    return code, result


def save():
    PRIVATE.mkdir(mode=0o700, exist_ok=True)
    os.chmod(PRIVATE, 0o700)
    fd = os.open(STATE_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as out:
        json.dump(state, out)


def check(label, condition):
    receipt['checks'].append({'check': label, 'passed': bool(condition)})
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    if not condition:
        raise RuntimeError(label)


def ok(actor, name, body=None):
    code, result = rpc(actor, name, body)
    check('HTTP success: ' + name, code == 200)
    return result


def denied(actor, name, body, sqlstate='42501'):
    code, result = rpc(actor, name, body)
    return code in (400, 401, 403, 409) and isinstance(result, dict) and result.get('code') == sqlstate


def fixture(label, metadata):
    email = 'cladora.public.demo.' + label + '.' + uuid.uuid4().hex + '@example.test'
    password = secrets.token_urlsafe(36)
    code, user = http('/auth/v1/admin/users', 'POST',
                      {'email': email, 'password': password, 'email_confirm': True,
                       'user_metadata': metadata}, admin=True)
    check('real managed Auth fixture ' + label, code in (200, 201) and bool(user.get('id')))
    actor = {'uid': user['id'], 'email': email}
    state['actors'].append(actor)
    save()
    code, session = http('/auth/v1/token?grant_type=password', 'POST',
                         {'email': email, 'password': password})
    check('real password session ' + label, code == 200 and bool(session.get('access_token')))
    actor['access_token'] = session['access_token']
    encoded = session['access_token'].split('.')[1]
    claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
    check('ordinary demo AAL1 ' + label, claims.get('aal') == 'aal1')
    save()
    return actor


def initialize(actor, name, consent):
    return ok(actor, 'demo_initialize_workspace_v1',
              {'p_first_name': 'آزمایش', 'p_last_name': name, 'p_mobile': '+98 912 123 4567',
               'p_workspace_name': 'Workspace ' + name, 'p_marketing_consent': consent,
               'p_privacy_accepted': True, 'p_locale': 'fa'})


def run():
    a = fixture('a', {'role': 'PLATFORM_SUPER_ADMIN'})
    check('new account has no workspace until validated signup',
          ok(a, 'demo_get_my_workspace_v1') is None)
    check('privacy acceptance required', denied(a, 'demo_initialize_workspace_v1',
          {'p_first_name': 'A', 'p_last_name': 'Test', 'p_mobile': '+989121234567',
           'p_workspace_name': 'Workspace A'}, '22023'))
    check('invalid signup creates no partial workspace',
          ok(a, 'demo_get_my_workspace_v1') is None)
    created = initialize(a, 'A', False)
    w = created['workspace']['id']
    a['workspace_id'] = w
    save()
    check('signup atomically creates own seeded demo workspace',
          created['created'] is True and created['workspace']['is_demo'] is True
          and created['workspace']['role'] == 'demo_owner')
    check('contact fields persisted without phone verification or forced consent',
          created['workspace']['profile']['first_name'] == 'آزمایش'
          and created['workspace']['profile']['last_name'] == 'A'
          and created['workspace']['profile']['mobile_contact'] == '+989121234567'
          and created['workspace']['profile']['mobile_verified'] is False
          and created['workspace']['profile']['marketing_consent'] is False)
    nav = {x['key']: x['access'] for x in created['workspace']['navigation']}
    check('nonfinancial menus interactive and financial sensitive actions closed',
          nav['maintenance'] == 'interactive' and nav['finance'] == 'read_only'
          and nav['payments'] == 'locked' and not any(created['workspace']['features'].values()))
    listing = ok(a, 'demo_list_items_v1', {'p_workspace_id': w, 'p_limit': 100})
    reports = ok(a, 'demo_get_reports_v1', {'p_workspace_id': w})
    counts = dict(collections.Counter(x['kind'] for x in listing['items']))
    check('reports count the actual persisted item list',
          listing['total'] == len(listing['items']) == 75 and counts == reports['counts'])
    finance = reports['finance']
    check('read-only sample finance aggregates internally reconcile',
          finance['read_only'] is True and finance['invoice_count'] == 24
          and len(finance['monthly']) == 6 and finance['outstanding'] > 0
          and finance['invoiced'] - finance['paid'] == finance['outstanding']
          and sum(x['invoiced'] for x in finance['monthly']) == finance['invoiced'])
    repeated = initialize(a, 'A', False)
    check('repeat signup does not create a second workspace or reseed',
          repeated['created'] is False and repeated['workspace']['id'] == w
          and ok(a, 'demo_list_items_v1', {'p_workspace_id': w})['total'] == 75
          and ok(a, 'demo_get_reports_v1', {'p_workspace_id': w})['finance'] == finance)
    b = fixture('b', {'role': 'PLATFORM_SUPER_ADMIN', 'workspace_id': w})
    other = initialize(b, 'B', True)['workspace']
    wb = other['id']
    b['workspace_id'] = wb
    save()
    check('forged role/workspace metadata grants no other workspace',
          wb != w and other['role'] == 'demo_owner'
          and other['profile']['last_name'] == 'B'
          and other['profile']['marketing_consent'] is True)
    check('other user cannot read items', denied(b, 'demo_list_items_v1', {'p_workspace_id': w}))
    check('other user cannot read reports', denied(b, 'demo_get_reports_v1', {'p_workspace_id': w}))
    parent = next(x['id'] for x in listing['items'] if x['kind'] == 'property')
    create = {'p_workspace_id': w, 'p_module': 'maintenance', 'p_kind': 'ticket',
              'p_title': 'Actual persisted demo test request', 'p_data': {'priority': 'normal'},
              'p_idempotency_key': str(uuid.uuid4()), 'p_parent_id': parent}
    item = ok(a, 'demo_create_item_v1', create)
    retry = ok(a, 'demo_create_item_v1', create)
    check('idempotent create persists only one request',
          item['id'] == retry['id'] and item['version'] == 1
          and ok(a, 'demo_list_items_v1', {'p_workspace_id': w})['total'] == 76)
    check('idempotency rejects a changed request', denied(a, 'demo_create_item_v1',
          {**create, 'p_title': 'Different'}, '22023'))
    updated = ok(a, 'demo_update_item_v1', {'p_workspace_id': w, 'p_item_id': item['id'],
                 'p_expected_version': 1, 'p_patch': {'status': 'closed'}})
    check('allowed interaction persists with a new version',
          updated['status'] == 'closed' and updated['version'] == 2)
    check('stale update rejected', denied(a, 'demo_update_item_v1',
          {'p_workspace_id': w, 'p_item_id': item['id'], 'p_expected_version': 1,
           'p_patch': {'status': 'open'}}, 'PT409'))
    check('workspace ownership patch rejected', denied(a, 'demo_update_item_v1',
          {'p_workspace_id': w, 'p_item_id': item['id'], 'p_expected_version': 2,
           'p_patch': {'workspace_id': wb}}, '22023'))
    changed = ok(a, 'demo_get_reports_v1', {'p_workspace_id': w})
    other_reports = ok(b, 'demo_get_reports_v1', {'p_workspace_id': wb})
    check('reports change after database interaction but other workspace does not',
          changed['counts']['ticket'] == reports['counts']['ticket'] + 1
          and other_reports['counts']['ticket'] == reports['counts']['ticket']
          and any(x['kind'] == 'ticket' and x['status'] == 'closed' and x['count'] == 3
                  for x in changed['maintenance'])
          and changed['finance'] == finance)
    check('other user cannot create in this workspace', denied(b, 'demo_create_item_v1', create))
    check('other user cannot update this workspace', denied(b, 'demo_update_item_v1',
          {'p_workspace_id': w, 'p_item_id': item['id'], 'p_expected_version': 2,
           'p_patch': {'status': 'open'}}))
    check('cross-workspace parent blocked', denied(b, 'demo_create_item_v1',
          {**create, 'p_workspace_id': wb, 'p_idempotency_key': str(uuid.uuid4())}))
    for module, kind in [('finance', 'payment'), ('payments', 'payment'),
                         ('role_administration', 'role'), ('governance', 'ballot')]:
        check('sensitive write blocked: ' + module, denied(a, 'demo_create_item_v1',
              {**create, 'p_module': module, 'p_kind': kind, 'p_idempotency_key': str(uuid.uuid4())}))
    meeting = next(x['id'] for x in listing['items'] if x['module'] == 'governance')
    check('seeded sensitive item remains readonly', denied(a, 'demo_update_item_v1',
          {'p_workspace_id': w, 'p_item_id': meeting, 'p_expected_version': 1,
           'p_patch': {'status': 'open'}}))
    code, _ = http('/rest/v1/workspaces?select=id', token=a['access_token'], schema='demo')
    check('private demo schema not exposed through Data API', code == 406)
    code, _ = http('/rest/v1/rpc/demo_get_my_workspace_v1', 'POST', {}, schema='customer_api')
    check('anonymous account access denied', code in (401, 403))
    check('demo signup creates no native platform access',
          ok(a, 'has_platform_access_v1') is False and ok(b, 'has_platform_access_v1') is False)
    check('native privileged MFA guard still rejects ordinary demo password token',
          denied(a, 'get_my_platform_auth_context_v1', {}))
    receipt['result'] = 'PASS_AWAITING_OWNER_READBACK_AND_CLEANUP'
    receipt['workspace_ids'] = [w, wb]
    receipt['actor_ids'] = [a['uid'], b['uid']]
    receipt['expected_persisted_items'] = {w: 76, wb: 75}
    receipt['email_delivery_tested'] = False
    receipt['native_workflow_or_browser_acceptance'] = False
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')


def cleanup():
    results = []
    for actor in state['actors']:
        code, _ = http('/auth/v1/admin/users/' + actor['uid'], 'DELETE', admin=True)
        results.append({'uid': actor['uid'], 'deleted': code in (200, 204), 'http': code})
    receipt['cleanup'] = results
    if all(x['deleted'] for x in results):
        STATE_FILE.unlink()
        receipt['result'] = 'PASS_FIXTURES_REMOVED' if receipt.get('result', '').startswith('PASS') else 'FAILED_RUN_FIXTURES_REMOVED'
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    if not all(x['deleted'] for x in results):
        raise RuntimeError('fixture_cleanup_incomplete')


state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {'actors': []}
receipt = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {'project_ref': TARGET, 'checks': []}
try:
    if len(sys.argv) > 1 and sys.argv[1] == 'cleanup':
        cleanup()
    else:
        if state['actors']:
            raise RuntimeError('clean_existing_test_fixtures_before_new_run')
        receipt = {'project_ref': TARGET, 'checks': []}
        run()
    print(json.dumps({'result': receipt['result'], 'checks_passed': sum(x['passed'] for x in receipt['checks']),
                      'checks_failed': sum(not x['passed'] for x in receipt['checks']), 'secrets_logged': False}))
except Exception as error:
    receipt['result'] = 'FAIL'
    receipt['failure'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'result': 'FAIL', 'failure': receipt['failure'],
                      'last_error': receipt.get('last_error'), 'cleanup_required': bool(state['actors'])}))
    raise SystemExit(1)
