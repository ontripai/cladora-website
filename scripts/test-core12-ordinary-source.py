"""Offline mocks/binary frames only. No Docker, SQL parser, PG or native PASS."""
import argparse
import contextlib
from dataclasses import FrozenInstanceError
import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('core12_ordinary_contract',HERE/'core12_ordinary_contract.py')
c=importlib.util.module_from_spec(spec);sys.modules[spec.name]=c;spec.loader.exec_module(c)
runner=c.load_module('core12_ordinary_runner',HERE/'run-core12-ordinary.py');w=runner.w

class Pipe:
 def fileno(self):return 12345
 def close(self):pass
class Process:
 def __init__(self):self.stdin=Pipe();self.stdout=Pipe();self.returncode=None
 def wait(self,timeout=None):self.returncode=0;return 0
 def kill(self):self.returncode=-9
class Owner:
 """Unit-only owner; production require_owner is mocked, never self-approved."""
 run='cladora-lane-'+'1'*12;attempt='2'*32;cid='3'*64;request_sha256='4'*64;core_seal={'sha256':'5'*64}
 def __init__(self,out):self.out=Path(out);self.revoked=False;self.wires=[];self.errors=[]
 def gate(self,recovery=False):c.need(not self.revoked or recovery,'UNIT_REVOKED')
 def track_wire(self,wire):self.wires.append(wire)
 def note_close_error(self,error):self.errors.append(error)

def startup_ack(self,startup=False):self.pid=41;self.idle='I';return {'errors':[]}
def terminal(self,startup=False):
 self.idle='I';return {'pid':self.pid,'tags':['DO','ROLLBACK'],'rows':[],'errors':[],'ready':'I','chain':'6'*64}

class SourceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=os.environ.get('CORE12_WITNESS');assert p,'explicit existing exact witness cache required'
  cls.witness=Path(p).read_bytes();c.witness(cls.witness)

 @contextlib.contextmanager
 def connection(self,actor='executor',phase='executor'):
  with tempfile.TemporaryDirectory() as out,contextlib.ExitStack() as stack:
   sent=[];owner=Owner(out)
   stack.enter_context(patch.object(w,'require_owner'))  # Explicit source-only mock, no registry authority.
   spawn=stack.enter_context(patch.object(w.legacy.base.subprocess,'Popen',return_value=Process()))
   stack.enter_context(patch.object(w.os,'set_blocking'))
   stack.enter_context(patch.object(w.select,'select',side_effect=lambda r,wr,x,t:([],wr,[])))
   stack.enter_context(patch.object(w.os,'write',side_effect=lambda fd,b:(sent.append(bytes(b)) or len(b))))
   stack.enter_context(patch.object(w.BaseWire,'drain',startup_ack))
   wire=w.Core12Wire(owner,actor,phase,self.witness)
   try:yield wire,sent,owner,spawn
   finally:wire.close()

 def test_01_exact_source_and_empty_registry_no_allocation(self):
  raw=c.REQUEST.read_bytes();self.assertEqual(c.inspect(raw,self.witness)['status'],'SOURCE_VALID_LIVE_HOLD')
  req=json.loads(raw)
  for key in ['target','executor','observer','authority','execution_binding']:self.assertIsNone(req[key])
  self.assertEqual(json.loads(c.REGISTRY.read_bytes())['reviews'],{})
  with tempfile.TemporaryDirectory() as out,patch('subprocess.Popen') as spawn:
   fresh=Path(out)/'not-created'
   with self.assertRaisesRegex(c.Hold,'NO_CURATED_EXECUTION_REVIEW'):runner.Core12OrdinaryLane(fresh,raw,self.witness)
   self.assertFalse(fresh.exists());spawn.assert_not_called()

 def test_02_wrong_source_flags_and_arbitrary_mode(self):
  for bad in [self.witness[:-1],self.witness+b' ',b'COMMIT;',bytes(20744)]:
   with self.assertRaises(c.Hold):c.witness(bad)
  req=json.loads(c.REQUEST.read_bytes());req['approved']=True
  with self.assertRaises(c.Hold):c.admit(json.dumps(req).encode(),'/unit-path')
  for args in [['--exec','id'],['--run'],['--inspect-request','extra']]:
   with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):runner.main(args)

 def test_03_startup_actor_options_compact_and_no_injection(self):
  for actor,a in c.profile()['actors'].items():
   app='core12:'+actor+':'+'a'*32;packet=w.startup(actor,app)
   self.assertEqual(struct.unpack('!II',packet[:8]),(len(packet),196608))
   fields=packet[8:-1].split(b'\0');params=dict(zip(fields[::2],fields[1::2]));self.assertEqual(params[b'user'].decode(),a['user']);self.assertEqual(params[b'database'].decode(),a['database'])
   self.assertLess(len(params[b'application_name']),64)
   self.assertEqual(params.get(b'options',b'').decode(),a['options'])
  for actor,app in [('postgres','x'),('executor','x\0user\0postgres'),('observer','core12:executor:'+'a'*32)]:
   with self.assertRaises(c.Hold):w.startup(actor,app)

 def test_04_default_wire_and_default_profile_unchanged(self):
  with tempfile.TemporaryDirectory() as out,patch.object(w.BaseWire,'send') as send,patch.object(w.BaseWire,'drain',startup_ack),patch('subprocess.Popen',return_value=Process()):
   wire=w.BaseWire('a'*64,'run','attempt','default',out,['unit-docker'],{},lambda:None)
   expected=b'user\0postgres\0database\0postgres\0application_name\0run:attempt:default\0\0'
   self.assertEqual(send.call_args.args[0],struct.pack('!II',len(expected)+8,196608)+expected);wire.close()
  runner.old.validate(json.loads((c.ROOT/'supabase/local-profiles/runtime-pg-only-acl02-v1.json').read_bytes()))
  runner.validate_profile(c.profile())

 def test_05_closed_core_startup_uses_same_process_and_single_packet(self):
  with self.connection() as (wire,sent,owner,spawn):
   self.assertEqual(len(sent),1);self.assertEqual(sent[0],w.startup('executor',wire.application));self.assertEqual(spawn.call_count,1)
   self.assertEqual(wire.pid,41);self.assertEqual(wire.cid,owner.cid)
  with tempfile.TemporaryDirectory() as out,patch('subprocess.Popen') as spawn:
   with self.assertRaisesRegex(c.Hold,'TYPED_LANE_REQUIRED'):w.Core12Wire(Owner(out),'executor','executor',self.witness)
   spawn.assert_not_called()

 def test_06_witness_one20750_frame_exact_no_split_render_or_replay(self):
  with self.connection() as (wire,sent,owner,spawn),patch.object(w.BaseWire,'drain',terminal):
   sent.clear();result=wire.fixed('witness')
   self.assertEqual(len(sent),1);frame=sent[0];self.assertEqual(len(frame),20750);self.assertEqual(frame[:1],b'Q')
   self.assertEqual(struct.unpack('!I',frame[1:5])[0],20749);self.assertEqual(frame[5:-1],self.witness);self.assertEqual(frame[-1:],b'\0')
   self.assertTrue(result['core12']['fsync_ack']);self.assertEqual(result['core12']['connection_id'],wire.connection_id)
   with self.assertRaisesRegex(c.Hold,'OPERATION_REPLAY'):wire.fixed('witness')

 def test_07_partial_os_writes_preserve_one_frame_and_budget(self):
  with self.connection() as (wire,sent,owner,spawn),patch.object(w.BaseWire,'drain',terminal):
   pieces=[]
   def partial(fd,b):n=min(3000,len(b));pieces.append(bytes(b[:n]));return n
   with patch.object(w.os,'write',side_effect=partial):wire.fixed('witness')
   raw=b''.join(pieces);self.assertEqual(len(raw),20750);self.assertEqual(raw[5:-1],self.witness)
   self.assertEqual(__import__('acl02_pg_wire').MAX_BYTES,1048576);self.assertEqual(__import__('acl02_pg_wire').MAX_FRAMES,4096)

 def test_08_revoke_after_wait_no_write_unknown_quarantine(self):
  with self.connection() as (wire,sent,owner,spawn),patch.object(w.BaseWire,'drain',terminal):
   sent.clear()
   def revoke(r,wr,x,t):owner.revoked=True;return [],wr,[]
   with patch.object(w.select,'select',side_effect=revoke):
    with self.assertRaisesRegex(c.Hold,'UNIT_REVOKED'):wire.fixed('witness')
   self.assertEqual(sent,[]);self.assertTrue(wire.quarantined);self.assertEqual(wire.recover()['state'],'skipped')

 def test_09_wrong_or_missing_terminal_ack_never_success(self):
  for key,value in [('ready','E'),('pid',999),('tags',['ROLLBACK']),('tags',['DO'])]:
   with self.connection() as (wire,sent,owner,spawn):
    def bad(self,startup=False):r=terminal(self);r[key]=value;self.idle=r['ready'];return r
    with patch.object(w.BaseWire,'drain',bad),self.assertRaises(c.Hold):wire.fixed('witness')
    with self.assertRaisesRegex(c.Hold,'REPLAY'):wire.fixed('witness')

 def test_10_actor_and_recovery_no_superuser_witness_or_generic_query(self):
  with self.connection('custodian-root','bootstrap') as (wire,sent,owner,spawn):
   before=len(sent)
   with self.assertRaises(c.Hold):wire.fixed('witness')
   with self.assertRaises(c.Hold):wire.query(b'arbitrary',lambda:None)
   with self.assertRaises(c.Hold):wire.identity(lambda:None)
   self.assertEqual(before,len(sent))
  with self.connection() as (wire,sent,owner,spawn):
   wire.recovery=True
   with self.assertRaisesRegex(c.Hold,'RECOVERY_OPERATION'):wire.fixed('witness')

 def test_11_inherited_binary_reader_requires_real_C_and_Z_on_same_stream(self):
  def frame(k,b):return k+struct.pack('!I',len(b)+4)+b
  for suffix,success in [(frame(b'Z',b'I'),True),(b'',False),(frame(b'Z',b'X'),False)]:
   with tempfile.TemporaryDirectory() as out:
    wire=object.__new__(w.BaseWire);wire.pid=41;wire.idle=None;wire.quarantined=False;wire.total=wire.frames=0;wire.chain='0'*64
    wire.run='unit';wire.attempt='unit';wire.cid='a'*64;wire.phase='unit';wire.log=open(Path(out)/'mock-wire','xb')
    data=io.BytesIO(frame(b'C',b'DO\0')+frame(b'C',b'ROLLBACK\0')+suffix)
    def read(n):
     b=data.read(n)
     if len(b)!=n:raise w.WireError('UNKNOWN_STREAM_ENDED')
     return b
    wire.read=read
    try:
     if success:
      result=wire.drain();__import__('acl02_pg_wire').require_rollback(result);self.assertEqual(result['pid'],41)
     else:
      with self.assertRaises(w.WireError):wire.drain()
      self.assertTrue(wire.quarantined)
    finally:wire.log.close()

 def test_12_custodian_correlation_rejects_foreign_partial_or_guessed_address(self):
  one=NS(pid=41,cid='a'*64,application='app1',connection_id='x',observed_identity={'database_oid':'123','user':'core12_boundary_executor','version':170011})
  two=NS(pid=42,cid='a'*64,application='app2',connection_id='y',observed_identity={'database_oid':'123','user':'core12_boundary_observer','version':170011})
  def row():return {'stage':'CORE12_CUSTODIAN_IDENTITY_V1','pid':11,'database':'postgres','user':'postgres','session_user':'postgres','version':170011,'system_identifier':'999','target_database_oid':'123',
   'sessions':[{'pid':x.pid,'database_oid':'123','user':x.observed_identity['user'],'application_name':x.application,'backend_type':'client backend','client_addr':'127.0.0.1','backend_start':'observed-unit-time'} for x in (one,two)]}
  cust=NS(pid=11,cid='a'*64);current=row()
  cust.fixed=lambda op:{'pid':11,'errors':[],'ready':'I','rows':[current]}
  self.assertEqual(w.correlate(cust,[one,two])[0]['system_identifier_source'],'custodian-correlated-same-CID')
  for field,bad in [('pid',999),('database_oid','456'),('application_name','foreign'),('backend_start',None),('client_addr','1.2.3.4')]:
   current=row();current['sessions'][0][field]=bad
   with self.assertRaises(c.Hold):w.correlate(cust,[one,two])
  current=row();current['sessions'].pop()
  with self.assertRaises(c.Hold):w.correlate(cust,[one,two])
  current=row();one.cid='b'*64
  with self.assertRaises(c.Hold):w.correlate(cust,[one,two])

 def test_13_partial_observer_nonzero_and_frozen_baseline(self):
  ident={'database':'core_sqlstate_boundary_proof','database_oid':'123','user':'core12_boundary_observer','session_user':'core12_boundary_observer','version':170011}
  def row():return dict(ident,stage='CORE12_CATALOG_SNAPSHOT_V1',pid=42,read_only=True,protected_sha256='a'*64,witness_functions_remaining=0,matrix_remaining=0,forbidden_schemas=0,snapshot_complete=True)
  observer=NS(pid=42,cid='c'*64,connection_id='unit',observed_identity=ident);current=row();observer.fixed=lambda op:{'pid':42,'errors':[],'ready':'I','rows':[current]}
  baseline,before=w.baseline(observer);current['protected_sha256']='b'*64
  self.assertEqual(baseline.protected_sha256,'a'*64)
  with self.assertRaises(FrozenInstanceError):baseline.protected_sha256='b'*64
  with self.assertRaises(c.Hold):baseline.compare(observer,current)
  for key,bad in [('snapshot_complete',False),('witness_functions_remaining',1),('matrix_remaining',None),('pid',999),('read_only',False),('database_oid','999')]:
   current=row();current[key]=bad
   with self.assertRaises(c.Hold):w.snapshot(observer)

 def test_14_partial_cleanup_nonzero_preserves_first_error(self):
  for entries in [[],[{'kind':'container','resource_id':'unit','identity':'a'*64,'state':'unknown'}],
                  [{'kind':'container','resource_id':'unit','identity':'a'*64,'state':'skipped-preexisting'}]]:
   receipt={'health_result':'PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL','consumer':{'status':'PASSED'},'cleanup':entries,'primary_error':'UNIT_FIRST'}
   runner.old.base.finalize_lifecycle(receipt,[{'role':'pg','name':'unit','cid':'a'*64}],[('img','id',False)],pg_only=True)
   self.assertNotEqual(receipt['exit_code'],0);self.assertEqual(receipt['primary_error'],'UNIT_FIRST');self.assertEqual(receipt['cleanup_completeness'],'UNKNOWN')

 def test_15_setup_minimal_and_no_system_identity_privilege_bridge(self):
  p=c.profile();self.assertEqual(len(p['sql_pins']),7)
  for name,pin in p['sql_pins'].items():
   raw=c.read_file(c.DIRECTORY/name,pin)
   executable_lines=b'\n'.join(line for line in raw.splitlines() if not line.lstrip().startswith(b'--'))
   self.assertNotIn(b'SECURITY DEFINER',executable_lines);self.assertNotIn(b'GRANT EXECUTE',executable_lines)
  self.assertNotIn(b'pg_control_system()',c.read_file(c.DIRECTORY/'ordinary-identity.sql'))
  self.assertEqual(c.read_file(c.DIRECTORY/'setup-database.sql').count(b'CREATE DATABASE core_sqlstate_boundary_proof'),1)
  self.assertIsNone(p['execution_binding']);self.assertIsNone(p['executor']);self.assertEqual(p['live'],'HOLD')

 def test_16_data_or_typed_shell_object_cannot_create_initial_grant(self):
  data=object.__new__(runner.Core12OrdinaryLane);data.r={};data.core_raw=c.REQUEST.read_bytes();data.out=Path('/unit-only')
  data.core_admitted='approved:true'
  with self.assertRaisesRegex(c.Hold,'NO_INITIAL_OWNED_GRANT'):w.require_owner(data,True)
  with self.assertRaisesRegex(c.Hold,'NO_CURATED_EXECUTION_REVIEW'):w.register_live_owner(data)
  self.assertNotIn(data,w._OWNERS)

 def test_17_termination_failure_does_not_suppress_safe_relay_close(self):
  with self.connection() as (wire,sent,owner,spawn):
   def fail_gate(recovery=False):raise c.Hold('UNIT_TERMINATION_PRIMARY')
   owner.gate=fail_gate
   with self.assertRaisesRegex(c.Hold,'UNIT_TERMINATION_PRIMARY'):wire.close()
   self.assertEqual(wire.process.returncode,0);self.assertTrue(wire.log.closed);self.assertTrue(wire._journal.closed)

 def test_18_fixed_run_entry_still_holds_before_any_effect(self):
  with tempfile.TemporaryDirectory() as out,patch('subprocess.Popen') as spawn:
   fresh=Path(out)/'not-created'
   with self.assertRaisesRegex(c.Hold,'NO_CURATED_EXECUTION_REVIEW'):
    runner.main(['--run-directory',str(fresh),'--witness-source',os.environ['CORE12_WITNESS']])
   self.assertFalse(fresh.exists());spawn.assert_not_called()

 def test_19_ordinary_identity_rejects_privilege_latch_and_foreign_target(self):
  actor='executor';p=c.profile()['actors'][actor]
  good={'stage':'CORE12_ORDINARY_IDENTITY_V1','pid':51,'database':p['database'],'database_oid':'123',
   'user':p['user'],'session_user':p['user'],'version':170011,'rolsuper':False,'rolbypassrls':False,
   'rolcreatedb':False,'rolcreaterole':False,'rolreplication':False,'connect':True,'temp':True,
   'plpgsql':True,'memberships':0,'function_defaults':0,'forbidden_schemas':0,'read_only':False,
   'guard_latch':'core12-boundary-v1'}
  current=dict(good);connection=NS(pid=51,actor=actor)
  connection.fixed=lambda op:{'pid':51,'errors':[],'ready':'I','rows':[current]}
  self.assertEqual(w.ordinary_identity(connection),good)
  cases=[(k,True) for k in ('rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication')]
  cases += [('database','postgres'),('user','postgres'),('session_user','postgres'),('version',160000),
   ('memberships',1),('function_defaults',1),('forbidden_schemas',1),('guard_latch',None),
   ('connect',False),('temp',False),('plpgsql',False),('pid',52),('read_only',True)]
  for key,value in cases:
   with self.subTest(key=key):
    current=dict(good);current[key]=value
    with self.assertRaises(c.Hold):w.ordinary_identity(connection)

 def test_20_profile_and_payload_pin_drift_fail_before_send(self):
  raw=c.PROFILE.read_bytes()
  with patch.object(c,'read_file',return_value=raw+b' '):
   with self.assertRaisesRegex(c.Hold,'PROFILE_DRIFT'):c.profile()
  for wrong in (self.witness[:-1],self.witness[:-1]+b'X'):
   with self.assertRaisesRegex(c.Hold,'WITNESS_BYTES'):c.witness(wrong)
  self.assertEqual(c.SETUP_ORDER,['setup-roles','setup-database','setup-access','setup-local'])
  pin=c.profile()['sql_pins']['setup-roles.sql']
  with patch.object(c,'read_file',wraps=c.read_file) as read:
   c.payload('setup-roles',self.witness)
   self.assertIn(((c.DIRECTORY/'setup-roles.sql',pin),{}),[(x.args,x.kwargs) for x in read.call_args_list])

 def test_21_receipt_failure_cannot_skip_owned_cleanup_or_replace_primary(self):
  with tempfile.TemporaryDirectory() as out:
   lane=object.__new__(runner.Core12OrdinaryLane)
   lane.out=Path(out);lane.run='unit';lane.attempt='unit';lane.request_sha256='a'*64;lane.core_admitted='unit'
   lane.core_connections=[];lane.owned=[];lane.images=[]
   lane.r={'core12':{'rollback':{'state':'not_observed'},'residue':'UNKNOWN'},
    'consumer':{'status':'NOT_RUN'},'cleanup':[],'health_result':'NOT_RUN'}
   lane.assert_source=lambda:None
   def fail_command(*args,**kwargs):raise RuntimeError('UNIT_FIRST_COMMAND_ERROR')
   def fail_persist():raise OSError('UNIT_RECEIPT_UNAVAILABLE')
   lane.cmd=fail_command;lane.persist=fail_persist
   with patch.object(lane,'cleanup') as cleanup:
    with self.assertRaisesRegex(OSError,'UNIT_RECEIPT_UNAVAILABLE'):lane.execute()
    cleanup.assert_called_once()
   self.assertEqual(lane.r['primary_error'],'UNIT_FIRST_COMMAND_ERROR')
   self.assertNotEqual(lane.r['overall_result'],'PASSED')
   self.assertIn('UNIT_RECEIPT_UNAVAILABLE',lane.r['receipt_errors'])

 def test_22_close_and_error_receipt_failures_still_reach_cleanup(self):
  with tempfile.TemporaryDirectory() as out:
   lane=object.__new__(runner.Core12OrdinaryLane)
   lane.out=Path(out);lane.run='unit';lane.attempt='unit';lane.request_sha256='a'*64;lane.core_admitted='unit'
   def fail_close():raise RuntimeError('UNIT_CLOSE_ERROR')
   lane.core_connections=[NS(log=NS(closed=False),close=fail_close)];lane.owned=[];lane.images=[]
   lane.r={'core12':{'rollback':{'state':'not_observed'},'residue':'UNKNOWN'},'consumer':{'status':'NOT_RUN'},'cleanup':[]}
   lane.assert_source=lambda:None
   def fail_command(*a,**k):raise RuntimeError('UNIT_PRIMARY')
   def fail_persist():raise OSError('UNIT_RECEIPT_FAILURE')
   lane.cmd=fail_command;lane.persist=fail_persist
   with patch.object(lane,'cleanup') as cleanup:
    with self.assertRaisesRegex(OSError,'UNIT_RECEIPT_FAILURE'):lane.execute()
    cleanup.assert_called_once()
   self.assertEqual(lane.r['primary_error'],'UNIT_PRIMARY')
   self.assertIn('UNIT_CLOSE_ERROR',lane.r['connection_close_errors'])

if __name__=='__main__':unittest.main()
