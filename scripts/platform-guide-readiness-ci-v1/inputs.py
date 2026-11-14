"""Fixed Guide readiness input channel. No target, SQL, pool or installer API."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import time
import urllib.request

REPO = 'ontripai/cladora-website'
SOURCE = ('9064c7844657d7f0bfc16c20461100356b673362', 'ea64978b0fd3ecbb33b5ce8416e60e524b7b6ae2')
TOOL = ('aba19c2855973258e6edac80a5d4ba68e2c24e01', '59cb465cb2d37c7bd641e882c04940ba24bb5177')
HISTORY = ('26f8df8a023095c6adbd7184445eee62fc3ddff9', 'dd0594a7ae45ee10b4bfed6c5fc9bc91b28e51bd')
PARENTS = ['f3e68d095777bc28c1a06a883b07886e2f8bfab3', 'b5a4a6ac54aeea12e2082c84879ac21d824c9dcf', 'f774cae03d269d486d3d2cf6f4038e742a841b62']
SOURCE_BUNDLE = (52175, 'af82b3a2b7db09ab4e2d8be6d75f2aee10d6561ae6827e5fb07b2231fdc6a0b8')
CE = (14444, 'd4eaa3d999a4bf950deee0bd8027294e1b58842ad1c96cdc66dad4f2fce75831')
FLOOR, RESERVE = 2147483648, 536870912
MAX_FILE, MAX_TOTAL = 67108864, 134217728
CAPS = ('GUIDE_INPUT_RUN_ID', 'GUIDE_INPUT_ARTIFACT_ID', 'GUIDE_INPUT_MANIFEST_SHA256',
        'GUIDE_INPUT_ARCHIVE_SHA256', 'GUIDE_INPUT_PUBLISHER_WORKFLOW_ID', 'GUIDE_INPUT_PUBLISHER_HEAD_SHA')
GIT_ENV = {'PATH': os.defpath, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
           'GIT_NO_LAZY_FETCH': '1', 'GIT_TERMINAL_PROMPT': '0'}


def need(value, code):
    if not value:
        raise ValueError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def configuration(env):
    need(env.get('GITHUB_ACTIONS') == 'true' and env.get('GITHUB_REPOSITORY') == REPO
         and env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
         and env.get('GITHUB_REF') == 'refs/heads/main'
         and env.get('GITHUB_JOB') == 'guide-owned-preflight', 'ACTUAL_FIXED_CI_CONTEXT_REQUIRED')
    cfg = {k: env.get(k, '') for k in CAPS}
    for k, value in cfg.items():
        pattern = r'[1-9][0-9]{0,19}' if k.endswith('_ID') else r'[a-f0-9]{40}' if k.endswith('HEAD_SHA') else r'[a-f0-9]{64}'
        need(re.fullmatch(pattern, value), 'PROTECTED_INPUT_MISSING_OR_INVALID:' + k)
    return cfg


def paths():
    temp = Path(os.environ['RUNNER_TEMP'])
    need(temp.is_absolute() and temp.resolve() == temp, 'RUNNER_TEMP_ALIAS')
    return temp, temp / 'guide-readiness-original-inputs', temp / 'guide-readiness-receipts'


def receipt(name, value):
    _, _, dest = paths()
    dest.mkdir(mode=0o700, exist_ok=True)
    data = (json.dumps(value, indent=2) + '\n').encode()
    need(len(data) < 65536, 'RECEIPT_BOUND')
    path = dest / name
    with path.open('xb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    need(path.read_bytes() == data, 'RECEIPT_READBACK')


def get_json(suffix):
    token = os.environ.get('GITHUB_TOKEN', '')
    need(bool(token), 'JOB_SCOPED_TOKEN_MISSING')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            raise ValueError('METADATA_REDIRECT_DENIED')
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/actions/' + suffix,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        data = response.read(262145)
    need(len(data) <= 262144, 'METADATA_BOUND')
    return json.loads(data)


def validate_metadata(cfg, run, artifact):
    need(str(run.get('id')) == cfg['GUIDE_INPUT_RUN_ID']
         and run.get('repository', {}).get('full_name') == REPO
         and run.get('head_repository', {}).get('full_name') == REPO
         and run.get('event') == 'workflow_dispatch' and run.get('head_branch') == 'main'
         and str(run.get('workflow_id')) == cfg['GUIDE_INPUT_PUBLISHER_WORKFLOW_ID']
         and run.get('head_sha') == cfg['GUIDE_INPUT_PUBLISHER_HEAD_SHA']
         and run.get('status') == 'completed' and run.get('conclusion') == 'success', 'PUBLISHER_RUN_MISMATCH')
    need(str(artifact.get('id')) == cfg['GUIDE_INPUT_ARTIFACT_ID']
         and artifact.get('name') == 'guide-readiness-original-inputs-v1'
         and artifact.get('expired') is False
         and artifact.get('digest') == 'sha256:' + cfg['GUIDE_INPUT_ARCHIVE_SHA256']
         and artifact.get('workflow_run', {}).get('id') == run['id']
         and artifact.get('workflow_run', {}).get('head_sha') == run['head_sha']
         and isinstance(artifact.get('size_in_bytes'), int)
         and 0 < artifact['size_in_bytes'] <= MAX_FILE, 'PROTECTED_ARTIFACT_MISMATCH')


def checked_file(path, max_size):
    need(path.resolve() == path, 'INPUT_ALIAS')
    s = path.lstat()
    need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size <= max_size, 'INPUT_FILE_BOUND_OR_ALIAS')
    data = path.read_bytes()
    after = path.stat()
    need((s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns) ==
         (after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'INPUT_CHANGED')
    return data


def validate_manifest(data, expected_sha):
    need(digest(data) == expected_sha, 'MANIFEST_DIGEST_MISMATCH')
    m = json.loads(data)
    need(set(m) == {'contract', 'files', 'bundle_order'}
         and m['contract'] == 'platform.guide-readiness-original-inputs.v1', 'MANIFEST_SCHEMA')
    rows = m['files']
    need(isinstance(rows, list) and 3 <= len(rows) <= 32, 'INPUT_COUNT')
    names = []
    for x in rows:
        need(set(x) == {'name', 'bytes', 'sha256'} and isinstance(x['name'], str)
             and re.fullmatch(r'[A-Za-z0-9_-]+\.bundle|ce-profile\.json', x['name'])
             and type(x['bytes']) is int and 0 < x['bytes'] <= MAX_FILE
             and re.fullmatch(r'[a-f0-9]{64}', x['sha256']), 'INPUT_ROW_SCHEMA')
        names.append(x['name'])
    need(len(set(names)) == len(names) and sum(x['bytes'] for x in rows) <= MAX_TOTAL, 'INPUT_ACCOUNTING')
    for name, pin in [('source9064.bundle', SOURCE_BUNDLE), ('ce-profile.json', CE)]:
        row = next((x for x in rows if x['name'] == name), {})
        need((row.get('bytes'), row.get('sha256')) == pin, 'FIXED_ORIGINAL_INPUT_MISMATCH')
    order = m['bundle_order']
    need(isinstance(order, list) and len(order) == len(set(order))
         and set(order) == {n for n in names if n.endswith('.bundle')}, 'BUNDLE_ORDER')
    return m


def guarded_command(args, cwd, timeout=90, max_output=1048576):
    # Capture goes to a bounded temporary file, never unbounded PIPE buffers.
    temp, _, _ = paths()
    capture = temp / 'guide-command-capture'
    with capture.open('w+b') as f:
        child = subprocess.Popen(args, cwd=cwd, env=GIT_ENV, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
        deadline = time.monotonic() + timeout
        try:
            while True:
                need(time.monotonic() < deadline, 'READINESS_CHILD_TIMEOUT')
                need(shutil.disk_usage(temp).free > RESERVE + 67108864, 'READINESS_CAPACITY_GUARD')
                need(os.statvfs(temp).f_favail > 128, 'READINESS_INODE_GUARD')
                need(f.tell() <= max_output and capture.stat().st_size <= max_output, 'READINESS_OUTPUT_BOUND')
                code = child.poll()
                if code is not None:
                    need(code == 0, 'READINESS_CHILD_FAILED')
                    break
                time.sleep(0.05)
            f.seek(0)
            result = f.read(max_output + 1)
            need(len(result) <= max_output, 'READINESS_OUTPUT_BOUND')
            return result
        finally:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=5)


def materialize(cfg):
    temp, incoming, receipts = paths()
    need(shutil.disk_usage(temp).free >= FLOOR and os.statvfs(temp).f_favail > 256, 'READINESS_START_CAPACITY')
    metadata = json.loads(checked_file(receipts / 'input-channel.json', 65536))
    need(metadata['configuration'] == cfg, 'INPUT_CHANNEL_DRIFT')
    m = validate_manifest(checked_file(incoming / 'manifest.json', 65536), cfg['GUIDE_INPUT_MANIFEST_SHA256'])
    need({p.name for p in incoming.iterdir()} == {'manifest.json', *[x['name'] for x in m['files']]}, 'UNEXPECTED_INPUT_FILES')
    for row in m['files']:
        data = checked_file(incoming / row['name'], row['bytes'])
        need(len(data) == row['bytes'] and digest(data) == row['sha256'], 'ORIGINAL_FILE_DRIFT')
    store = temp / 'guide-readiness-objects.git'
    need(not store.exists(), 'MATERIALIZATION_ALREADY_EXISTS')
    guarded_command(['git', '-c', 'core.hooksPath=/dev/null', 'init', '--bare', str(store)], temp)
    def git(*args):
        return guarded_command(['git', '--no-replace-objects', '--git-dir=' + str(store), '-c', 'core.hooksPath=/dev/null', *args], temp)
    for name in m['bundle_order']:
        git('bundle', 'verify', str(incoming / name))
        heads = git('bundle', 'list-heads', str(incoming / name)).decode().splitlines()
        need(0 < len(heads) <= 32, 'BUNDLE_HEAD_COUNT')
        for line in heads:
            fields = line.split()
            need(len(fields) == 2 and re.fullmatch(r'[a-f0-9]{40}', fields[0])
                 and (fields[1] == 'HEAD' or re.fullmatch(r'refs/[A-Za-z0-9_./-]+', fields[1])), 'BUNDLE_HEAD_SHAPE')
            git('fetch', '--no-tags', str(incoming / name), fields[0])
    for head, tree in (SOURCE, TOOL, HISTORY):
        need(git('rev-parse', head + '^{tree}').decode().strip() == tree, 'EXACT_COMMIT_TREE_MISMATCH')
    need(git('show', '-s', '--format=%P', SOURCE[0]).decode().strip().split() == PARENTS, 'SOURCE_PARENT_MISMATCH')
    def export(head, relative, root):
        # Names are fixed by accepted descriptors, never a supplied shell/path.
        need(not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'EXPORT_PATH')
        need(git('ls-tree', head, '--', relative).startswith(b'100644 blob '), 'EXPORT_NOT_REGULAR')
        data = git('cat-file', 'blob', head + ':' + relative)
        dest = root / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open('xb') as f:
            f.write(data)
    tool, source = temp / 'guide-readiness-tool', temp / 'guide-readiness-source'
    tool_files = ['scripts/platform-guide-profile-v3/verify.py', 'scripts/platform-guide-profile-v3/origins.json',
        'scripts/platform-guide-profile-v2/verify.py', 'scripts/platform-guide-profile-v2/profile.json',
        'scripts/platform-guide-ci-lane-v1/job-proof.mjs', 'scripts/provision-building-setup-http-ci.mjs']
    for name in tool_files:
        export(TOOL[0], name, tool)
    p = json.loads((tool / 'scripts/platform-guide-profile-v2/profile.json').read_bytes())
    origin = json.loads((tool / 'scripts/platform-guide-profile-v3/origins.json').read_bytes())
    for name in sorted({x['path'] for x in p['source_pins']} | {x['path'] for x in origin['source_origin']['historical_named_files']}):
        export(SOURCE[0], name, source)
    spec = importlib.util.spec_from_file_location('accepted_guide_origins', tool / tool_files[0])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    identity = {'Head': SOURCE[0], 'Parents': PARENTS, 'Tree': SOURCE[1]}
    result = module.verify_complete_source(source, identity, checked_file(incoming / 'ce-profile.json', 65536), history_repository=store)
    receipt('source-closure.json', {'source': identity, 'tool': {'Head': TOOL[0], 'Tree': TOOL[1]},
        'history': {'Head': HISTORY[0], 'Tree': HISTORY[1]}, 'result': result,
        'materialization': 'EXACT_REGULAR_FILE_PROJECTION_FROM_VERIFIED_GIT_OBJECTS_NOT_FULL_CHECKOUT',
        'preflight': 'HOLD', 'permit': None, 'native': 'NOT_RUN'})


def main():
    cfg = configuration(os.environ)
    need(len(sys.argv) == 2 and sys.argv[1] in ('metadata', 'materialize'), 'FIXED_MODE_REQUIRED')
    if sys.argv[1] == 'metadata':
        run = get_json('runs/' + cfg['GUIDE_INPUT_RUN_ID'])
        artifact = get_json('artifacts/' + cfg['GUIDE_INPUT_ARTIFACT_ID'])
        validate_metadata(cfg, run, artifact)
        receipt('input-channel.json', {'configuration': cfg, 'publisher_run_id': run['id'], 'artifact_id': artifact['id'],
            'archive_digest_scope': 'GitHub API metadata; downloaded original files separately SHA256 checked',
            'preflight': 'HOLD', 'execution_approval': False})
    else:
        materialize(cfg)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else type(error).__name__
        try:
            receipt('first-error.json', {'stage': sys.argv[1] if len(sys.argv) == 2 else 'input',
                'code': code, 'preflight': 'HOLD', 'job_CLI': 'NOT_VERIFIED', 'permit': None, 'native': 'NOT_RUN'})
        except Exception:
            pass  # No ACK; a missing terminal receipt is itself incomplete capture.
        print('GUIDE_READINESS_HOLD', file=sys.stderr)
        sys.exit(2)
