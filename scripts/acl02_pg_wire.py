"""Bounded PG v3 reader. Transport is fixed docker-exec loopback, never a host port.

Only this module owns the physical stream. K's cancellation secret is discarded;
all other received frames are durably captured before interpreting an ACK.
"""
import hashlib
import json
import os
from pathlib import Path
import select
import struct
import subprocess
import time

RELAY = ('exec 3<>/dev/tcp/127.0.0.1/5432; '
         'cat <&3 & reader=$!; trap "kill $reader 2>/dev/null || :" EXIT; '
         'cat >&3; wait "$reader"')
IDENTITY = b"SELECT json_build_object('database',current_database(),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),'pid',pg_backend_pid(),'user',current_user,'session_user',session_user,'version',current_setting('server_version_num')::int,'xid',pg_current_xact_id_if_assigned()::text);"
MAX_BYTES = 1024 * 1024
MAX_FRAMES = 4096


class WireError(RuntimeError):
    pass


def row_json(body):
    if len(body) < 6 or body[:2] != b'\x00\x01':
        raise WireError('UNKNOWN_ROW_SHAPE')
    size = struct.unpack('!i', body[2:6])[0]
    if size < 0 or size != len(body) - 6:
        raise WireError('UNKNOWN_ROW_LENGTH')
    value = json.loads(body[6:])
    if not isinstance(value, dict):
        raise WireError('UNKNOWN_ROW_JSON')
    return value


