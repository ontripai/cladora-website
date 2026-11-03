"""Closed Core12 specialization of the EXISTING PG reader/writer, not a new transport."""
import json
import os
import struct
import time
import uuid
import re
import select
import weakref
from dataclasses import dataclass
from pathlib import Path
import core12_ordinary_contract as c

legacy=c.legacy(); BaseWire=legacy.Wire; WireError=__import__('acl02_pg_wire').WireError
OWNER_TYPE=None
_OWNERS=weakref.WeakKeyDictionary()

def register_owner(cls):
 global OWNER_TYPE
 c.need(cls.__name__=='Core12OrdinaryLane' and issubclass(cls,legacy.PurePGLane)
  and (OWNER_TYPE is None or OWNER_TYPE is cls),'CORE12_OWNER_REGISTRATION')
 OWNER_TYPE=cls

def require_owner(lane,recovery):
 c.need(OWNER_TYPE is not None and type(lane) is OWNER_TYPE,'CORE12_TYPED_LANE_REQUIRED')
 require_registered(lane)
 c.need(not lane.r.get('ended_utc'),'CORE12_ENDED_LANE')
 lane.gate(recovery=recovery)

def register_live_owner(lane):
 c.need(type(lane) is OWNER_TYPE and lane not in _OWNERS,'CORE12_OWNER_ALREADY_REGISTERED')
 c.need(c.admit(lane.core_raw,lane.out)==lane.core_admitted,'CORE12_INITIAL_OWNER_GRANT')
 _OWNERS[lane]={'grant':lane.core_admitted,'request':lane.request_sha256,'run':lane.run,'attempt':lane.attempt,
  'source_seal':lane.core_seal['sha256'],'out':str(lane.out),'cid':None}

def bind_owned_cid(lane):
 entry=_OWNERS.get(lane);c.need(entry is not None and entry['cid'] is None,'CORE12_CID_BINDING_STATE')
 lane.assert_target()  # current real owned container inspection, not request data
 c.need(len(lane.owned)==1 and lane.cid==lane.owned[0]['cid'],'CORE12_CID_BINDING_CUSTODY')
 entry['cid']=lane.cid

def require_registered(lane):
 entry=_OWNERS.get(lane);c.need(entry is not None,'CORE12_NO_INITIAL_OWNED_GRANT')
 c.need(entry['grant']==lane.core_admitted and entry['request']==lane.request_sha256 and entry['run']==lane.run
  and entry['attempt']==lane.attempt and entry['source_seal']==lane.core_seal['sha256'] and entry['out']==str(lane.out)
  and entry['cid'] is not None and entry['cid']==lane.cid,'CORE12_OWNER_BINDING_DRIFT')

def startup(actor,application):
 p=c.profile();c.need(actor in p['actors'],'CORE12_STARTUP_ACTOR')
 c.need(re.fullmatch(r'core12:'+re.escape(actor)+r':[a-f0-9]{32}',application) and len(application.encode())<64,'CORE12_APPLICATION_SELECTOR')
 a=p['actors'][actor]
 params=b'user\0'+a['user'].encode()+b'\0database\0'+a['database'].encode()+b'\0application_name\0'+application.encode()+b'\0'
 if a['options']:params+=b'options\0'+a['options'].encode()+b'\0'
 params+=b'\0';return struct.pack('!II',len(params)+8,196608)+params

