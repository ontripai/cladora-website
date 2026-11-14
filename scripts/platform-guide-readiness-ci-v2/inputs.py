"""Ciphertext-only channel v2; reuse accepted original-byte/Git checks unchanged."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import zipfile

PATH = Path(__file__).resolve().parent.parent / 'platform-guide-readiness-ci-v1/inputs.py'
if hashlib.sha256(PATH.read_bytes()).hexdigest() != 'fe66e92430338f52d6bb670f3ee413fbc821743bcb4e54abbd2397ca2db5d249':
    raise ValueError('ACCEPTED_V1_DEPENDENCY_DRIFT')
spec = importlib.util.spec_from_file_location('guide_readiness_original_v1', PATH)
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
need = old.need


def envelope_pin(env):
    value = env.get('GUIDE_INPUT_ENVELOPE_SHA256', '')
    need(re.fullmatch(r'[a-f0-9]{64}', value), 'ENVELOPE_PIN_MISSING')
    return value


def validate_cipher_metadata(cfg, run, artifact):
    need(str(run.get('id')) == cfg['GUIDE_INPUT_RUN_ID']
         and run.get('repository', {}).get('full_name') == old.REPO
         and run.get('head_repository', {}).get('full_name') == old.REPO
         and run.get('event') == 'workflow_dispatch' and run.get('head_branch') == 'main'
         and str(run.get('workflow_id')) == cfg['GUIDE_INPUT_PUBLISHER_WORKFLOW_ID']
         and run.get('head_sha') == cfg['GUIDE_INPUT_PUBLISHER_HEAD_SHA']
         and run.get('status') == 'completed' and run.get('conclusion') == 'success', 'PUBLISHER_RUN_MISMATCH')
    need(str(artifact.get('id')) == cfg['GUIDE_INPUT_ARTIFACT_ID']
         and artifact.get('name') == 'guide-readiness-ciphertext-v2'
         and artifact.get('expired') is False
         and artifact.get('digest') == 'sha256:' + cfg['GUIDE_INPUT_ARCHIVE_SHA256']
         and artifact.get('workflow_run', {}).get('id') == run['id']
         and artifact.get('workflow_run', {}).get('head_sha') == run['head_sha']
         and type(artifact.get('size_in_bytes')) is int
         and 0 < artifact['size_in_bytes'] <= old.MAX_FILE, 'CIPHERTEXT_ARTIFACT_MISMATCH')


def aad_hash(manifest_sha):
    data = {'contract': 'platform.guide-input-envelope.v2', 'source': old.SOURCE[0],
            'tool': old.TOOL[0], 'history': old.HISTORY[0], 'manifest_sha256': manifest_sha}
    return old.digest(json.dumps(data, separators=(',', ':')).encode())


def extract_authenticated(cfg, pin):
    temp, incoming, receipts = old.paths()
    channel = json.loads(old.checked_file(receipts / 'input-channel.json', 65536))
    need(channel['configuration'] == cfg and channel['envelope_sha256'] == pin, 'CHANNEL_PIN_DRIFT')
    proof = json.loads(old.checked_file(receipts / 'decrypt.json', 65536))
    need(proof.get('contract') == 'platform.guide-input-envelope.v2' and proof.get('authenticated') is True
         and proof.get('manifest_sha256') == cfg['GUIDE_INPUT_MANIFEST_SHA256']
         and proof.get('envelope_sha256') == pin
         and proof.get('AAD_sha256') == aad_hash(cfg['GUIDE_INPUT_MANIFEST_SHA256']), 'AUTHENTICATED_DECRYPT_REQUIRED')
    private = temp / 'guide-readiness-private'
    need(private.resolve() == private and stat.S_IMODE(private.stat().st_mode) == 0o700, 'PRIVATE_DIRECTORY_MODE')
    path = private / 'input.zip'
    need(path.resolve() == path, 'PRIVATE_ZIP_ALIAS')
    s = path.stat()
    need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and stat.S_IMODE(s.st_mode) == 0o600
         and s.st_uid == os.getuid() and 0 < s.st_size <= old.MAX_FILE
         and s.st_size == proof['plaintext_zip_bytes'], 'PRIVATE_ZIP_BOUND')
    digest = hashlib.sha256()
    with path.open('rb') as f:
        while block := f.read(262144):
            digest.update(block)
    need(digest.hexdigest() == proof['plaintext_zip_sha256'], 'AUTHENTICATED_ZIP_DRIFT')
    need(not incoming.exists(), 'DECRYPTED_INPUTS_ALREADY_EXIST')
    with zipfile.ZipFile(path) as z:
        entries = z.infolist()
        need(3 <= len(entries) <= 33 and len({x.filename for x in entries}) == len(entries), 'ZIP_ENTRY_COUNT')
        need(sum(x.file_size for x in entries) <= old.MAX_TOTAL + 65536, 'ZIP_TOTAL_BOUND')
        for x in entries:
            mode = x.external_attr >> 16
            need(not x.is_dir() and stat.S_IFMT(mode) in (0, stat.S_IFREG)
                 and x.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                 and not (x.flag_bits & 1) and 0 < x.file_size <= old.MAX_FILE
                 and re.fullmatch(r'manifest\.json|ce-profile\.json|[A-Za-z0-9_-]+\.bundle', x.filename), 'ZIP_UNSAFE_ENTRY')
        manifest_entry = z.getinfo('manifest.json')
        need(manifest_entry.file_size <= 65536, 'ZIP_MANIFEST_BOUND')
        manifest_bytes = z.read(manifest_entry)
        manifest = old.validate_manifest(manifest_bytes, cfg['GUIDE_INPUT_MANIFEST_SHA256'])
        expected = {x['name']: x for x in manifest['files']}
        expected['manifest.json'] = {'bytes': len(manifest_bytes), 'sha256': old.digest(manifest_bytes)}
        need(set(expected) == {x.filename for x in entries}, 'ZIP_UNDECLARED_CONTENT')
        for x in entries:
            need(x.file_size == expected[x.filename]['bytes'], 'ZIP_MEMBER_SIZE_MISMATCH')
        incoming.mkdir(mode=0o700)
        for x in entries:
            h = hashlib.sha256()
            with z.open(x) as source, (incoming / x.filename).open('xb') as dest:
                os.chmod(dest.name, 0o600)
                count = 0
                while block := source.read(262144):
                    count += len(block)
                    need(count <= expected[x.filename]['bytes'], 'ZIP_INFLATION_BOUND')
                    usage = os.statvfs(temp)
                    need(usage.f_bavail * usage.f_frsize > old.RESERVE + 67108864
                         and usage.f_favail > 128, 'EXTRACT_CAPACITY_GUARD')
                    dest.write(block)
                    h.update(block)
                dest.flush()
                os.fsync(dest.fileno())
            need(count == expected[x.filename]['bytes'] and h.hexdigest() == expected[x.filename]['sha256'], 'DECRYPTED_MEMBER_DRIFT')
            need(old.digest(old.checked_file(incoming / x.filename, old.MAX_FILE)) == h.hexdigest(), 'DECRYPTED_MEMBER_READBACK')
    after = path.stat()
    need((s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns) ==
         (after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'PRIVATE_ZIP_CHANGED')
    old.receipt('decrypted-inputs.json', {'transport': 'AEAD_AND_EXTERNAL_MANIFEST_VERIFIED',
        'files': len(entries), 'Git_import_started': False, 'preflight': 'HOLD', 'native': 'NOT_RUN'})


def main():
    cfg = old.configuration(os.environ)
    pin = envelope_pin(os.environ)
    need(len(sys.argv) == 2 and sys.argv[1] in ('metadata', 'materialize'), 'FIXED_MODE_REQUIRED')
    if sys.argv[1] == 'metadata':
        run = old.get_json('runs/' + cfg['GUIDE_INPUT_RUN_ID'])
        artifact = old.get_json('artifacts/' + cfg['GUIDE_INPUT_ARTIFACT_ID'])
        validate_cipher_metadata(cfg, run, artifact)
        old.receipt('input-channel.json', {'configuration': cfg, 'envelope_sha256': pin,
            'publisher_run_id': run['id'], 'artifact_id': artifact['id'], 'public_artifact_content': 'CIPHERTEXT_ONLY_REQUIRED',
            'archive_digest_scope': 'GitHub API metadata; envelope digest and AEAD checked before extraction',
            'preflight': 'HOLD', 'execution_approval': False})
    else:
        extract_authenticated(cfg, pin)
        old.materialize(cfg)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else type(error).__name__
        try:
            old.receipt('first-error.json', {'stage': 'ciphertext-inputs', 'code': code,
                'preflight': 'HOLD', 'permit': None, 'native': 'NOT_RUN'})
        except Exception:
            pass
        print('GUIDE_CIPHERTEXT_CHANNEL_HOLD', file=sys.stderr)
        sys.exit(2)
