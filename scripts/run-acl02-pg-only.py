#!/usr/bin/env python3
"""Separate pure-PG provisioner; no Auth fixture mutation or arbitrary exec hook."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import time
import sys
import uuid
from local_runtime_consumer import AdmissionError, digest
import acl02_pg_adapter as adapter
from acl02_pg_wire import Wire

spec = importlib.util.spec_from_file_location('runtime_lane', Path(__file__).with_name('run-local-runtime-lane.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
PROFILE = adapter.PROFILE


def validate(p):
    if (p['profile'] != 'runtime-pg-only-acl02-v1' or p['target'] != 'owned-disposable-pg17-only'
            or p['auth'] is not None or p['pg']['major'] != 17
            or p['pg']['image'] != 'docker.io/library/postgres@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416'
            or p['pg']['image_id'] != 'sha256:99445113a4a19e82dd3713c65bd9f6fb5bf972065ab043df8d1e1c93e957da9a'):
        raise AdmissionError('PURE_PG_PROFILE_REQUIRED')
    isolation = p['isolation']
    for k, v in {'network': 'none', 'user': '999:999', 'rootfs_readonly': True,
                 'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'],
                 'published_ports': [], 'bind_mounts': [], 'named_volumes': [],
                 'memory': 536870912, 'nano_cpus': 500000000, 'pids': 128}.items():
        if isolation[k] != v:
            raise AdmissionError('PURE_PG_ISOLATION_DRIFT:' + k)
    if isolation['tmpfs'] != {
        '/tmp': 'rw,noexec,nosuid,nodev,size=16m,uid=999,gid=999,mode=1770',
        '/var/lib/postgresql/data': 'rw,noexec,nosuid,nodev,size=512m,uid=999,gid=999,mode=0700',
        '/var/run/postgresql': 'rw,noexec,nosuid,nodev,size=8m,uid=999,gid=999,mode=0770'}:
        raise AdmissionError('PURE_PG_TMPFS_DRIFT')


class PurePGLane(base.Lane):
    profile_path = PROFILE
    validate_profile = staticmethod(validate)

    @staticmethod
    def binding():
        return {'runner_sha256': adapter.seal()['sha256'], 'profile_sha256': digest(PROFILE.read_bytes())}

    def __init__(self, output, raw=None):
        if sys.flags.optimize:
            raise AdmissionError('OPTIMIZED_PYTHON_NOT_ADMITTED')
        # Fail closed before directory allocation/Docker, using separate target admission.
        admitted = adapter.admit(raw) if raw is not None else None
        self.initial_seal = adapter.seal()
        super().__init__(output)
        self.raw = raw
        self.admitted = admitted
        self.attempt = uuid.uuid4().hex
        self.r['attempt'] = self.attempt
        self.r['auth_provider'] = 'NOT_PRESENT_PG_ONLY'
        self.r['consumer'] = {'status': 'NOT_RUN' if raw is not None else 'NOT_REQUESTED'}
        self.save()

    def check_container(self, c, role, pgcid=None):
        assert role == 'pg' and pgcid is None
        base.inspect_config(c, 'pg')
        h = c['HostConfig']
        assert c['Image'] == self.p['pg']['image_id']
        assert h['NanoCpus'] == 500000000 and h['IpcMode'] == 'private'
        assert not h.get('VolumesFrom') and not h.get('ExtraHosts') and not h.get('Links')
        assert not h.get('DeviceRequests') and not h.get('Sysctls')
        assert h.get('UTSMode', '') == '' and h.get('UsernsMode', '') == ''
        assert h['Tmpfs'] == self.p['isolation']['tmpfs']
        destinations = set()
        for mount in c.get('Mounts', []):
            assert mount['Type'] == 'tmpfs' and mount['Destination'] in h['Tmpfs']
            assert mount['Destination'] not in destinations
            destinations.add(mount['Destination'])
        assert all(not bindings for bindings in c['NetworkSettings'].get('Ports', {}).values())
        assert c['Config']['Labels']['cladora.runtime.run'] == self.run
        assert c['HostConfig']['NetworkMode'] == 'none'
        assert c['Config']['Entrypoint'] == ['sh']
        assert c['Config']['Cmd'] == self.pg_tail()[-2:]
        assert all(not value.split('=', 1)[1] for value in c['Config']['Env']
                   if value.split('=', 1)[0].lower().endswith('proxy'))

    def pg_tail(self):
        tail = []
        for destination, options in self.p['isolation']['tmpfs'].items():
            if destination != '/tmp':
                tail += ['--tmpfs', destination + ':' + options]
        return tail + ['--entrypoint', 'sh', self.p['pg']['image'], '-ec',
            'initdb -D /var/lib/postgresql/data --auth-local=trust --auth-host=trust >/tmp/initdb.log; '
            'exec postgres -D /var/lib/postgresql/data -c listen_addresses=127.0.0.1 '
            '-c unix_socket_directories=/var/run/postgresql']

    def assert_source(self):
        if adapter.seal() != self.initial_seal:
            raise AdmissionError('SOURCE_CHANGED_AT_EFFECT')
        if self.raw is not None and adapter.admit(self.raw) != self.admitted:
            raise AdmissionError('REVIEW_CHANGED_AT_EFFECT')

    def assert_target(self):
        self.assert_source()
        assert len(self.owned) == 1 and self.owned[0]['role'] == 'pg'
        owned = self.owned[0]
        c = json.loads(self.cmd('effect-target-inspect', ['inspect', owned['cid']]))[0]
        assert c['Id'] == owned['cid'] and c['Name'] == '/' + owned['name'] and c['State']['Running']
        self.check_container(c, 'pg')

    def persist_consumer(self, value):
        self.r['consumer'] = value
        self.save()

    def execute(self):
        # Claim outside try/finally: repeat invocation cannot mutate or re-clean a run.
        with (self.out / 'provision-attempt.claim').open('xb') as claim:
            os.chmod(claim.name, 0o600)
            claim.write((self.run + ':' + self.attempt).encode())
            claim.flush()
            os.fsync(claim.fileno())
        connection = None
        try:
            self.assert_source()
            self.cmd('docker-info', ['info', '--format', '{{.ServerVersion}}'])
            self.image('pg')
            self.assert_source()
            pg = self.create('pg', self.pg_tail())
            self.cmd('pg-health', ['exec', pg, 'sh', '-ec',
                'i=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null; do '
                'i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'], 65)
            self.cmd('network-proof', ['exec', pg, 'sh', '-ec',
                'test "$(ls /sys/class/net)" = lo; test "$(wc -l </proc/net/route)" -eq 1; '
                'test "$(id -u)" = 999; test "$(id -g)" = 999'])
            connection = Wire(pg, self.run, self.attempt, 'health', self.out,
                              base.DOCKER, base.environment(), self.assert_target)
            identity = connection.identity(self.assert_target)
            empty = connection.query(b"SELECT json_build_object('auth_absent',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth'),'application_absent',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('app_private','customer_api','platform','identity','maintenance','ops_acl02_api','ops_acl02_private')));", self.assert_target, 5)
            assert not empty['errors'] and empty['ready'] == 'I'
            assert empty['rows'] == [{'auth_absent': True, 'application_absent': True}]
            self.r['pg_identity'] = identity
            self.r['health_result'] = 'PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL'
            connection.close()
            connection = None
            self.save()
            if self.raw is not None:
                self.r['consumer'] = adapter.execute(self.raw, self.admitted,
                    adapter.PurePGFixture(self.run, self.attempt, pg), self.out,
                    base.DOCKER, base.environment(), self.assert_target, self.persist_consumer)
                self.save()
        except Exception as error:
            self.r.setdefault('primary_error', str(error))
            if self.raw is not None and self.r['consumer']['status'] != 'NOT_RUN':
                self.r['consumer']['status'] = 'FAILED_OR_UNKNOWN'
        finally:
            if connection is not None:
                try:
                    connection.close()
                except Exception as error:
                    self.r.setdefault('primary_error', str(error))
            try:
                self.cleanup()
            except Exception as error:
                self.r.setdefault('primary_error', 'cleanup:' + str(error))
                self.r.setdefault('cleanup_errors', []).append(str(error))
            base.finalize_lifecycle(self.r, self.owned, self.images, pg_only=True)
            self.r['ended_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            self.save()
        return self.r


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-directory', required=True)
    parser.add_argument('--consumer-envelope')
    args = parser.parse_args(argv)
    raw = Path(args.consumer_envelope).read_bytes() if args.consumer_envelope else None
    try:
        lane = PurePGLane(args.run_directory, raw)
    except AdmissionError as error:
        print(json.dumps({'overall_result': 'HOLD', 'consumer': 'NOT_RUN', 'reason': str(error)}))
        return 2
    r = lane.execute()
    print(json.dumps({k: r[k] for k in ('health_result', 'overall_result', 'cleanup_completeness', 'consumer')}))
    return r['exit_code']


if __name__ == '__main__':
    raise SystemExit(main())
