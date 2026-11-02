#!/usr/bin/env python3
"""Provision/health/cleanup only. Never reads .env, installs domains or grants roles."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'supabase/local-profiles/runtime-lane-v1.json'
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']


def environment():
    # No inherited Supabase/cloud/production credentials enter CLI children.
    allowed = ['PATH', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTP_PROXY', 'HTTPS_PROXY',
               'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'DOCKER_CONFIG',
               'XDG_RUNTIME_DIR', 'CODEX_PROXY_CERT']
    return {k: os.environ[k] for k in allowed if k in os.environ}


def validate(p):
    assert p['profile'] == 'runtime-lane-v1'
    for key in ('pg', 'auth'):
        assert '@sha256:' in p[key]['image']
        assert len(p[key]['image_id']) == 71
    assert p['pg']['major'] == 17
    assert p['auth']['signup'] is False and p['auth']['external_delivery'] is False
    expected = {'pg_network': 'none', 'auth_network': 'container:actual-pg-CID',
                'loopback_only': True, 'published_ports': [], 'bind_mounts': [],
                'named_volumes': [], 'rootfs_readonly': True, 'user': '999:999',
                'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true']}
    for k, v in expected.items():
        assert p['isolation'][k] == v, 'isolation drift: ' + k


def inspect_config(c, role, pgcid=None):
    h = c['HostConfig']
    assert h['NetworkMode'] == ('none' if role == 'pg' else 'container:' + pgcid)
    assert not h.get('PortBindings') and not h.get('Binds') and not h.get('Privileged')
    assert h['ReadonlyRootfs'] and c['Config']['User'] == '999:999'
    assert h['CapDrop'] == ['ALL'] and h['SecurityOpt'] == ['no-new-privileges:true']
    assert h['PidMode'] == '' and not h.get('Devices') and not h.get('CapAdd')
    assert all(x['Type'] == 'tmpfs' for x in c.get('Mounts', []))
    assert h['PidsLimit'] == 128 and h['Memory'] == 536870912


class Lane:
    def __init__(self, output):
        self.p = json.loads(PROFILE.read_text())
        validate(self.p)
        self.out = Path(output).resolve()
        self.out.mkdir(mode=0o700, parents=True, exist_ok=False)
        self.run = 'cladora-lane-' + uuid.uuid4().hex[:12]
        self.owned = []
        self.images = []
        self.sensitive = []
        self.r = {'profile': self.p['profile'], 'run_id': self.run,
                  'profile_sha256': hashlib.sha256(PROFILE.read_bytes()).hexdigest(),
                  'started_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'stages': {}, 'cleanup': [], 'domain_installation': 'NOT_RUN',
                  'auth_session': 'NOT_RUN', 'hosted_email': 'NOT_RUN',
                  'raw_logs': 'PRIVATE_NOT_PUBLISHED'}
        self.save()

    def save(self):
        b = (json.dumps(self.r, indent=2) + '\n').encode()
        with open(self.out / 'receipt.json', 'wb') as f:
            os.chmod(f.name, 0o600)
            f.write(b)
            f.flush()
            os.fsync(f.fileno())

    def cmd(self, stage, args, timeout=20, extra=None):
        self.r['stages'][stage] = {'status': 'DISPATCHED', 'at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        self.save()  # write-ahead prevents silent replay after host interruption
        env = environment()
        env.update(extra or {})
        try:
            c = subprocess.run(DOCKER + args, env=env, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            self.r['stages'][stage]['status'] = 'UNKNOWN_TIMEOUT'
            self.save()
            raise RuntimeError(stage + ':UNKNOWN_TIMEOUT')
        raw = c.stdout + c.stderr
        for value in self.sensitive:
            raw = raw.replace(value.encode(), b'[EPHEMERAL_SECRET_REDACTED]')
        with open(self.out / (stage + '.private.log'), 'wb') as f:
            os.chmod(f.name, 0o600)
            f.write(raw)
        self.r['stages'][stage].update(status='ACKNOWLEDGED' if c.returncode == 0 else 'FAILED',
                                      exit_code=c.returncode, output_sha256=hashlib.sha256(raw).hexdigest())
        self.save()
        if c.returncode:
            raise RuntimeError(stage + ':COMMAND_FAILED')
        return c.stdout.decode()

    def image(self, role):
        pin = self.p[role]
        # Capture pre-existing image IDs; only newly acquired, unused images eligible for cleanup.
        before = self.cmd(role + '-image-inventory', ['image', 'ls', '--no-trunc', '-q']).split()
        self.cmd(role + '-pull', ['pull', '--platform=linux/amd64', pin['image']], 180)
        self.images.append((pin['image'], pin['image_id'], pin['image_id'] not in before))
        image = json.loads(self.cmd(role + '-image-inspect', ['image', 'inspect', pin['image']]))[0]
        assert image['Id'] == pin['image_id'] and image['Architecture'] == 'amd64' and image['Os'] == 'linux'
        self.r['stages'][role + '-image-inspect']['identity'] = pin['image_id']
        self.save()

    def create(self, role, tail, pgcid=None, extra=None):
        name = self.run + '-' + role
        # Name is inventoried before mutation; custody uses label + returned CID.
        names = self.cmd(role + '-names', ['ps', '-a', '--format', '{{.Names}}']).split()
        assert name not in names
        self.owned.append({'name': name, 'cid': None, 'role': role})
        self.r['resources'] = self.owned
        self.save()
        args = ['create', '--pull=never', '--name', name, '--label', 'cladora.runtime.run=' + self.run,
                '--network', 'none' if role == 'pg' else 'container:' + pgcid,
                '--read-only', '--user', '999:999', '--cap-drop=ALL',
                '--security-opt=no-new-privileges:true', '--memory=512m', '--cpus=0.5', '--pids-limit=128',
                '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m,uid=999,gid=999,mode=1770']
        for key in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'):
            args += ['-e', key + '=']
        args += tail
        cid = self.cmd(role + '-create', args, extra=extra).strip()
        assert len(cid) == 64 and all(c in '0123456789abcdef' for c in cid)
        self.owned[-1]['cid'] = cid
        self.save()
        obj = json.loads(self.cmd(role + '-prestart', ['inspect', cid]))[0]
        inspect_config(obj, role, pgcid)
        assert obj['Config']['Labels']['cladora.runtime.run'] == self.run
        self.cmd(role + '-start', ['start', cid])
        obj = json.loads(self.cmd(role + '-live', ['inspect', cid]))[0]
        inspect_config(obj, role, pgcid)
        assert obj['State']['Running'], role + ':PROCESS_NOT_RUNNING'
        return cid

    def execute(self):
        try:
            self.cmd('docker-info', ['info', '--format', '{{.ServerVersion}}'])
            for role in ('pg', 'auth'):
                self.image(role)
            pg = self.create('pg', [
                '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=512m,uid=999,gid=999,mode=0700',
                '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=999,gid=999,mode=0770',
                '--entrypoint', 'sh', self.p['pg']['image'], '-ec',
                'initdb -D /var/lib/postgresql/data --auth-local=trust --auth-host=trust >/tmp/initdb.log; '
                'exec postgres -D /var/lib/postgresql/data -c listen_addresses=127.0.0.1 '
                '-c unix_socket_directories=/var/run/postgresql'])
            # Health waits are polling, not mutation retries. One initdb/server start only.
            self.cmd('pg-health', ['exec', pg, 'sh', '-ec',
                                  'i=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null; do '
                                  'i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'], 65)
            identity = self.cmd('pg-identity', ['exec', pg, 'psql', '-h', '127.0.0.1', '-U', 'postgres',
                                              '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
                                              "SELECT current_setting('server_version_num'),current_user,current_database();"])
            assert identity.strip().startswith('17')
            self.r['pg_identity'] = identity.strip()
            # GoTrue's own initial migration expects this empty provider namespace.
            # Exact disposable-only bootstrap, NOT application/native SQL or a GRANT.
            self.cmd('auth-namespace-bootstrap', ['exec', pg, 'psql', '-h', '127.0.0.1', '-U', 'postgres',
                '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
                'CREATE SCHEMA auth AUTHORIZATION postgres;'])
            # No auth password, hosted key, grant or domain installer is used. The actual
            # Auth server runs only its own version-pinned provider schema migrations.
            secret = secrets.token_hex(32)
            self.sensitive.append(secret)
            env = {'GOTRUE_JWT_SECRET': secret}
            auth_env = {'GOTRUE_API_HOST': '127.0.0.1', 'GOTRUE_API_PORT': '9999',
                        'API_EXTERNAL_URL': 'http://127.0.0.1:9999', 'GOTRUE_SITE_URL': 'http://127.0.0.1:3000',
                        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': 'postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable',
                        'GOTRUE_DB_NAMESPACE': 'auth', 'GOTRUE_DISABLE_SIGNUP': 'true',
                        'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'false', 'GOTRUE_EXTERNAL_PHONE_ENABLED': 'false',
                        'GOTRUE_MAILER_AUTOCONFIRM': 'false', 'GOTRUE_JWT_AUD': 'authenticated'}
            tail = []
            for k, v in auth_env.items():
                tail += ['-e', k + '=' + v]
            tail += ['-e', 'GOTRUE_JWT_SECRET', self.p['auth']['image']]
            auth = self.create('auth', tail, pg, env)
            # PG has bash: make a loopback-only HTTP GET, never signup/session fabrication.
            health = self.cmd('auth-health', ['exec', pg, 'bash', '-ec',
                'for ((i=0;i<60;i++)); do if (exec 3<>/dev/tcp/127.0.0.1/9999) 2>/dev/null; then '
                'exec 3<>/dev/tcp/127.0.0.1/9999; printf "GET /health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n" >&3; '
                'cat <&3; exit 0; fi; sleep 1; done; exit 1'], 65)
            assert '200 OK' in health and self.p['auth']['version'] in health, 'auth:HEALTH_OR_VERSION_MISMATCH'
            self.r['auth_health'] = {'http': 200, 'version': self.p['auth']['version'], 'provider': 'real GoTrue', 'session_proof': False}
            schema = self.cmd('auth-schema-identity', ['exec', pg, 'psql', '-h', '127.0.0.1', '-U', 'postgres',
                '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
                "SELECT to_regclass('auth.users') IS NOT NULL,to_regclass('auth.schema_migrations') IS NOT NULL;"])
            assert schema.strip() == 't|t', 'auth:PROVIDER_SCHEMA_MISSING'
            self.cmd('network-proof', ['exec', pg, 'sh', '-ec',
                'test "$(ls /sys/class/net)" = lo; test "$(wc -l </proc/net/route)" -eq 1; '
                'test "$(id -u)" = 999; test "$(id -g)" = 999'])
            self.r['health_result'] = 'PG17_AND_REAL_AUTH_HEALTH_PROVED_NO_DOMAIN_INSTALL'
        except Exception as error:
            self.r['primary_error'] = str(error) if isinstance(error, (RuntimeError, AssertionError)) else type(error).__name__
            self.r['health_result'] = 'FAILED_OR_UNKNOWN'
        finally:
            self.cleanup()
            self.r['ended_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            self.save()
        return self.r

    def cleanup(self):
        for entry in reversed(self.owned):
            result = {'resource': entry['role'], 'state': 'unknown'}
            try:
                obj = json.loads(self.cmd(entry['role'] + '-cleanup-inspect', ['inspect', entry['cid'] or entry['name']]))[0]
                assert obj['Config']['Labels']['cladora.runtime.run'] == self.run
                if entry['cid']:
                    assert obj['Id'] == entry['cid']
                # Diagnostic failure must not suppress destruction or replace primary error.
                try:
                    self.cmd(entry['role'] + '-private-process-log', ['logs', '--tail', '100', obj['Id']])
                except Exception:
                    pass
                self.cmd(entry['role'] + '-destroy', ['rm', '-f', obj['Id']])
                ids = self.cmd(entry['role'] + '-absence', ['ps', '-a', '--no-trunc', '-q', '--filter', 'id=' + obj['Id']])
                assert not ids.strip()
                result['state'] = 'acknowledged-absent'
            except Exception as error:
                result['detail'] = type(error).__name__
            self.r['cleanup'].append(result)
            self.save()
        for index, (image, identity, acquired) in enumerate(reversed(self.images)):
            result = {'image_id': identity, 'state': 'skipped-preexisting'}
            try:
                if acquired:
                    used = self.cmd('image-users-' + str(index), ['ps', '-a', '-q', '--filter', 'ancestor=' + identity])
                    assert not used.strip()
                    self.cmd('image-remove-' + str(index), ['image', 'rm', image])
                    result['state'] = 'removal-acknowledged'
            except Exception as error:
                result.update(state='unknown', detail=type(error).__name__)
            self.r['cleanup'].append(result)
            self.save()


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('--run-directory', required=True)
    args = a.parse_args()
    result = Lane(args.run_directory).execute()
    print(json.dumps({'health_result': result['health_result'], 'primary_error': result.get('primary_error'),
                      'cleanup': result['cleanup'], 'receipt': str(Path(args.run_directory) / 'receipt.json')}))
    raise SystemExit(0 if result['health_result'].startswith('PG17_AND_') else 1)
