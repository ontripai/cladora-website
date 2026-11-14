"""Store bounded read-only receipts in the fixed private repository, never artifacts."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import urllib.error
import urllib.request

REPOSITORY = 'ontripai/cladora-guide-readiness-private'
REPOSITORY_ID = 1457994260
NAMES = frozenset(('input-channel.json', 'private-repository-after-download.json',
    'decrypt.json', 'decrypted-inputs.json', 'bootstrap-import.json', 'source-closure.json',
    'job-cli-preflight.json', 'first-error.json'))
SUCCESS_NAMES = NAMES - {'first-error.json'}
MAX_FILE = 65536


def need(value, code):
    if not value:
        raise ValueError(code)


def context(env):
    need(env.get('GITHUB_ACTIONS') == 'true'
         and env.get('GITHUB_REPOSITORY') == 'ontripai/cladora-website'
         and env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
         and env.get('GITHUB_REF') == 'refs/heads/main'
         and env.get('GITHUB_JOB') == 'guide-owned-preflight'
         and env.get('GITHUB_WORKFLOW_REF') == 'ontripai/cladora-website/.github/workflows/guide-readiness.yml@refs/heads/main'
         and env.get('GUIDE_PRIVATE_INPUT_REPOSITORY_ID') == str(REPOSITORY_ID), 'FIXED_PRIVATE_RECEIPT_CONTEXT_REQUIRED')
    run, attempt, sha = (env.get(x, '') for x in ('GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_SHA'))
    need(re.fullmatch(r'[1-9][0-9]{0,19}', run) and re.fullmatch(r'[1-9][0-9]{0,9}', attempt)
         and re.fullmatch(r'[a-f0-9]{40}', sha), 'PRIVATE_RECEIPT_RUN_ID_REQUIRED')
    return {'repository': env['GITHUB_REPOSITORY'], 'run_id': run, 'attempt': attempt, 'workflow_sha': sha}


def validate_repository(repo):
    need(isinstance(repo, dict) and type(repo.get('id')) is int and repo['id'] == REPOSITORY_ID
         and repo.get('full_name') == REPOSITORY and repo.get('private') is True
         and repo.get('visibility') == 'private' and repo.get('fork') is False
         and repo.get('archived') is False and repo.get('default_branch') == 'main', 'PRIVATE_RECEIPT_REPOSITORY_REQUIRED')


def local_receipts(root):
    need(root.is_absolute() and root.resolve() == root, 'PRIVATE_RECEIPT_DIRECTORY_ALIAS')
    s = root.lstat()
    need(stat.S_ISDIR(s.st_mode) and stat.S_IMODE(s.st_mode) == 0o700
         and s.st_uid == os.getuid(), 'PRIVATE_RECEIPT_DIRECTORY_MODE')
    entries = sorted(root.iterdir(), key=lambda p: p.name)
    need(0 < len(entries) <= len(NAMES) and all(p.name in NAMES for p in entries), 'PRIVATE_RECEIPT_FILE_SET_REQUIRED')
    result = []
    for path in entries:
        need(not path.is_symlink() and path.resolve() == path, 'PRIVATE_RECEIPT_FILE_ALIAS')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            before = os.fstat(fd)
            need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1
                 and before.st_uid == os.getuid() and stat.S_IMODE(before.st_mode) == 0o600
                 and 0 < before.st_size <= MAX_FILE, 'PRIVATE_RECEIPT_FILE_BOUND')
            with os.fdopen(fd, 'rb', closefd=False) as f:
                data = f.read(MAX_FILE + 1)
            after = os.fstat(fd)
            need(len(data) == before.st_size and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
                 == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'PRIVATE_RECEIPT_CHANGED')
        finally:
            os.close(fd)
        need(isinstance(json.loads(data), dict), 'PRIVATE_RECEIPT_JSON_OBJECT_REQUIRED')
        result.append((path.name, data))
    return result


def api(method, suffix, body=None):
    need(method in ('GET', 'PUT') and (suffix == '' or re.fullmatch(
        r'/contents/receipts/guide-readiness/[1-9][0-9]{0,19}/[1-9][0-9]{0,9}/[a-f0-9]{40}/[a-z-]+\.json', suffix)), 'FIXED_PRIVATE_RECEIPT_API_PATH_REQUIRED')
    token = os.environ.get('GUIDE_PRIVATE_INPUTS_TOKEN', '')
    need(bool(token), 'PRIVATE_TRANSFER_TOKEN_REQUIRED')

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            raise ValueError('PRIVATE_RECEIPT_REDIRECT_DENIED')

    raw = None if body is None else json.dumps(body, separators=(',', ':')).encode()
    request = urllib.request.Request('https://api.github.com/repos/' + REPOSITORY + suffix,
        data=raw, method=method, headers={'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            data = response.read(262145)
    except urllib.error.HTTPError as error:
        if method == 'GET' and suffix.startswith('/contents/') and error.code == 404:
            return None
        raise ValueError('PRIVATE_RECEIPT_API_FAILED') from None
    need(len(data) <= 262144, 'PRIVATE_RECEIPT_API_BOUND')
    return json.loads(data)


def matches_file(value, path, data):
    need(isinstance(value, dict) and value.get('type') == 'file' and value.get('path') == path
         and value.get('size') == len(data) and value.get('encoding') == 'base64', 'PRIVATE_RECEIPT_REMOTE_FILE_MISMATCH')
    text = value.get('content', '').replace('\n', '')
    decoded = base64.b64decode(text, validate=True)
    expected = hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()
    need(decoded == data and value.get('sha') == expected, 'PRIVATE_RECEIPT_READBACK_MISMATCH')
    return expected


def put_immutable(path, data):
    suffix = '/contents/' + path
    existing = api('GET', suffix)
    if existing is not None:
        return matches_file(existing, path, data)
    created = api('PUT', suffix, {'message': 'Record private Guide readiness observation',
        'branch': 'main', 'content': base64.b64encode(data).decode()})
    need(created.get('content', {}).get('path') == path, 'PRIVATE_RECEIPT_CREATE_FAILED')
    return matches_file(api('GET', suffix), path, data)


def main():
    c = context(os.environ)
    temp = Path(os.environ.get('RUNNER_TEMP', ''))
    need(temp.is_absolute() and temp.resolve() == temp, 'PRIVATE_RECEIPT_TEMP_REQUIRED')
    files = local_receipts(temp / 'guide-readiness-receipts')
    validate_repository(api('GET', ''))
    prefix = 'receipts/guide-readiness/' + c['run_id'] + '/' + c['attempt'] + '/' + c['workflow_sha'] + '/'
    captured = []
    for name, data in files:
        validate_repository(api('GET', ''))
        blob = put_immutable(prefix + name, data)
        captured.append({'name': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'Git_blob': blob})
    status = os.environ.get('GUIDE_JOB_STATUS_BEFORE_CAPTURE', '')
    need(status in ('success', 'failure', 'cancelled'), 'PRIVATE_CAPTURE_JOB_STATUS_REQUIRED')
    index = {'contract': 'guide.private-receipt-capture.v1', 'receiver': c,
        'private_repository': REPOSITORY, 'private_repository_id': REPOSITORY_ID,
        'files': captured, 'job_status_before_capture': status,
        'complete_success_capture': {name for name, _ in files} == SUCCESS_NAMES and status == 'success',
        'preflight': 'HOLD', 'native': 'NOT_RUN', 'public_artifact_uploads': 0}
    data = (json.dumps(index, indent=2) + '\n').encode()
    need(len(data) <= MAX_FILE, 'PRIVATE_CAPTURE_INDEX_BOUND')
    validate_repository(api('GET', ''))
    put_immutable(prefix + 'capture-index.json', data)
    print('GUIDE_PRIVATE_RECEIPTS_SAVED')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('GUIDE_PRIVATE_RECEIPT_CAPTURE_HOLD', file=sys.stderr)
        sys.exit(2)
