#!/usr/bin/env python3
"""Fixed Core12 consumer in the existing PurePGLane. Registry EMPTY => no effects."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('core12_ordinary_contract',HERE/'core12_ordinary_contract.py')
c=sys.modules.get(spec.name)
if c is None:
 c=importlib.util.module_from_spec(spec);sys.modules[spec.name]=c;spec.loader.exec_module(c)
w=c.load_module('core12_ordinary_wire',HERE/'core12_ordinary_wire.py');old=c.legacy()

def validate_profile(p):
 c.need(p==c.profile(),'CORE12_PROFILE_BINDING')
 before=dict(p);before['profile']='runtime-pg-only-acl02-v1'
 old.validate(before)  # Same isolation/image checks, unchanged default profile.

class Core12OrdinaryLane(old.PurePGLane):
 profile_path=c.PROFILE
 validate_profile=staticmethod(validate_profile)

 @staticmethod
 def binding():return {'runner_sha256':c.source_seal()['sha256'],'profile_sha256':c.PROFILE_SHA}

 def __init__(self,out,raw,witness_bytes):
  c.witness(witness_bytes);admitted=c.admit(raw,out)  # before directory, Docker, roles or connections
  self.core_raw=raw;self.core_admitted=admitted;self.core_seal=c.source_seal();self._recovery_check=False
  self.core_connections=[]
  super().__init__(out,raw=None)
  self.witness_bytes=witness_bytes;self.request_sha256=c.sha(raw);self.cid=None
  self.r['consumer']={'status':'NOT_RUN','planned_calls':176,'executed_calls':None,'native_authorization':'NOT_PROVED'}
  self.r['core12']={'request_sha256':self.request_sha256,'source_commit':c.SOURCE,'witness_sha256':c.WITNESS_SHA,
   'source_seal':self.core_seal,'actual_target':None,'actual_executor':None,'actual_observer':None,
   'baseline':'NOT_RUN','rollback':{'state':'not_observed'},'residue':'UNKNOWN'}
  w.register_live_owner(self)
  self.save()

 def assert_source(self):
  c.need(c.source_seal()==self.core_seal and self.core_raw==c.request_bytes(),'CORE12_SOURCE_CHANGED_AT_EFFECT')
  if not self._recovery_check:c.need(c.admit(self.core_raw,self.out)==self.core_admitted,'CORE12_AUTHORITY_CHANGED_AT_EFFECT')

 def gate(self,recovery=False):
  w.require_registered(self)
  self._recovery_check=recovery
  try:
   self.assert_source()
   c.need(self.cid is not None and len(self.owned)==1 and self.owned[0]['cid']==self.cid,'CORE12_EXCLUSIVE_CID_CUSTODY')
   self.assert_target()  # Existing live Docker config/label/name/CID check.
  finally:self._recovery_check=False

 def persist(self):self.save()
 def track_wire(self,wire):self.core_connections.append(wire)
 def note_close_error(self,error):self.r.setdefault('connection_close_errors',[]).append(error)
 def fail(self,error):
  if not self.r.get('primary_error'):self.r['primary_error']=str(error)
  self.r['consumer']['status']='FAILED_OR_UNKNOWN'
  try:self.persist()
  except Exception as persistence:
   # A failed error receipt cannot suppress the next bounded close/cleanup.
   # The final persistence still fails closed; no successful ACK is invented.
   self.r.setdefault('receipt_errors',[]).append(str(persistence))

 def execute(self):
  self.assert_source()
  with (self.out/'core12-attempt.claim').open('xb') as f:
   os.chmod(f.name,0o600);f.write(c.canonical({'run':self.run,'attempt':self.attempt,'request':self.request_sha256,'grant':self.core_admitted}));f.flush();os.fsync(f.fileno())
  custodian=local=executor=observer=None;all_connections=self.core_connections;baseline=None;observed_system=None
  core=self.r['core12']
  try:
   try:
    self.cmd('docker-info',['info','--format','{{.ServerVersion}}'])
    self.assert_source();self.image('pg');self.assert_source();self.cid=self.create('pg',self.pg_tail());w.bind_owned_cid(self)
    self.cmd('pg-health',['exec',self.cid,'sh','-ec','i=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'],65)
    self.cmd('network-proof',['exec',self.cid,'sh','-ec','test "$(ls /sys/class/net)" = lo; test "$(wc -l </proc/net/route)" -eq 1; test "$(id -u)" = 999; test "$(id -g)" = 999'])
    custodian=w.Core12Wire(self,'custodian-root','bootstrap',self.witness_bytes)
    health=w.custodian_identity(custodian);observed_system=health['system_identifier']
    c.need(health['target_database_oid'] is None and health['sessions']==[],'CORE12_TARGET_ALREADY_POPULATED')
    self.r['health_result']='PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL';self.persist()
    for operation in c.SETUP_ORDER[:3]:
     custodian.fixed(operation);core.setdefault('setup_ack',[]).append(operation);self.persist()
    local=w.Core12Wire(self,'custodian-target','setup-local',self.witness_bytes)
    local.fixed('setup-local');local.close();local=None;core['setup_ack'].append('setup-local');self.persist()
    executor=w.Core12Wire(self,'executor','executor',self.witness_bytes)
    ordinary=w.ordinary_identity(executor)
    observer=w.Core12Wire(self,'observer','baseline',self.witness_bytes);w.ordinary_identity(observer)
    bound=w.correlate(custodian,[executor,observer]);c.need(all(x['system_identifier']==observed_system for x in bound),'CORE12_SERVER_CHANGED')
    core['actual_target']={'cid':self.cid,'database':ordinary['database'],'database_oid':ordinary['database_oid'],'system_identifier':observed_system}
    core['actual_executor']={**ordinary,'system_identity_binding':bound[0]}
    baseline,baseline_row=w.baseline(observer);core['baseline']=baseline_row;self.persist()  # independent BEFORE witness, durable first
    observer.close();observer=None
    result=executor.fixed('witness')
    core['witness_terminal']=result;core['rollback']={'state':'acknowledged','pid':executor.pid,'connection_id':executor.connection_id,
     'wire_chain':result['chain'],'journal_chain':result['core12']['journal_chain']};core['witness']='COMPLETED_EXTRACTED_BOUNDARIES_ONLY';self.persist()
   except Exception as error:
    self.fail(error)
    if executor is not None and core['rollback']['state']!='acknowledged':
     try:core['rollback']=executor.recover()
     except Exception as settlement:core['rollback']={'state':'unknown','error':str(settlement)}
     self.persist()
   # Scoped recovery observation is allowed only after actual same-stream ACK;
   # it is not authority to continue a witness or create another fixture.
   try:
    if core['rollback']['state']=='acknowledged' and baseline is not None and custodian is not None and executor is not None:
     observer=w.Core12Wire(self,'observer','observer',self.witness_bytes,recovery=True)
     w.ordinary_identity(observer)
     custodian.recovery=True
     bound=w.correlate(custodian,[executor,observer]);c.need(all(x['system_identifier']==observed_system for x in bound),'CORE12_SERVER_CHANGED')
     c.need(observer.pid!=executor.pid,'CORE12_OBSERVER_NOT_INDEPENDENT')
     after=w.snapshot(observer);baseline.compare(observer,after)
     core['actual_observer']={'pid':observer.pid,'connection_id':observer.connection_id,'system_identity_binding':bound[1]}
     core['observer_snapshot']=after;core['residue']='ZERO_OBSERVED';self.persist()
    else:core['observer']='NOT_RUN_ROLLBACK_OR_BASELINE_UNPROVED'
   except Exception as error:
    core['observer']='FAILED_OR_UNKNOWN';core['residue']='UNKNOWN';self.fail(error)
  finally:
   # Close every created relay independently, then inherited owned-resource cleanup.
   seen=set()
   for connection in reversed(all_connections):
    if id(connection) in seen:continue
    seen.add(id(connection))
    try:
     if connection.log is None or not connection.log.closed:connection.close()
    except Exception as error:self.r.setdefault('connection_close_errors',[]).append(str(error));self.fail(error)
   if not self.r.get('primary_error') and core['residue']=='ZERO_OBSERVED':self.r['consumer']['status']='PASSED'
   else:self.r['consumer']['status']='FAILED_OR_UNKNOWN'
   try:self.cleanup()
   except Exception as error:
    self.r.setdefault('cleanup_errors',[]).append(str(error));self.fail(error)
   old.base.finalize_lifecycle(self.r,self.owned,self.images,pg_only=True)
   self.r['ended_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());self.persist()
  return self.r

w.register_owner(Core12OrdinaryLane)

def main(argv=None):
 parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False)
 modes=parser.add_mutually_exclusive_group(required=True)
 modes.add_argument('--inspect-request',action='store_true')
 modes.add_argument('--run-directory')
 parser.add_argument('--witness-source')
 args=parser.parse_args(argv)
 raw=c.REQUEST.read_bytes();c.need(raw==c.request_bytes(),'CORE12_EXACT_REQUEST')
 if args.inspect_request:
  c.need(args.witness_source is None,'CORE12_INSPECT_EXTRA_INPUT')
  print(json.dumps({'status':'SOURCE_INSPECTION_ONLY','request_sha256':c.sha(raw),'registry':'EMPTY','live':'HOLD','native':'NOT_RUN_NOT_PASS'}));return 0
 c.need(args.witness_source is not None,'CORE12_EXACT_WITNESS_SOURCE_REQUIRED')
 source=c.read_file(Path(args.witness_source));c.witness(source)
 lane=Core12OrdinaryLane(args.run_directory,raw,source)  # EMPTY registry stops here, before allocation.
 result=lane.execute()
 print(json.dumps({'overall_result':result['overall_result'],'cleanup':result['cleanup_completeness'],'consumer':result['consumer']['status']}))
 return result['exit_code']

if __name__=='__main__':
 try:sys.exit(main())
 except c.Hold as error:print(json.dumps({'status':'HOLD','reason':str(error)}));sys.exit(2)
