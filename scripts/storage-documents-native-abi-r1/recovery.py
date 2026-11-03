"""R2 fixed recovery transaction over the existing Wire, never a new transport.

The catalog barrier and both complete snapshots share one physical backend.
No callback can supply SQL; the harness verifies every named material against
the closed renderer. Unknown streams are closed, never replayed or rolled back.
"""
import copy
import struct
import time

from audit import fingerprint


CATALOGS = (
 'pg_attribute', 'pg_attrdef', 'pg_authid', 'pg_auth_members', 'pg_class',
 'pg_collation', 'pg_database', 'pg_default_acl', 'pg_enum', 'pg_language',
 'pg_namespace', 'pg_operator', 'pg_policy', 'pg_proc', 'pg_range',
 'pg_rewrite', 'pg_trigger', 'pg_type',
)
CONTRACT = {
 'format': 'platform15-atomic-recovery.v2',
 'isolation': 'READ COMMITTED',
 'catalogs': list(CATALOGS),
 'lock_mode': 'SHARE ROW EXCLUSIVE',
 'lock_timeout_seconds': 3,
 'statement_timeout_seconds': 10,
 'idle_in_transaction_timeout_seconds': 5,
 'window_seconds': 20,
 'terminal_seconds': 5,
 'rollback_seconds': 5,
 'phases': ['recovery_begin', 'recovery_state', 'acl_recover', 'recovery_state', 'recovery_commit'],
 'snapshot': 'complete original catalog ABI; comparison under catalog locks on same backend',
 'expiry': 'original reviewed cleanup-only-after-expiry ceiling; no normal authority renewal; hard recovery window never extended',
 'window': 'coordinator-exclusive Storage ACL/DDL window required; database catalogs and cluster-wide role writers may wait',
 'unknown': 'no replay/rollback on quarantined or unidentified stream; close own relay and custodian follow-up',
}


class RecoveryError(RuntimeError):
 pass


def require(ok, reason):
 if not ok:
  raise RecoveryError(reason)


def expected_restoration(original, prestate):
 """Keep residual owned policies exact, never erase them from a comparison."""
 result = copy.deepcopy(original)
 result['namespace']['acl'] = ['supabase_storage_admin=UC/supabase_storage_admin']
 expected = {r['name']: r for r in prestate['relations']}
 require(set(expected) == {r['name'] for r in result['relations']}, 'RECOVERY_RELATION_SET')
 for rel in result['relations']:
  rel['policies'] = copy.deepcopy(expected[rel['name']]['policies'])
 return result


