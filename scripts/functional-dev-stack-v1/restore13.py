#!/usr/bin/env python3
"""One fixed accepted-backup restore in an owned network-none sandbox. No target/SQL input."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tarfile
import io
import time
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('restore13_stack',HERE/'stack.py')
stack=importlib.util.module_from_spec(spec);spec.loader.exec_module(stack)
ROOT=Path('/workspace/private/platform-dev-backup-restore-13')
BACKUP=stack.PRIVATE/'backup-1793703253756974783'
RECEIPT_SHA='d784ee048bdb98950fbd138a2f017d11914c8283171e7ade0975993222ed8b0e'
IMAGE=stack.PROFILE['images']['pg']
IMAGE_ID='sha256:99445113a4a19e82dd3713c65bd9f6fb5bf972065ab043df8d1e1c93e957da9a'
PARENT='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
def need(ok,reason):
 if not ok:raise RuntimeError(reason)
def sha(b):return hashlib.sha256(b).hexdigest()
def read(path):
 need(path.is_absolute() and path.resolve()==path and path.is_file() and not path.is_symlink() and path.stat().st_nlink==1,'INPUT_CUSTODY')
 return path.read_bytes()
def normalize_dump(raw):
 lines=raw.decode().splitlines()
 # Only pg_dump/restore envelope and random psql restrict key; no object SQL edits.
 out=[]
 for line in lines:
  if re.fullmatch(r'\\(?:un)?restrict [A-Za-z0-9]+',line):continue
  if re.fullmatch(r'-- (?:PostgreSQL database (?:cluster )?dump(?: complete)?|Dumped (?:from database|by pg_dump) version .+)',line):continue
  out.append(line)
 return '\n'.join(out).strip()
def schema_objects(raw):
 text=normalize_dump(raw);pieces=re.split(r'(?m)^(-- Name: .+; Type: .+; Schema: .+; Owner: .*\n)',text)
 need(len(pieces)>1,'SCHEMA_REFERENCE_FORMAT');objects={'__preamble__':pieces[0].strip()}
 for i in range(1,len(pieces),2):
  key=pieces[i].strip();need(key not in objects,'DUPLICATE_SCHEMA_ADDRESS');objects[key]=pieces[i+1].strip()
 return objects
def data_rows(raw):
 lines=normalize_dump(raw).splitlines();result={};sequence=[];i=0
 while i<len(lines):
  line=lines[i]
  if line.startswith('COPY '):
   need(re.fullmatch(r'COPY [a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]* \([a-z0-9_, ]+\) FROM stdin;',line),'COPY_REFERENCE_FORMAT')
   need(line not in result,'DUPLICATE_COPY');i+=1;rows=[]
   while i<len(lines) and lines[i]!='\\.':rows.append(lines[i]);i+=1
   need(i<len(lines),'COPY_TERMINAL_MISSING');result[line]=sorted(rows)
  elif line.startswith('SELECT pg_catalog.setval('):sequence.append(line)
  i+=1
 need(result,'EMPTY_DATA_REFERENCE');return {'tables':result,'sequence':sorted(sequence)}
def tar_snapshot(raw):
 result={}
 with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
  for item in archive.getmembers():
   need(not item.name.startswith('/') and '..' not in Path(item.name).parts and (item.isfile() or item.isdir()),'UNSAFE_STORAGE_ARCHIVE')
   name=item.name.removeprefix('./').rstrip('/') or '.';need(name not in result,'DUPLICATE_STORAGE_ADDRESS')
   data=archive.extractfile(item).read() if item.isfile() else b''
   result[name]={'type':'file' if item.isfile() else 'directory','uid':item.uid,'gid':item.gid,'mode':item.mode,'mtime':item.mtime,'bytes':item.size,'sha256':sha(data)}
 return result
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def validate_inputs():
 secret,descriptor=stack.state()
 manifest=json.loads(read(HERE.parents[1]/'docs/testing/functional-dev-stack-12.manifest.json'))
 need(stack.source_seal()==manifest['source_seal']['files'],'SEALED_FIVE_DRIFT')
 raw=read(BACKUP/'receipt.json');need(sha(raw)==RECEIPT_SHA,'BACKUP_RECEIPT_DRIFT');r=json.loads(raw)
 need(r['state']=='ACKNOWLEDGED' and set(r['files'])=={'database.dump','globals.sql','storage.tar','helper.json'},'BACKUP_RECEIPT_SCOPE')
 for name,pin in r['files'].items():
  b=read(BACKUP/name);need(len(b)==pin['bytes'] and sha(b)==pin['sha256'],'BACKUP_BYTES_DRIFT:'+name)
 tar_snapshot(read(BACKUP/'storage.tar'))
 need(read(BACKUP/'globals.sql').count(b'CREATE ROLE postgres;')==1,'POSTGRES_BOOTSTRAP_COLLISION_FORMAT')
 return secret,descriptor,r

class Restore:
 def __init__(self):
  self.secret,self.original,self.backup=validate_inputs();self.helper_sha=sha(read(Path(__file__).resolve()));self.seal=stack.source_seal()
  ROOT.mkdir(mode=0o700,exist_ok=True);need(ROOT.resolve()==ROOT and ROOT.stat().st_mode&0o077==0,'RESTORE_PRIVATE_CUSTODY')
  self.run='cladora-restore13-'+uuid.uuid4().hex[:12];self.out=ROOT/self.run;self.out.mkdir(mode=0o700)
  with (ROOT/'attempt.claim').open('xb') as f:f.write(self.run.encode());f.flush();os.fsync(f.fileno())
  self.containers=[];self.volumes=[];self.pg=None
  self.r={'task':'PLATFORM-DEV-BACKUP-RESTORE-13','run':self.run,'source_sha256':self.helper_sha,'sealed_five':self.seal,
   'backup_receipt_sha256':RECEIPT_SHA,'stages':{},'restore':'NOT_RUN','restart':'NOT_RUN','cleanup':[],
   'primary_error':None,'storage_document_recovery':'NOT_PROVED_EMPTY_ARCHIVE','scanner':'NOT_RUN','domain_runtime':'NOT_RUN'};self.save()
 def save(self):stack.write(self.out/'receipt.json',self.r)
 def source(self):
  need(sha(read(Path(__file__).resolve()))==self.helper_sha and stack.source_seal()==self.seal,'SOURCE_CHANGED_AT_EFFECT');validate_inputs()
 def cmd(self,stage,args,data=None,timeout=40,extra=None):
  self.source();self.r['stages'][stage]={'state':'DISPATCHED','input_bytes':len(data or b''),'input_sha256':sha(data or b'')};self.save()
  e=stack.env();e.update(extra or {})
  try:p=subprocess.run(stack.DOCKER+args,input=data,env=e,capture_output=True,timeout=timeout)
  except subprocess.TimeoutExpired:self.r['stages'][stage]['state']='UNKNOWN_TIMEOUT';self.save();raise RuntimeError(stage+':UNKNOWN_TIMEOUT_NO_RETRY')
  stack.write(self.out/(stage+'.stdout.private'),p.stdout);stack.write(self.out/(stage+'.stderr.private'),p.stderr)
  self.r['stages'][stage].update(state='ACKNOWLEDGED' if p.returncode==0 else 'FAILED',exit_code=p.returncode,stdout_sha256=sha(p.stdout),stderr_sha256=sha(p.stderr));self.save()
  need(p.returncode==0,stage+':COMMAND_FAILED');return p.stdout
 def inspect(self,stage,cid):return json.loads(self.cmd(stage,['inspect',cid]))[0]
 def volume(self,suffix):
  name=self.run+'-'+suffix;names=self.cmd('names-'+suffix,['volume','ls','--format','{{.Name}}']).decode().splitlines();need(name not in names,'VOLUME_COLLISION')
  self.volumes.append(name);self.save();self.cmd('create-'+suffix,['volume','create','--label','cladora.restore13.run='+self.run,name]);return name
 def create(self,role,args):
  name=self.run+'-'+role;need(not self.cmd('name-'+role,['ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}']).strip(),'CONTAINER_COLLISION')
  entry={'name':name,'cid':None,'role':role};self.containers.append(entry);self.save()
  cid=self.cmd('create-'+role,['create','--pull=never','--name',name,'--label','cladora.restore13.run='+self.run,'--network=none','--read-only',
   '--cap-drop=ALL','--security-opt=no-new-privileges:true','--memory=768m','--cpus=0.5','--pids-limit=128']+args,
   extra={'POSTGRES_PASSWORD':self.new_password} if role=='pg' else None).decode().strip()
  need(len(cid)==64 and all(c in '0123456789abcdef' for c in cid),'CREATE_CID_UNKNOWN');entry['cid']=cid;self.save()
  c=self.inspect('prestart-'+role,cid);h=c['HostConfig']
  need(c['Id']==cid and c['Config']['Labels'].get('cladora.restore13.run')==self.run and h['NetworkMode']=='none'
   and h['ReadonlyRootfs'] and not h['Privileged'] and h['CapDrop']==['ALL'] and not h.get('PortBindings'),'TARGET_ISOLATION')
  allowed={self.run+'-pgdata',self.run+'-storage'}
  need(all(m['Type']=='tmpfs' or (m['Type']=='volume' and m['Name'] in allowed) for m in c['Mounts']),'FOREIGN_MOUNT');return cid
 def sql(self,stage,query,user='postgres'):
  need(self.pg is not None,'NO_RESTORE_TARGET')
  # Sole PG target is the CID created above. No caller SQL, DSN or target argument.
  return self.cmd(stage,['exec','-i','--user','999:999','-e','PGPASSWORD',self.pg,'psql']+(['-h','127.0.0.1'] if user=='authenticator' else [])+['-U',user,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],query,60,{'PGPASSWORD':self.secret['rest_password']} if user=='authenticator' else {'PGPASSWORD':''})
 def original_snapshot(self,stage):
  ids=self.cmd(stage+'-id',['ps','--no-trunc','-aq','--filter','label=cladora.dev.owner='+stack.PROJECT,'--filter','label=com.docker.compose.service=pg']).decode().strip();need(len(ids)==64,'ORIGINAL_CUSTODY')
  c=self.inspect(stage+'-inspect',ids);need(c['State']['Running'] and c['Config']['Image']==IMAGE,'ORIGINAL_IDENTITY')
  value=self.cmd(stage+'-readonly',['exec',ids,'psql','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1','-c',
   "SELECT json_build_object('system',(SELECT system_identifier::text FROM pg_control_system()),'note', (SELECT md5(string_agg(row_to_json(n)::text,'' ORDER BY id)) FROM platform_dev.notes n));"])
  return {'cid':ids,'volumes':sorted(m['Name'] for m in c['Mounts'] if m['Type']=='volume'),'observed':json.loads(value)}
 def compare(self,label,reference,actual):
  self.r.setdefault('comparisons',{})[label]={'reference_sha256':digest(reference),'actual_sha256':digest(actual),'match':reference==actual};self.save();need(reference==actual,'RESTORE_MISMATCH:'+label)
 def snapshot(self,phase):
  schema=self.cmd(phase+'-schema',['exec',self.pg,'pg_dump','-U','postgres','-d','postgres','--schema-only'])
  data=self.cmd(phase+'-data',['exec',self.pg,'pg_dump','-U','postgres','-d','postgres','--data-only'])
  glob=self.cmd(phase+'-globals',['exec',self.pg,'pg_dumpall','-U','postgres','--globals-only'])
  self.compare(phase+'-schema',self.expected_schema,schema_objects(schema));self.compare(phase+'-data',self.expected_data,data_rows(data));self.compare(phase+'-globals',normalize_dump(self.globals),normalize_dump(glob))
 def cleanup(self):
  # Each own cleanup has an independent deadline; preserve primary error.
  for e in reversed(self.containers):
   try:
    rows=self.cmd('cleanup-find-'+e['role'],['ps','--no-trunc','-aq','--filter','name=^/'+e['name']+'$']).decode().splitlines()
    if rows:
     need(len(rows)==1,'CLEANUP_AMBIGUOUS_CID');c=self.inspect('cleanup-inspect-'+e['role'],rows[0]);need(c['Config']['Labels'].get('cladora.restore13.run')==self.run and (e['cid'] is None or rows[0]==e['cid']),'CLEANUP_FOREIGN_RESOURCE')
     self.cmd('cleanup-rm-'+e['role'],['rm','-fv',rows[0]],timeout=20)
    need(not self.cmd('cleanup-absent-'+e['role'],['ps','-aq','--filter','name=^/'+e['name']+'$']).strip(),'CLEANUP_CONTAINER_UNKNOWN')
    self.r['cleanup'].append({'kind':'container','role':e['role'],'state':'ACKNOWLEDGED_ABSENT'})
   except Exception as error:self.r['cleanup'].append({'kind':'container','role':e['role'],'state':'FAILED_OR_UNKNOWN','error':str(error)})
  for name in reversed(self.volumes):
   try:
    names=self.cmd('cleanup-volume-list-'+name,['volume','ls','--format','{{.Name}}']).decode().splitlines()
    if name in names:
     v=json.loads(self.cmd('cleanup-volume-inspect-'+name,['volume','inspect',name]))[0];need(v['Labels'].get('cladora.restore13.run')==self.run,'CLEANUP_FOREIGN_VOLUME')
     need(not self.cmd('cleanup-volume-users-'+name,['ps','-aq','--filter','volume='+name]).strip(),'CLEANUP_VOLUME_IN_USE')
     self.cmd('cleanup-volume-rm-'+name,['volume','rm',name],timeout=20)
    need(name not in self.cmd('cleanup-volume-absent-'+name,['volume','ls','--format','{{.Name}}']).decode().splitlines(),'CLEANUP_VOLUME_UNKNOWN')
    self.r['cleanup'].append({'kind':'volume','state':'ACKNOWLEDGED_ABSENT'})
   except Exception as error:self.r['cleanup'].append({'kind':'volume','state':'FAILED_OR_UNKNOWN','error':str(error)})
  self.r['cleanup_complete']=len(self.r['cleanup'])==len(self.containers)+len(self.volumes) and all(x['state']=='ACKNOWLEDGED_ABSENT' for x in self.r['cleanup']);self.save()
 def run_restore(self):
  before=None
  try:
   image=json.loads(self.cmd('image',['image','inspect',IMAGE]))[0];need(image['Id']==IMAGE_ID and image['Architecture']=='amd64','IMAGE_PIN')
   before=self.original_snapshot('original-before');self.r['original_before']=before;self.save()
   pgvol=self.volume('pgdata');sv=self.volume('storage');self.new_password=secrets.token_hex(32)
   # Own named PG volume copies image directory ownership; no shared chmod/chown.
   self.pg=self.create('pg',['--user=999:999','--mount','type=volume,src='+pgvol+',dst=/var/lib/postgresql/data',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777','--tmpfs','/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=999,gid=999,mode=0770',
    '-e','POSTGRES_PASSWORD']+sum((['-e',k+'='] for k in stack.PROXY_KEYS),[])+[IMAGE,'postgres','-c','listen_addresses=127.0.0.1'])
   # Fresh password is process env only and never written into source/log argv.
   # create above requires the selector on that Docker process.
   self.cmd('start-pg',['start',self.pg]);self.cmd('pg-ready',['exec',self.pg,'sh','-ec','i=0; until pg_isready -U postgres >/dev/null; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'],timeout=65)
   fresh=json.loads(self.sql('fresh-target',b"SELECT json_build_object('version',current_setting('server_version_num'),'system',(SELECT system_identifier::text FROM pg_control_system()),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),'custom_schemas',(SELECT count(*) FROM pg_namespace WHERE nspname NOT IN ('public','information_schema','pg_catalog','pg_toast')),'custom_roles',(SELECT count(*) FROM pg_roles WHERE rolname NOT LIKE 'pg_%' AND rolname<>'postgres'));"))
   need(fresh['version']=='170011' and fresh['custom_schemas']==0 and fresh['custom_roles']==0 and fresh['system']!=before['observed']['system'],'TARGET_NOT_FRESH_OR_FOREIGN');self.r['target_identity']=fresh;self.r['target_cid']=self.pg;self.save()
   schema=self.cmd('archive-schema',['exec','-i',self.pg,'pg_restore','--schema-only','--file=-'],read(BACKUP/'database.dump'))
   data=self.cmd('archive-data',['exec','-i',self.pg,'pg_restore','--data-only','--file=-'],read(BACKUP/'database.dump'))
   self.expected_schema=schema_objects(schema);self.expected_data=data_rows(data);self.globals=read(BACKUP/'globals.sql')
   send=self.globals.replace(b'CREATE ROLE postgres;',b'',1);need(send.replace(b'\n\nALTER ROLE postgres ',b'\nCREATE ROLE postgres;\nALTER ROLE postgres ',1)==self.globals,'GLOBALS_EXACT_BOOTSTRAP_ADAPTER')
   self.r['globals_adapter']={'omitted':'one redundant CREATE ROLE postgres only; fresh role observed; every ALTER/GRANT retained','original_sha256':sha(self.globals),'send_sha256':sha(send)};self.save()
   self.sql('restore-globals',send)
   self.cmd('restore-db',['exec','-i',self.pg,'pg_restore','--exit-on-error','--single-transaction','-U','postgres','-d','postgres'],read(BACKUP/'database.dump'),timeout=120)
   self.snapshot('restored');self.r['restore']='MATCH_ACCEPTED_BACKUP';self.save()
   self.cmd('stop-restored',['stop','--time','20',self.pg]);self.cmd('restart-restored',['start',self.pg]);self.cmd('restart-ready',['exec',self.pg,'sh','-ec','i=0; until pg_isready -U postgres >/dev/null; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'],timeout=65)
   self.snapshot('restarted');self.r['restart']='MATCH_ACCEPTED_BACKUP';self.save()
   # Exact archive owner is an RLS input, NOT a fabricated/current Auth session.
   rows=self.expected_data['tables'];key=next(k for k in rows if k.startswith('COPY platform_dev.workspaces '));cols=key.split('(',1)[1].split(')',1)[0].split(', ');fields=rows[key][0].split('\t');owner=fields[cols.index('owner_id')];workspace=fields[cols.index('id')];uuid.UUID(owner);uuid.UUID(workspace)
   q=("BEGIN; SELECT json_build_object('login',current_user,'superuser',rolsuper,'bypass',rolbypassrls) FROM pg_roles WHERE rolname=current_user; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\""+owner+"\",\"role\":\"authenticated\"}',true); SELECT count(*) FROM platform_dev.workspaces; SELECT count(*) FROM platform_dev.workspaces WHERE id<>'"+workspace+"'; ROLLBACK;").encode()
   result=self.sql('ordinary-rls',q,'authenticator').decode().splitlines();ident=json.loads(result[0]);need(ident=={'login':'authenticator','superuser':False,'bypass':False} and result[-2:]==['1','0'],'RESTORED_RLS_PERMISSION_MISMATCH');self.r['ordinary_rls']='OWN_ONE_FOREIGN_ZERO_REAL_DATABASE_LOGIN'
   # Preserve historical role drift rather than weakening/changing it for green.
   attributes=json.loads(self.sql('restored-role-security',b"SELECT json_agg(json_build_object('role',rolname,'bypassrls',rolbypassrls)) FROM pg_roles WHERE rolname IN ('service_role','supabase_storage_admin');"));self.r['current_profile_security']={'state':'MISMATCH_HISTORICAL_BACKUP_NOT_RUNTIME_READY' if any(x['bypassrls'] for x in attributes) else 'MATCH','historical_roles':attributes,'no_runtime_activation':True}
   extract=self.create('storage-extract',['-i','--user=0:0','--cap-add=CHOWN','--cap-add=FOWNER','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1m',
    '--mount','type=volume,src='+sv+',dst=/restore-storage','--entrypoint','tar',IMAGE,'-C','/restore-storage','--same-owner','--same-permissions','-xf','-'])
   self.cmd('storage-extract',['start','-a','-i',extract],read(BACKUP/'storage.tar'));need(self.inspect('storage-extract-exit',extract)['State']['ExitCode']==0,'STORAGE_EXTRACT_FAILED')
   observe=self.create('storage-observe',['--user=1000:1000','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1m',
    '--mount','type=volume,src='+sv+',dst=/restore-storage,readonly','--entrypoint','tar',IMAGE,'-C','/restore-storage','-cf','-','.'])
   actual=self.cmd('storage-observe',['start','-a',observe]);need(self.inspect('storage-observe-exit',observe)['State']['ExitCode']==0,'STORAGE_OBSERVE_FAILED')
   expected=tar_snapshot(read(BACKUP/'storage.tar'));self.compare('storage',expected,tar_snapshot(actual));self.r['storage']={'entries':len(expected),'files':sum(x['type']=='file' for x in expected.values()),'scope':'EMPTY_DIRECTORY_ARCHIVE_ONLY_NO_DOCUMENT_RECOVERY'}
  except Exception as error:
   if self.r['primary_error'] is None:self.r['primary_error']=str(error)
   self.save()
  finally:
   self.cleanup()
   if before is not None:
    try:self.compare('original-preserved',before,self.original_snapshot('original-after'))
    except Exception as error:
     if self.r['primary_error'] is None:self.r['primary_error']=str(error)
   self.r['sealed_five_unchanged']=stack.source_seal()==self.seal
   self.r['status']='RESTORE_FIDELITY_PROVED_SECURITY_DRIFT_REMAINS' if self.r['primary_error'] is None and self.r['cleanup_complete'] else 'FAILED_OR_UNKNOWN'
   self.r['ended_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());self.save()
  return self.r

def main():
 parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False);parser.add_argument('mode',choices=['inspect','run']);args=parser.parse_args()
 if args.mode=='inspect':validate_inputs();print(json.dumps({'backup':'EXACT_RECEIPT_MATCH','restore':'NOT_RUN'}));return 0
 run=Restore();result=run.run_restore();print(json.dumps({'run':result['run'],'status':result['status'],'primary_error':result['primary_error'],'restore':result['restore'],'restart':result['restart'],'cleanup_complete':result['cleanup_complete'],'receipt_sha256':sha((run.out/'receipt.json').read_bytes())}));return 0 if result['status']=='RESTORE_FIDELITY_PROVED_SECURITY_DRIFT_REMAINS' else 1
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as error:print(json.dumps({'status':'HOLD_OR_UNKNOWN','reason':str(error),'retry':False}));raise SystemExit(1)