class Core12Wire(BaseWire):
 def __init__(self,lane,actor,phase,witness_bytes,recovery=False):
  c.need(actor in c.profile()['actors'] and phase in ('bootstrap','setup-local','executor','baseline','observer'),'CORE12_CONNECTION_SELECTOR')
  c.need(phase in {'custodian-root':('bootstrap',),'custodian-target':('setup-local',),'executor':('executor',),'observer':('baseline','observer')}[actor],'CORE12_ACTOR_PHASE')
  c.need(not recovery or actor in ('custodian-root','observer'),'CORE12_RECOVERY_ACTOR')
  c.witness(witness_bytes)
  require_owner(lane,recovery)
  self.owner=lane;self.actor=actor;self.witness_bytes=witness_bytes;self.recovery=recovery
  self._starting=True;self.process=None;self.log=None;self._startup_cleanup_error=None
  self.connection_id=uuid.uuid4().hex;self._startup_done=False;self._pending=None;self._recovering=False
  self._stage='core12-'+phase+'-'+self.connection_id;self._legacy_application=lane.run+':'+lane.attempt+':'+self._stage
  self.application='core12:'+actor+':'+c.sha(c.canonical({'run':lane.run,'attempt':lane.attempt,'cid':lane.cid,'connection_id':self.connection_id,'actor':actor}))[:32]
  self._journal_seq=0;self._journal_chain='0'*64
  self._counts={}
  self._journal=open(Path(lane.out)/(self._stage+'.operations.private.jsonl'),'xb');os.chmod(self._journal.name,0o600)
  lane.track_wire(self)
  try:
   self.record('connection-planned',{'request_sha256':lane.request_sha256,'source_seal':lane.core_seal['sha256'],'actor':actor})
   super().__init__(lane.cid,lane.run,lane.attempt,self._stage,lane.out,legacy.base.DOCKER,legacy.base.environment(),self.effect)
   self.record('startup-ack',{'pid':self.pid,'ready':self.idle,'wire_chain':self.chain})
   self._starting=False
  except Exception:
   self._starting=False
   if self._startup_cleanup_error:lane.note_close_error(self._startup_cleanup_error)
   self._journal.close();raise

 def effect(self):self.owner.gate(recovery=self.recovery or self._recovering)
 def record(self,event,detail):
  self._journal_seq+=1
  entry={'event':event,'detail':detail,'connection_id':self.connection_id,'request_sha256':self.owner.request_sha256,
   'run_id':self.owner.run,'attempt':self.owner.attempt,'cid':self.owner.cid,'sequence':self._journal_seq,'previous':self._journal_chain}
  raw=c.canonical(entry);self._journal_chain=c.sha(raw)
  data=raw+b'\n';c.need(self._journal.write(data)==len(data),'UNKNOWN_CORE12_JOURNAL_SHORT_WRITE');self._journal.flush();os.fsync(self._journal.fileno())

 def send(self,raw):
  self.effect()
  if not self._startup_done:
   old=b'user\0postgres\0database\0postgres\0application_name\0'+self._legacy_application.encode()+b'\0\0'
   c.need(raw==struct.pack('!II',len(old)+8,196608)+old,'CORE12_UNEXPECTED_LEGACY_STARTUP')
   raw=startup(self.actor,self.application);self._startup_done=True
   self.record('startup-dispatch',{'actor':self.actor,'bytes':len(raw),'sha256':c.sha(raw)})
  else:c.need(self._pending is not None and raw==self._pending['frame'],'CORE12_UNAPPROVED_SEND')
  # Same physical stdin and bounded writer algorithm; recheck custody/authority
  # after each wait and immediately before EACH partial write. One logical frame.
  c.need(len(raw)<=__import__('acl02_pg_wire').MAX_BYTES,'CORE12_SEND_BOUND')
  fd=self.process.stdin.fileno();os.set_blocking(fd,False);view=memoryview(raw)
  try:
   while view:
    self.effect();remain=self.deadline-time.monotonic()
    if remain<=0 or not select.select([],[fd],[],remain)[1]:raise WireError('UNKNOWN_WRITE_TIMEOUT')
    self.effect()
    try:
     n=os.write(fd,view)
     if n<=0:raise WireError('UNKNOWN_SHORT_WRITE')
     view=view[n:]
    except BlockingIOError:continue
   self.effect()
  except Exception:self.quarantined=True;raise

 def query(self,*args,**kwargs):raise c.Hold('CORE12_NO_ARBITRARY_QUERY_API')
 def identity(self,*args,**kwargs):raise c.Hold('CORE12_NO_POSTGRES_IDENTITY_FALLBACK')

 def fixed(self,operation):
  c.need(operation in c.OPERATIONS and self.actor in c.OPERATIONS[operation][1],'CORE12_OPERATION_ACTOR')
  c.need(not self.recovery or operation in ('identity','snapshot','custodian-info'),'CORE12_RECOVERY_OPERATION')
  c.need(self._counts.get(operation,0)<(3 if operation=='custodian-info' else 1),'CORE12_OPERATION_REPLAY')
  c.need(self._pending is None and not self.quarantined and self.idle=='I','UNKNOWN_CORE12_CONNECTION_NOT_IDLE')
  self._counts[operation]=self._counts.get(operation,0)+1  # consumed even on unknown dispatch/ACK
  self.effect();payload=c.payload(operation,self.witness_bytes);frame=b'Q'+struct.pack('!I',len(payload)+5)+payload+b'\0'
  if operation=='witness':c.need(len(frame)==20750 and frame[5:-1]==self.witness_bytes,'CORE12_WITNESS_FRAME')
  self._pending={'operation':operation,'frame':frame,'payload_sha256':c.sha(payload)}
  try:
   self.record('dispatch',{'operation':operation,'payload_sha256':c.sha(payload),'frame_sha256':c.sha(frame),'frame_bytes':len(frame),'pid':self.pid})
   seconds=c.profile()['deadlines_seconds']['observer' if self.actor=='observer' else 'witness']
   result=BaseWire.query(self,payload,self.effect,seconds)
   self.effect()
   if result['errors']:raise WireError('CORE12_SQL_ERROR:'+result['errors'][0])
   c.need(result['ready']=='I' and result['pid']==self.pid and result['tags'] and result['tags'][-1]==c.OPERATIONS[operation][2],'UNKNOWN_CORE12_TERMINAL')
   if operation=='witness':c.need(result['tags'][-2:]==['DO','ROLLBACK'] and result['rows']==[],'UNKNOWN_CORE12_ORACLE_ACK')
   self.record('terminal',{'operation':operation,'pid':self.pid,'wire_chain':result['chain'],'tags':result['tags'],'ready':result['ready']})
   result['core12']={'operation':operation,'request_sha256':self.owner.request_sha256,'connection_id':self.connection_id,
    'payload_sha256':c.sha(payload),'frame_sha256':c.sha(frame),'journal_chain':self._journal_chain,'fsync_ack':True,'cid':self.owner.cid}
   return result
  finally:self._pending=None

 def recover(self):
  if self.quarantined or self.idle not in ('T','E'):return {'state':'skipped','reason':'no_known_same_stream_open_transaction'}
  self._recovering=True;self._pending={'frame':b'Q'+struct.pack('!I',14)+b'ROLLBACK;\0'}
  try:
   self.effect();r=BaseWire.rollback_known(self)
   if r['state']=='acknowledged':self.record('recovery-rollback-ack',{'pid':self.pid,'wire_chain':self.chain})
   return r
  finally:self._pending=None;self._recovering=False

 def close(self):
  primary=None
  try:
   if self.log is not None and self.log.closed:return
   # A known complete stream can receive frontend Terminate, never an invented
   # rollback ACK. This also lets the existing relay reader reach real EOF.
   if self.process is not None and not self.quarantined and self.idle in ('I','T','E'):
    self._recovering=True;self._pending={'frame':b'X'+struct.pack('!I',4)}
    try:self.deadline=time.monotonic()+2;self.send(self._pending['frame'])
    except Exception as error:primary=error
    finally:self._pending=None;self._recovering=False
   try:
    if self.log is not None:super().close()
    if self.process is not None:c.need(self.process.returncode==0,'UNKNOWN_CORE12_RELAY_CLOSE')
   except Exception as error:primary=primary or error
  finally:
   if hasattr(self,'_journal') and not self._journal.closed:self._journal.close()
  if primary:
   if self._starting:self._startup_cleanup_error=str(primary)
   else:raise primary

