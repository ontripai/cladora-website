"""Private-repository transport; accepted source/history/decrypt code is unchanged."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import urllib.request

PRIVATE_REPOSITORY = 'ontripai/cladora-guide-readiness-private'
PRIVATE_REPOSITORY_ID = 1457994260
MAX_METADATA = 262144


def dependency(relative, expected, name):
    path = Path(__file__).resolve().parent.parent / relative
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError('ACCEPTED_DEPENDENCY_DRIFT')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


old = dependency('platform-guide-readiness-ci-v1/inputs.py',
    'fe66e92430338f52d6bb670f3ee413fbc821743bcb4e54abbd2397ca2db5d249', 'guide_private_original_v1')
channel = dependency('platform-guide-readiness-ci-v2/inputs.py',
    '9c379f46d172f85e60dc203f409f815fe246f87142527cdd0ad6e907e6571798', 'guide_private_crypto_v2')
bootstrap = dependency('platform-guide-readiness-ci-v3/inputs.py',
    '023e40f549ec1669c5ac42972d3381750fca6e5369f9e0438a28242127a7729d', 'guide_private_bootstrap_v3')
need = old.need


def repository_id(env):
    value = env.get('GUIDE_PRIVATE_INPUT_REPOSITORY_ID', '')
    need(value == str(PRIVATE_REPOSITORY_ID), 'FIXED_PRIVATE_REPOSITORY_ID_REQUIRED')
    return PRIVATE_REPOSITORY_ID


def validate_repository(repo, expected_id):
    need(repo.get('id') == expected_id and type(repo.get('id')) is int
         and repo.get('full_name') == PRIVATE_REPOSITORY
         and repo.get('private') is True and repo.get('visibility') == 'private'
         and repo.get('fork') is False and repo.get('archived') is False
         and repo.get('owner', {}).get('login') == 'ontripai', 'PRIVATE_REPOSITORY_REQUIRED')


def get_private_json(suffix):
    need(suffix == '' or re.fullmatch(r'/actions/(runs|artifacts)/[1-9][0-9]{0,19}', suffix), 'FIXED_PRIVATE_API_PATH_REQUIRED')
    token = os.environ.get('GUIDE_PRIVATE_INPUTS_TOKEN', '')
    need(bool(token), 'SCOPED_PRIVATE_ACTIONS_READ_TOKEN_REQUIRED')

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            raise ValueError('PRIVATE_METADATA_REDIRECT_DENIED')

    request = urllib.request.Request('https://api.github.com/repos/' + PRIVATE_REPOSITORY + suffix,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        raw = response.read(MAX_METADATA + 1)
    need(len(raw) <= MAX_METADATA, 'PRIVATE_METADATA_BOUND')
    return json.loads(raw)


def validate_private_metadata(cfg, run, artifact, expected_id):
    need(str(run.get('id')) == cfg['GUIDE_INPUT_RUN_ID']
         and run.get('repository', {}).get('id') == expected_id
         and run.get('repository', {}).get('full_name') == PRIVATE_REPOSITORY
         and run.get('repository', {}).get('private') is True
         and run.get('head_repository', {}).get('id') == expected_id
         and run.get('head_repository', {}).get('full_name') == PRIVATE_REPOSITORY
         and run.get('head_repository', {}).get('private') is True
         and run.get('event') == 'workflow_dispatch' and run.get('head_branch') == 'main'
         and str(run.get('workflow_id')) == cfg['GUIDE_INPUT_PUBLISHER_WORKFLOW_ID']
         and run.get('path') == '.github/workflows/guide-ciphertext-publish.yml'
         and run.get('head_sha') == cfg['GUIDE_INPUT_PUBLISHER_HEAD_SHA']
         and run.get('status') == 'completed' and run.get('conclusion') == 'success', 'PRIVATE_PUBLISHER_RUN_MISMATCH')
    need(str(artifact.get('id')) == cfg['GUIDE_INPUT_ARTIFACT_ID']
         and artifact.get('name') == 'guide-readiness-ciphertext-v2'
         and artifact.get('expired') is False
         and artifact.get('digest') == 'sha256:' + cfg['GUIDE_INPUT_ARCHIVE_SHA256']
         and artifact.get('workflow_run', {}).get('id') == run['id']
         and artifact.get('workflow_run', {}).get('head_sha') == run['head_sha']
         and type(artifact.get('size_in_bytes')) is int
         and 0 < artifact['size_in_bytes'] <= old.MAX_FILE, 'PRIVATE_CIPHERTEXT_ARTIFACT_MISMATCH')


def private_proof(cfg, expected_id, *, after_download):
    _, _, receipts = old.paths()
    proof = json.loads(old.checked_file(receipts / 'input-channel.json', 65536))
    need(proof.get('configuration') == cfg
         and proof.get('envelope_sha256') == channel.envelope_pin(os.environ)
         and proof.get('publisher_repository') == PRIVATE_REPOSITORY
         and proof.get('publisher_repository_id') == expected_id
         and proof.get('publisher_visibility') == 'private'
         and proof.get('transport') == 'PRIVATE_REPOSITORY_AUTHENTICATED_ARTIFACT', 'PRIVATE_CHANNEL_PROOF_REQUIRED')
    if after_download:
        after = json.loads(old.checked_file(receipts / 'private-repository-after-download.json', 65536))
        need(after.get('configuration') == cfg and after.get('repository') == PRIVATE_REPOSITORY
             and after.get('repository_id') == expected_id and after.get('visibility') == 'private'
             and after.get('envelope_sha256') == proof['envelope_sha256'], 'PRIVATE_POST_DOWNLOAD_PROOF_REQUIRED')


def main():
    os.umask(0o077)
    need(len(sys.argv) == 2 and sys.argv[1] in ('metadata', 'after-download', 'materialize'), 'FIXED_PRIVATE_MODE_REQUIRED')
    mode = sys.argv[1]
    cfg = old.configuration(os.environ)
    expected_id = repository_id(os.environ)
    pin = channel.envelope_pin(os.environ)
    if mode in ('metadata', 'after-download'):
        validate_repository(get_private_json(''), expected_id)
    if mode == 'metadata':
        run = get_private_json('/actions/runs/' + cfg['GUIDE_INPUT_RUN_ID'])
        artifact = get_private_json('/actions/artifacts/' + cfg['GUIDE_INPUT_ARTIFACT_ID'])
        validate_private_metadata(cfg, run, artifact, expected_id)
        old.receipt('input-channel.json', {'configuration': cfg, 'envelope_sha256': pin,
            'publisher_repository': PRIVATE_REPOSITORY, 'publisher_repository_id': expected_id,
            'publisher_visibility': 'private', 'transport': 'PRIVATE_REPOSITORY_AUTHENTICATED_ARTIFACT',
            'publisher_run_id': run['id'], 'artifact_id': artifact['id'],
            'preflight': 'HOLD', 'execution_approval': False})
    elif mode == 'after-download':
        private_proof(cfg, expected_id, after_download=False)
        old.receipt('private-repository-after-download.json', {'configuration': cfg,
            'repository': PRIVATE_REPOSITORY, 'repository_id': expected_id,
            'visibility': 'private', 'envelope_sha256': pin, 'preflight': 'HOLD'})
    else:
        need(not os.environ.get('GUIDE_PRIVATE_INPUTS_TOKEN'), 'PRIVATE_TOKEN_MUST_NOT_REACH_MATERIALIZER')
        private_proof(cfg, expected_id, after_download=True)
        channel.extract_authenticated(cfg, pin)
        bootstrap.materialize(cfg, bootstrap_git=Path(os.environ['GITHUB_WORKSPACE']),
            workflow_sha=os.environ.get('GITHUB_SHA'))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'PRIVATE_CHANNEL_UNKNOWN'
        try:
            old.receipt('first-error.json', {'stage': 'private-input-channel-v5', 'code': code,
                'preflight': 'HOLD', 'native': 'NOT_RUN', 'permit': None})
        except Exception:
            pass
        print('GUIDE_PRIVATE_INPUT_CHANNEL_HOLD', file=sys.stderr)
        sys.exit(2)