class Wire:
    def __init__(self, cid, run, attempt, phase, output, docker, env, before_effect):
        self.cid, self.run, self.attempt, self.phase = cid, run, attempt, phase
        self.pid = None
        self.idle = None
        self.quarantined = False
        self.total = self.frames = 0
        self.chain = '0' * 64
        self.deadline = time.monotonic() + 35
        self.log = open(Path(output) / (phase + '.wire.private.jsonl'), 'xb')
        os.chmod(self.log.name, 0o600)
        self.process = None
        try:
            before_effect()  # source/target/review re-admission at connection effect
            self.process = subprocess.Popen(docker + ['exec', '-i', '--user', '999:999', cid,
                'bash', '-ec', RELAY], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, bufsize=0)
            params = b'user\0postgres\0database\0postgres\0application_name\0' + (run + ':' + attempt + ':' + phase).encode() + b'\0\0'
            self.send(struct.pack('!II', len(params) + 8, 196608) + params)
            startup = self.drain(startup=True)
            if startup['errors']:
                raise WireError('UNKNOWN_STARTUP_ERROR')
            if not self.pid or self.idle != 'I':
                raise WireError('UNKNOWN_STARTUP_IDENTITY')
        except Exception:
            self.quarantined = True
            self.close()
            raise

    def send(self, raw):
        # All sends <= 12KiB; nonblocking bounded write, no unbounded pipe flush.
        fd = self.process.stdin.fileno()
        os.set_blocking(fd, False)
        view = memoryview(raw)
        try:
            while view:
                remain = self.deadline - time.monotonic()
                if remain <= 0 or not select.select([], [fd], [], remain)[1]:
                    raise WireError('UNKNOWN_WRITE_TIMEOUT')
                try:
                    n = os.write(fd, view)
                    if n <= 0:
                        raise WireError('UNKNOWN_SHORT_WRITE')
                    view = view[n:]
                except BlockingIOError:
                    continue
        except Exception:
            self.quarantined = True
            raise

    def read(self, size):
        value = bytearray()
        fd = self.process.stdout.fileno()
        while len(value) < size:
            remain = self.deadline - time.monotonic()
            if remain <= 0 or not select.select([fd], [], [], remain)[0]:
                raise WireError('UNKNOWN_TERMINAL_TIMEOUT')
            chunk = os.read(fd, size - len(value))
            if not chunk:
                raise WireError('UNKNOWN_STREAM_ENDED')
            value.extend(chunk)
        return bytes(value)

    def capture(self, kind, body):
        self.total += len(body) + 5
        self.frames += 1
        if self.total > MAX_BYTES or self.frames > MAX_FRAMES:
            raise WireError('UNKNOWN_CAPTURE_BOUND')
        # Never persist the backend cancellation key.
        safe = body[:4] if kind == b'K' else body
        entry = {'run': self.run, 'attempt': self.attempt, 'cid': self.cid, 'phase': self.phase,
                 'pid': self.pid, 'sequence': self.frames, 'type': kind.decode('ascii'),
                 'wire_bytes': len(body) + 5, 'body_hex': safe.hex(), 'previous': self.chain}
        encoded = json.dumps(entry, sort_keys=True, separators=(',', ':')).encode()
        self.chain = hashlib.sha256(encoded).hexdigest()
        data = encoded + b'\n'
        if self.log.write(data) != len(data):
            raise WireError('UNKNOWN_CAPTURE_SHORT_WRITE')
        self.log.flush()
        os.fsync(self.log.fileno())

    def drain(self, startup=False):
        tags, rows, errors = [], [], []
        self.idle = None
        try:
            while True:
                kind = self.read(1)
                length = struct.unpack('!I', self.read(4))[0]
                if length < 4 or length > MAX_BYTES or self.total + length + 1 > MAX_BYTES:
                    raise WireError('UNKNOWN_FRAME_BOUND')
                body = self.read(length - 4)
                if kind == b'K':
                    if not startup or len(body) != 8 or self.pid is not None:
                        raise WireError('UNKNOWN_BACKEND_KEY')
                    self.pid = struct.unpack('!I', body[:4])[0]
                self.capture(kind, body)  # ACK valid only after fsync
                if kind == b'R' and (not startup or body != b'\0\0\0\0'):
                    raise WireError('UNKNOWN_AUTH_PROTOCOL')
                if kind == b'C':
                    if not body.endswith(b'\0'):
                        raise WireError('UNKNOWN_COMMAND_TAG')
                    tags.append(body[:-1].decode('ascii'))
                elif kind == b'D':
                    rows.append(row_json(body))
                elif kind == b'E':
                    fields = body.rstrip(b'\0').split(b'\0')
                    errors.append(next((x[1:].decode('ascii') for x in fields if x[:1] == b'C'), 'UNKNOWN'))
                elif kind == b'Z':
                    if body not in (b'I', b'T', b'E'):
                        raise WireError('UNKNOWN_READY_STATE')
                    self.idle = body.decode()
                    return {'pid': self.pid, 'tags': tags, 'rows': rows, 'errors': errors,
                            'ready': self.idle, 'chain': self.chain}
                elif kind not in (b'R', b'S', b'K', b'T', b'N', b'C'):
                    raise WireError('UNKNOWN_PROTOCOL_FRAME')
        except Exception:
            self.quarantined = True
            raise

    def query(self, payload, before_effect, seconds=30):
        if self.quarantined or self.idle != 'I':
            raise WireError('UNKNOWN_STREAM_NOT_IDLE')
        before_effect()
        self.deadline = time.monotonic() + seconds
        self.send(b'Q' + struct.pack('!I', len(payload) + 5) + payload + b'\0')
        return self.drain()

    def rollback_known(self):
        # Only after completed ErrorResponse -> ReadyForQuery on THIS stream.
        # Never infer XID/transaction status or send on an unknown/quarantined stream.
        if self.quarantined or self.idle not in ('T', 'E'):
            return {'state': 'skipped', 'reason': 'no_known_open_transaction'}
        self.deadline = time.monotonic() + 5
        self.send(b'Q' + struct.pack('!I', 14) + b'ROLLBACK;\0')
        result = self.drain()
        require_rollback(result)
        return {'state': 'acknowledged', 'terminal': result}

    def identity(self, before_effect):
        result = self.query(IDENTITY, before_effect, 5)
        if result['errors'] or result['ready'] != 'I' or len(result['rows']) != 1:
            raise WireError('UNKNOWN_DATABASE_IDENTITY')
        value = result['rows'][0]
        if (value.get('pid') != self.pid or value.get('database') != 'postgres'
                or value.get('user') != 'postgres' or value.get('session_user') != 'postgres'
                or not 170000 <= value.get('version', 0) < 180000
                or not str(value.get('system_identifier', '')).isdigit()
                or not str(value.get('database_oid', '')).isdigit()):
            raise WireError('UNKNOWN_DATABASE_IDENTITY')
        return value

    def close(self):
        if self.process is not None:
            # Close exact relay, not a database backend by unverified PID.
            try:
                self.process.stdin.close()
                self.process.wait(timeout=2)
            except (OSError, subprocess.TimeoutExpired):
                self.process.kill()
                self.process.wait(timeout=2)
            finally:
                self.process.stdout.close()
        self.log.close()


def require_rollback(result):
    if result['errors'] or result['ready'] != 'I' or not result['tags'] or result['tags'][-1] != 'ROLLBACK':
        raise WireError('UNKNOWN_ROLLBACK_IDLE_ACK')


def require_residue(result, installer_identity, observer_identity):
    require_rollback(result)
    if (installer_identity['pid'] == observer_identity['pid']
            or any(installer_identity[k] != observer_identity[k] for k in
                   ('system_identifier', 'database_oid', 'database', 'version'))):
        raise WireError('UNKNOWN_OBSERVER_IDENTITY')
    if len(result['rows']) != 1:
        raise WireError('UNKNOWN_RESIDUE')
    value = result['rows'][0]
    if (value.get('stage') != 'ACL02_RESIDUE' or value.get('database') != 'postgres'
            or value.get('backend_pid') != observer_identity['pid']
            or value.get('server_version_num') != observer_identity['version']
            or type(value.get('roles_remaining')) is not int or type(value.get('schemas_remaining')) is not int
            or value['roles_remaining'] != 0 or value['schemas_remaining'] != 0):
        raise WireError('NONZERO_OR_UNKNOWN_RESIDUE')