def one_row(connection,result,stage):
 c.need(result['pid']==connection.pid and not result['errors'] and result['ready']=='I' and len(result['rows'])==1,'UNKNOWN_CORE12_ROW_TERMINAL')
 row=result['rows'][0];c.need(row.get('stage')==stage and row.get('pid')==connection.pid,'UNKNOWN_CORE12_ROW_IDENTITY');return row

def ordinary_identity(connection):
 row=one_row(connection,connection.fixed('identity'),'CORE12_ORDINARY_IDENTITY_V1')
 p=c.profile()['actors'][connection.actor]
 c.need(row['database']==p['database'] and row['user']==p['user'] and row['session_user']==p['user'] and 170000<=row['version']<180000,'CORE12_FOREIGN_ORDINARY_TARGET')
 c.need(all(row[k] is False for k in ('rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication')),'CORE12_PRIVILEGED_EXECUTOR')
 c.need(row['connect'] is True and row['memberships']==0 and row['function_defaults']==0 and row['forbidden_schemas']==0,'CORE12_ROLE_PREREQUISITE')
 c.need(row['temp'] is (connection.actor=='executor') and row['read_only'] is (connection.actor=='observer'),'CORE12_ACTOR_PRIVILEGE_OR_READONLY')
 if connection.actor=='executor':c.need(row['plpgsql'] is True and row['guard_latch']=='core12-boundary-v1','CORE12_GUARD_LATCH')
 else:c.need(row['guard_latch'] is None,'CORE12_OBSERVER_LATCH_UNEXPECTED')
 connection.observed_identity=row;return row

