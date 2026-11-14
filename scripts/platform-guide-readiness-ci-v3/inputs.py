"""Main17 bootstrap successor only; original transport/crypto/history are reused."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
DEPENDENCY = HERE.parent / 'platform-guide-readiness-ci-v2/inputs.py'
if hashlib.sha256(DEPENDENCY.read_bytes()).hexdigest() != '9c379f46d172f85e60dc203f409f815fe246f87142527cdd0ad6e907e6571798':
    raise ValueError('ACCEPTED_CHANNEL_DEPENDENCY_DRIFT')
spec = importlib.util.spec_from_file_location('accepted_cipher_channel_v2', DEPENDENCY)
channel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(channel)
old = channel.old
need = old.need
MAIN = ('17c0fcefed9f80ed0ee9630d686627056764e604', '009fa20985abefd405c63c2d6d4880fd6b150994')
CHAIN_SHA = '5ba72ae7c3ab78e6df9aa071a5514a6360e0cb2de9dfda49b436ee731290878b'


def original_chain():
    data = old.checked_file(HERE / 'original-chain.json', 65536)
    need(old.digest(data) == CHAIN_SHA, 'ORIGINAL_CHAIN_DESCRIPTOR_DRIFT')
    m = json.loads(data)
    need((m['bootstrap']['head'], m['bootstrap']['tree']) == MAIN, 'FIXED_BOOTSTRAP_DESCRIPTOR')
    return m


def write_seed_marker(parent, seeded):
    path = parent / 'bootstrap-seeded.json'
    data = (json.dumps(seeded, indent=2) + '\n').encode()
    with path.open('xb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    need(path.read_bytes() == data, 'BOOTSTRAP_RECEIPT_READBACK')


def run(*args, cwd):
    return old.guarded_command(['git', '--no-replace-objects', '-c', 'core.hooksPath=/dev/null', *map(str, args)], cwd)


def authenticate_bootstrap(bootstrap_git, workflow_sha):
    root = Path(bootstrap_git)
    need(root.is_absolute() and root.resolve(strict=True) == root, 'WORKFLOW_CHECKOUT_ALIAS')
    need(re.fullmatch(r'[a-f0-9]{40}', workflow_sha or ''), 'WORKFLOW_SHA_REQUIRED')
    need(run('-C', root, 'rev-parse', '--show-toplevel', cwd=root).decode().strip() == str(root), 'WORKFLOW_ROOT_MISMATCH')
    need(run('-C', root, 'rev-parse', 'HEAD', cwd=root).decode().strip() == workflow_sha, 'WORKFLOW_HEAD_MISMATCH')
    # Commit content authentication precedes store creation or bundle imports.
    raw = run('-C', root, 'cat-file', 'commit', MAIN[0], cwd=root)
    object_hash = hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    need(object_hash == MAIN[0], 'BOOTSTRAP_COMMIT_CONTENT_MISMATCH')
    need(raw.splitlines()[0] == ('tree ' + MAIN[1]).encode(), 'BOOTSTRAP_TREE_MISMATCH')
    need(run('-C', root, 'rev-parse', MAIN[0] + '^{tree}', cwd=root).decode().strip() == MAIN[1], 'BOOTSTRAP_TREE_MISMATCH')
    run('-C', root, 'merge-base', '--is-ancestor', MAIN[0], workflow_sha, cwd=root)
    need(not run('-C', root, 'status', '--porcelain', '--untracked-files=all', cwd=root), 'WORKFLOW_CHECKOUT_DIRTY')
    return {'head': MAIN[0], 'tree': MAIN[1], 'workflow_checkout_head': workflow_sha,
            'scope': 'ACTUAL_GIT_CHECKOUT_SOURCE_ONLY_NOT_A_JOB_ATTESTATION'}


def import_original_chain(input_root, *, bootstrap_git, workflow_sha, output_parent):
    incoming, parent = Path(input_root), Path(output_parent)
    need(incoming.resolve(strict=True) == incoming and parent.resolve(strict=True) == parent, 'INPUT_OR_OUTPUT_ALIAS')
    need(not (incoming.stat().st_mode & 0o077) and not (parent.stat().st_mode & 0o077), 'PRIVATE_DIRECTORIES_REQUIRED')
    chain = original_chain()
    # Authenticate the seven unchanged original bundles before any Git import.
    for row in chain['bundles_in_import_order']:
        name = row['file'].replace('source-9064.bundle', 'source9064.bundle')
        data = old.checked_file(incoming / name, old.MAX_FILE)
        need(len(data) == row['bytes'] and old.digest(data) == row['sha256'], 'ORIGINAL_BUNDLE_DRIFT')
        header = data.split(b'\n\n', 1)[0].splitlines()
        declared = sorted(line[1:].split(b' ', 1)[0].decode() for line in header if line.startswith(b'-'))
        need(declared == sorted(row['prerequisites']), 'ORIGINAL_PREREQUISITES_DRIFT')
    bootstrap = authenticate_bootstrap(bootstrap_git, workflow_sha)
    store = parent / 'guide-readiness-objects.git'
    need(not store.exists(), 'MATERIALIZATION_ALREADY_EXISTS')
    run('init', '--bare', store, cwd=parent)
    def git(*args):
        return run('--git-dir=' + str(store), *args, cwd=parent)
    # Copy ONLY the public Main closure from the authenticated local checkout.
    # No alternate store/fallback, remote/private fetch or synthetic commit.
    git('-c', 'transfer.fsckObjects=true', 'fetch', '--no-tags', str(Path(bootstrap_git)), MAIN[0])
    need(git('rev-parse', MAIN[0] + '^{tree}').decode().strip() == MAIN[1], 'SEEDED_BOOTSTRAP_MISMATCH')
    public_ancestors = set(git('rev-list', MAIN[0]).decode().splitlines())
    need(not public_ancestors.intersection({x['head'] for x in chain['bundles_in_import_order']}), 'PRIVATE_HEAD_IN_BOOTSTRAP')
    seeded = {'bootstrap': bootstrap, 'before_first_bundle': True,
              'seven_private_heads_absent_from_seed_closure': True,
              'store_has_alternates': (store / 'objects/info/alternates').exists()}
    need(seeded['store_has_alternates'] is False, 'SHARED_OBJECT_FALLBACK_DENIED')
    write_seed_marker(parent, seeded)
    imported = []
    for row in chain['bundles_in_import_order']:
        for head in row['prerequisites']:
            git('cat-file', '-e', head + '^{commit}')
        path = incoming / row['file'].replace('source-9064.bundle', 'source9064.bundle')
        git('bundle', 'verify', path)
        git('bundle', 'unbundle', path)
        actual = git('show', '-s', '--format=%H%n%P%n%T', row['head']).decode().strip().splitlines()
        identity = {'head': actual[0], 'parents': actual[1].split(), 'tree': actual[2]}
        need(identity == {key: row[key] for key in ('head', 'parents', 'tree')}, 'ORIGINAL_COMMIT_IDENTITY_MISMATCH')
        imported.append(identity)
    return store, {'contract': 'platform.guide-main17-bootstrap.v3', 'bootstrap': bootstrap,
        'seed_before_bundle': True, 'imported': imported, 'imported_count': len(imported),
        'scope': 'ORIGINAL_CHAIN_IMPORT_ONLY', 'preflight': 'HOLD', 'job': 'NOT_RUN', 'CLI': 'NOT_RUN',
        'admission': 'NOT_RUN', 'native': 'NOT_RUN', 'permit': None}


def materialize(cfg, *, bootstrap_git, workflow_sha):
    temp, incoming, receipts = old.paths()
    usage = os.statvfs(temp)
    need(usage.f_bavail * usage.f_frsize >= old.FLOOR and usage.f_favail > 256, 'READINESS_START_CAPACITY')
    metadata = json.loads(old.checked_file(receipts / 'input-channel.json', 65536))
    need(metadata['configuration'] == cfg, 'INPUT_CHANNEL_DRIFT')
    m = old.validate_manifest(old.checked_file(incoming / 'manifest.json', 65536), cfg['GUIDE_INPUT_MANIFEST_SHA256'])
    need({p.name for p in incoming.iterdir()} == {'manifest.json', *[x['name'] for x in m['files']]}, 'UNEXPECTED_INPUT_FILES')
    for row in m['files']:
        data = old.checked_file(incoming / row['name'], row['bytes'])
        need(len(data) == row['bytes'] and old.digest(data) == row['sha256'], 'ORIGINAL_FILE_DRIFT')
    chain = original_chain()
    need(m['bundle_order'] == [x['file'].replace('source-9064.bundle', 'source9064.bundle') for x in chain['bundles_in_import_order']], 'FIXED_CHAIN_ORDER')
    state = temp / 'guide-readiness-bootstrap-state'
    state.mkdir(mode=0o700)
    store, result = import_original_chain(incoming, bootstrap_git=bootstrap_git,
        workflow_sha=workflow_sha, output_parent=state)
    old.receipt('bootstrap-import.json', result)
    def git(*args):
        return run('--git-dir=' + str(store), *args, cwd=temp)
    def export(head, name, root):
        need(not Path(name).is_absolute() and '..' not in Path(name).parts, 'EXPORT_PATH')
        need(git('ls-tree', head, '--', name).startswith(b'100644 blob '), 'EXPORT_NOT_REGULAR')
        data = git('cat-file', 'blob', head + ':' + name)
        dest = root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open('xb') as f:
            f.write(data)
    # Same accepted post-import projection and source verifier; no new supplier ABI.
    tool, source = temp / 'guide-readiness-tool', temp / 'guide-readiness-source'
    tool.mkdir(mode=0o700)
    source.mkdir(mode=0o700)
    names = ['scripts/platform-guide-profile-v3/verify.py', 'scripts/platform-guide-profile-v3/origins.json',
             'scripts/platform-guide-profile-v2/verify.py', 'scripts/platform-guide-profile-v2/profile.json',
             'scripts/platform-guide-ci-lane-v1/job-proof.mjs', 'scripts/provision-building-setup-http-ci.mjs']
    for name in names:
        export(old.TOOL[0], name, tool)
    p = json.loads((tool / names[3]).read_bytes())
    origin = json.loads((tool / names[1]).read_bytes())
    for name in sorted({x['path'] for x in p['source_pins']} | {x['path'] for x in origin['source_origin']['historical_named_files']}):
        export(old.SOURCE[0], name, source)
    spec = importlib.util.spec_from_file_location('accepted_guide_origins', tool / names[0])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    identity = {'Head': old.SOURCE[0], 'Parents': old.PARENTS, 'Tree': old.SOURCE[1]}
    checked = module.verify_complete_source(source, identity, old.checked_file(incoming / 'ce-profile.json', 65536), history_repository=store)
    old.receipt('source-closure.json', {'source': identity, 'tool': {'Head': old.TOOL[0], 'Tree': old.TOOL[1]},
        'history': {'Head': old.HISTORY[0], 'Tree': old.HISTORY[1]}, 'result': checked,
        'materialization': 'EXACT_REGULAR_FILE_PROJECTION_FROM_VERIFIED_GIT_OBJECTS_NOT_FULL_CHECKOUT',
        'preflight': 'HOLD', 'permit': None, 'native': 'NOT_RUN'})


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['materialize'])
    parser.add_argument('--bootstrap-git', required=True)
    args = parser.parse_args()
    cfg = old.configuration(os.environ)
    need(Path(args.bootstrap_git) == Path(os.environ['GITHUB_WORKSPACE']), 'BOOTSTRAP_MUST_BE_WORKFLOW_CHECKOUT')
    channel.extract_authenticated(cfg, channel.envelope_pin(os.environ))
    materialize(cfg, bootstrap_git=Path(args.bootstrap_git), workflow_sha=os.environ.get('GITHUB_SHA'))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else type(error).__name__
        try:
            old.receipt('first-error.json', {'stage': 'main17-bootstrap', 'code': code, 'preflight': 'HOLD', 'native': 'NOT_RUN', 'permit': None})
        except Exception:
            pass
        print('GUIDE_BOOTSTRAP_HOLD', file=sys.stderr)
        sys.exit(2)