class AtomicRecovery:
 def __init__(self, wire, materials, gate, persist, prestate, poststate, clock=time.monotonic):
  self.wire, self.materials, self.gate, self.persist = wire, materials, gate, persist
  self.prestate, self.poststate, self.clock = prestate, poststate, clock
  self.pid = wire.pid
  self.deadline = clock() + CONTRACT['window_seconds']
  self.receipt = {'status': 'NOT_RUN', 'pid': self.pid, 'steps': [],
   'rollback': {'state': 'skipped', 'reason': 'not_attempted'},
   'close': {'state': 'skipped'}, 'commit': 'NOT_DISPATCHED', 'first_error': None}

 def check(self):
  # The gate may hash/inspect/fsync/await. Check the hard clock AFTER it, too.
  require(self.clock() < self.deadline, 'RECOVERY_WINDOW_EXPIRED')
  self.gate()
  require(self.clock() < self.deadline, 'RECOVERY_WINDOW_EXPIRED')
  require(self.wire.pid == self.pid and self.pid is not None and not self.wire.quarantined,
   'RECOVERY_BACKEND_UNKNOWN')

 def exchange(self, name, label, idle, tags):
  require(self.wire.idle == idle, 'RECOVERY_TRANSACTION_STATE')
  payload = self.materials(name)
  require(isinstance(payload, bytes) and 0 < len(payload) + 6 <= 12288, 'RECOVERY_FRAME_BOUND')
  self.persist({'event': label + '-intent', **self.receipt})
  self.check()  # after material read and durable intent, immediately before send
  require(self.wire.idle == idle, 'RECOVERY_TRANSACTION_STATE')
  # A dispatched COMMIT settles within its own bounded ACK deadline, even if
  # that crosses the window. Expiry alone says nothing about its outcome.
  seconds = min(CONTRACT['terminal_seconds'], self.deadline - self.clock())
  self.wire.deadline = self.clock() + seconds
  if name == 'recovery_commit':
   self.receipt['commit'] = 'DISPATCHED_ACK_UNKNOWN'
  self.wire.send(b'Q' + struct.pack('!I', len(payload) + 5) + payload + b'\0')
  result = self.wire.drain()  # existing reader fsyncs every frame before ACK
  self.receipt['steps'].append({'phase': label, 'pid': result['pid'],
   'tags': result['tags'], 'ready': result['ready'], 'errors': result['errors'],
   'rows_sha256': fingerprint(result['rows']), 'wire_chain': result['chain']})
  self.persist({'event': label + '-terminal', **self.receipt})
  if result['pid'] != self.pid or self.wire.pid != self.pid:
   self.wire.quarantined = True
   raise RecoveryError('RECOVERY_BACKEND_CHANGED')
  require(not result['errors'], 'RECOVERY_SQL_ERROR_' + '-'.join(result['errors']))
  if result['ready'] != ('I' if name == 'recovery_commit' else 'T') or result['tags'] != tags:
   self.wire.quarantined = True
   raise RecoveryError('RECOVERY_TERMINAL_ACK_UNKNOWN')
  return result

 def snapshot(self, phase, expected):
  value = self.exchange('recovery_state', phase, 'T', ['SELECT 1'])
  require(len(value['rows']) == 1 and isinstance(value['rows'][0], dict), 'RECOVERY_SNAPSHOT_SHAPE')
  require(fingerprint(value['rows'][0]) == fingerprint(expected), phase.upper() + '_MISMATCH')
  self.check()  # hashing and persistence never extend the permit/window

 def run(self):
  try:
   self.check()
   self.receipt['status'] = 'DISPATCHED'
   self.exchange('recovery_begin', 'locked-begin', 'I', ['BEGIN', 'SET', 'SET', 'SET', 'LOCK TABLE'])
   self.snapshot('recovery-prestate', self.prestate)
   self.exchange('acl_recover', 'recovery-body', 'T',
    ['DO', 'DO', 'SET', 'REVOKE', 'REVOKE', *(['GRANT'] * 7), 'RESET'])
   self.snapshot('recovery-poststate', self.poststate)
   self.exchange('recovery_commit', 'recovery-commit', 'T', ['COMMIT'])
   self.receipt['commit'] = 'ACKNOWLEDGED_COMMAND_COMPLETE_IDLE'
   self.receipt['rollback'] = {'state': 'skipped', 'reason': 'commit_acknowledged'}
   self.receipt['status'] = 'COMMIT_ACKNOWLEDGED_OBSERVER_PENDING'
   self.persist({'event': 'recovery-commit-ack', **self.receipt})
   return self.receipt
  except BaseException as error:
   self.receipt['first_error'] = str(error) or type(error).__name__
   self.receipt['status'] = 'FAILED_OR_UNKNOWN'
   # The exact known backend may be settled after the hard window. This is
   # ROLLBACK only, not an extension/replacement permit for the recovery body.
   try:
    if self.wire.pid != self.pid or self.wire.quarantined:
     self.receipt['rollback'] = {'state': 'unknown', 'reason': 'backend_or_stream_unknown_no_send'}
    else:
     self.receipt['rollback'] = self.wire.rollback_known()
   except BaseException as settlement_error:
    self.receipt['rollback'] = {'state': 'unknown', 'reason': type(settlement_error).__name__}
   try:
    self.persist({'event': 'recovery-failed-settlement', **self.receipt})
   except BaseException:
    pass  # preserve primary failure; durable ACK cannot be invented
   raise