def custodian_identity(connection):
 row=one_row(connection,connection.fixed('custodian-info'),'CORE12_CUSTODIAN_IDENTITY_V1')
 c.need(row['database']=='postgres' and row['user']=='postgres' and row['session_user']=='postgres'
  and 170000<=row['version']<180000 and isinstance(row['system_identifier'],str) and row['system_identifier'].isdigit(),'CORE12_CUSTODIAN_IDENTITY')
 return row

def correlate(custodian,ordinary):
 observed=custodian_identity(custodian)
 c.need(isinstance(observed['target_database_oid'],str) and observed['target_database_oid'].isdigit(),'CORE12_TARGET_DB_OID')
 sessions=observed['sessions'];c.need(len(sessions)==len(ordinary),'CORE12_FOREIGN_OR_PARTIAL_SESSIONS')
 used=set();bound=[]
 for wire in ordinary:
  row=wire.observed_identity
  matches=[s for s in sessions if s['pid']==wire.pid and s['database_oid']==row['database_oid']
   and s['user']==row['user'] and s['application_name']==wire.application and s['backend_type']=='client backend'
   and s['client_addr']=='127.0.0.1' and isinstance(s['backend_start'],str) and bool(s['backend_start'])]
  c.need(len(matches)==1 and wire.pid not in used and row['database_oid']==observed['target_database_oid']
   and row['version']==observed['version'] and wire.cid==custodian.cid,'CORE12_CUSTODIAN_SESSION_MISMATCH')
  used.add(wire.pid);bound.append({'pid':wire.pid,'database_oid':row['database_oid'],'system_identifier':observed['system_identifier'],
   'system_identifier_source':'custodian-correlated-same-CID','backend_start':matches[0]['backend_start'],'connection_id':wire.connection_id})
 return bound

def snapshot(observer):
 row=one_row(observer,observer.fixed('snapshot'),'CORE12_CATALOG_SNAPSHOT_V1')
 ident=observer.observed_identity
 c.need(row['database']==ident['database'] and row['database_oid']==ident['database_oid'] and row['user']==ident['user']
  and row['session_user']==ident['session_user'] and row['version']==ident['version'] and row['read_only'] is True,'CORE12_SNAPSHOT_IDENTITY')
 c.need(row['snapshot_complete'] is True and isinstance(row['protected_sha256'],str) and len(row['protected_sha256'])==64
  and all(x in '0123456789abcdef' for x in row['protected_sha256']),'UNKNOWN_CORE12_PARTIAL_SNAPSHOT')
 c.need(type(row['witness_functions_remaining']) is int and row['witness_functions_remaining']==0
  and type(row['matrix_remaining']) is int and row['matrix_remaining']==0 and row['forbidden_schemas']==0,'CORE12_NONZERO_RESIDUE')
 return row

@dataclass(frozen=True)
class Baseline:
 protected_sha256:str
 database_oid:str
 version:int
 cid:str
 connection_id:str

 def compare(self,observer,after):
  c.need(observer.cid==self.cid and after['database_oid']==self.database_oid and after['version']==self.version,'CORE12_FOREIGN_BASELINE')
  c.need(after['protected_sha256']==self.protected_sha256,'CORE12_PROTECTED_CATALOG_DRIFT')

def baseline(observer):
 row=snapshot(observer)
 return Baseline(row['protected_sha256'],row['database_oid'],row['version'],observer.cid,observer.connection_id),row
