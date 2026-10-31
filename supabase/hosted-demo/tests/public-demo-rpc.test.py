"""Real-hosted two-user preview-only test. Signup is the only write journey.

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


def verify_registration_retry(actor):
    before = ok(actor, 'demo_get_my_workspace_v1')
    report_before = ok(actor, 'demo_get_reports_v1', {'p_workspace_id': before['id']})
    changed = ok(actor, 'demo_initialize_workspace_v1',
                 {'p_first_name': 'Changed', 'p_last_name': 'Not saved',
                  'p_mobile': '+989999999999', 'p_workspace_name': 'Not saved workspace',
                  'p_marketing_consent': not before['profile']['marketing_consent'],
                  'p_privacy_accepted': True, 'p_locale': 'en'})
    check('registration retry cannot edit workspace profile or marketing consent',
          changed['created'] is False and changed['workspace'] == before)
    report_after = ok(actor, 'demo_get_reports_v1', {'p_workspace_id': before['id']})
    check('registration retry cannot reseed samples or change reports and activity',
          all(report_after[key] == report_before[key] for key in ('counts', 'finance', 'activity')))


def run():
    a = fixture('preview-a', {'role': 'PLATFORM_SUPER_ADMIN'})
    check('new verified account has no workspace before registration',
          ok(a, 'demo_get_my_workspace_v1') is None)
    check('registration still requires privacy acceptance', denied(a, 'demo_initialize_workspace_v1',
          {'p_first_name': 'A', 'p_last_name': 'Test', 'p_mobile': '+989121234567',
           'p_workspace_name': 'Workspace A'}, '22023'))
    created = initialize(a, 'A', False)
    w = created['workspace']['id']
    a['workspace_id'] = w
    save()
    descriptor = created['workspace']
    check('registration provisions own preview workspace',
          created['created'] is True and descriptor['is_demo'] is True
          and descriptor['role'] == 'demo_owner' and descriptor['demo_mode'] == 'preview_only')
    check('all section menus are readonly or locked',
          len(descriptor['navigation']) == 16
          and all(x['access'] in ('read_only', 'locked') for x in descriptor['navigation']))
    check('initial forms visible but save and continue disabled',
          descriptor['features']['form_preview'] is True
          and descriptor['features']['demo_data_write'] is False
          and descriptor['features']['workflow_continue'] is False
          and all(value is False for key, value in descriptor['features'].items() if key != 'form_preview'))
    profile = descriptor['profile']
    check('private contact captured without forced marketing or phone verification',
          profile['first_name'] == 'آزمایش' and profile['last_name'] == 'A'
          and profile['mobile_verified'] is False and profile['marketing_consent'] is False)
    check('repeat initialization does not reseed', initialize(a, 'A', False)['created'] is False)
    verify_registration_retry(a)
    first = ok(a, 'demo_list_items_v1', {'p_workspace_id': w})
    second = ok(a, 'demo_list_items_v1', {'p_workspace_id': w, 'p_offset': 50})
    listing = first['items'] + second['items']
    check('two readonly pages cover all75 sample items without overlap',
          first['total'] == second['total'] == 75 and len(first['items']) == 50
          and len(second['items']) == 25 and len({x['id'] for x in listing}) == 75)
    check('all items belong to the real own workspace',
          all(x['workspace_id'] == w and 'owner_user_id' not in x for x in listing))
    reports = ok(a, 'demo_get_reports_v1', {'p_workspace_id': w})
    check('dashboard reports persisted75 items',
          sum(reports['counts'].values()) == 75 and reports['source'] == 'persisted_demo_records'
          and reports['native_business_data'] is False)
    finance = reports['finance']
    check('six months of financial samples remain readonly and unchanged',
          finance['read_only'] is True and finance['sample_data'] is True
          and finance['invoice_count'] == 24 and len(finance['monthly']) == 6
          and finance['currency'] == 'RON' and finance['invoiced'] == 6420
          and finance['paid'] == 5580 and finance['outstanding'] == 840)
    b = fixture('preview-b', {'role': 'demo_owner', 'workspace_id': w})
    created_b = initialize(b, 'B', True)
    wb = created_b['workspace']['id']
    b['workspace_id'] = wb
    save()
    check('forged workspace metadata cannot select another owner workspace',
          wb != w and created_b['workspace']['demo_mode'] == 'preview_only')
    check('cross-user section read denied', denied(b, 'demo_list_items_v1', {'p_workspace_id': w}))
    check('cross-user report read denied', denied(b, 'demo_get_reports_v1', {'p_workspace_id': w}))
    check('own profile still loads independently',
          ok(b, 'demo_get_my_workspace_v1')['id'] == wb)
    for module, kind in [('properties', 'building'), ('residents', 'resident'),
                         ('maintenance', 'work_order'), ('assets', 'asset'),
                         ('utilities', 'meter_reading'), ('communications', 'announcement'),
                         ('documents', 'document'), ('bookings', 'booking'),
                         ('services', 'service_request'), ('governance', 'ballot'),
                         ('finance', 'payment'), ('role_administration', 'role')]:
        check('save denied for section: ' + module, denied(a, 'demo_create_item_v1',
              {'p_workspace_id': w, 'p_module': module, 'p_kind': kind, 'p_title': 'Not saved',
               'p_data': {}, 'p_idempotency_key': str(uuid.uuid4())}))
    for module in sorted({x['module'] for x in listing}):
        item = next(x for x in listing if x['module'] == module)
        check('edit or workflow continue denied: ' + module, denied(a, 'demo_update_item_v1',
              {'p_workspace_id': w, 'p_item_id': item['id'], 'p_expected_version': item['version'],
               'p_patch': {'title': 'Not saved', 'status': 'closed'}}))
    check('forged ownership cannot restore write access', denied(b, 'demo_create_item_v1',
          {'p_workspace_id': w, 'p_module': 'maintenance', 'p_kind': 'ticket',
           'p_title': 'Not saved', 'p_data': {}, 'p_idempotency_key': str(uuid.uuid4())}))
    unchanged = ok(a, 'demo_get_reports_v1', {'p_workspace_id': w})
    check('denied save and continue attempts leave counts finance and activity unchanged',
          unchanged['counts'] == reports['counts'] and unchanged['finance'] == finance
          and unchanged['activity'] == reports['activity'])
    other = ok(b, 'demo_get_reports_v1', {'p_workspace_id': wb})
    check('second workspace remains75items with unchanged financial samples',
          sum(other['counts'].values()) == 75 and other['finance'] == finance)
    code, _ = http('/rest/v1/items?select=id', token=a['access_token'], schema='demo')
    check('private data schema remains unexposed', code == 406)
    code, _ = http('/rest/v1/rpc/demo_get_my_workspace_v1', 'POST', {}, schema='customer_api')
    check('anonymous preview data access denied', code in (401, 403))
    code, _ = http('/rest/v1/rpc/demo_create_item_v1', 'POST',
                   {'p_workspace_id': w, 'p_module': 'maintenance', 'p_kind': 'ticket',
                    'p_title': 'Not saved', 'p_data': {}, 'p_idempotency_key': str(uuid.uuid4())},
                   schema='customer_api')
    check('anonymous save access denied', code in (401, 403))
    check('registration creates no native platform role',
          ok(a, 'has_platform_access_v1') is False and ok(b, 'has_platform_access_v1') is False)
    check('native MFA requirement remains unchanged', denied(a, 'get_my_platform_auth_context_v1', {}))
    receipt['result'] = 'PASS_AWAITING_OWNER_READBACK_AND_CLEANUP'
    receipt['mode'] = 'preview_only'
    receipt['workspace_ids'] = [w, wb]
    receipt['actor_ids'] = [a['uid'], b['uid']]
    receipt['expected_persisted_items'] = {w: 75, wb: 75}
    receipt['email_delivery_tested'] = False
    receipt['browser_tested'] = False
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
    elif len(sys.argv) > 1 and sys.argv[1] == 'registration-retry':
        if not state['actors']:
            raise RuntimeError('existing_preview_test_fixture_required')
        verify_registration_retry(state['actors'][0])
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
