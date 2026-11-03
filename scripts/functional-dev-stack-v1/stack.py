#!/usr/bin/env python3
"""Owned persistent development infrastructure; never selects a hosted target."""
import argparse
import base64
import hashlib
import hmac
from http.client import HTTPResponse
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import secrets
import selectors
import socketserver
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

HERE=Path(__file__).resolve().parent
PROFILE=json.loads((HERE/'profile.json').read_text())
PROJECT=PROFILE['project']
DOCKER=['docker','--host=unix:///var/run/docker.sock']
PROXY_KEYS=['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy']
PRIVATE=Path('/workspace/private/cladora-functional-dev-v1')

def need(ok,reason):
 if not ok:raise RuntimeError(reason)
def sha(b):return hashlib.sha256(b).hexdigest()
def source_seal():return {p.name:sha(p.read_bytes()) for p in sorted(HERE.iterdir()) if p.name in ('stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf')}
def write(path,data):
 raw=data if isinstance(data,bytes) else (json.dumps(data,indent=2)+'\n').encode()
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'wb') as f:need(f.write(raw)==len(raw),'PRIVATE_SHORT_WRITE');f.flush();os.fsync(f.fileno())
def env():
 e=dict(os.environ)
 for k in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'):e.pop(k,None)
 return e
def docker(args,data=None,timeout=40):
 p=subprocess.run(DOCKER+args,input=data,env=env(),capture_output=True,timeout=timeout)
 if p.returncode:
  # Docker/provider output can contain private env, passwords, sessions or rows.
  if PRIVATE.exists():write(PRIVATE/'last-error.private.log',p.stdout+p.stderr)
  raise RuntimeError('DOCKER_FAILED:'+args[0]+':'+str(p.returncode))
 return p.stdout
def jwt_key(secret,role):
 # Local server API bootstrap key only; NEVER a fabricated user session/AAL.
 enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=')
 a=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'role':role,'iss':'cladora-local-server','iat':int(time.time()),'exp':int(time.time())+31536000})
 return (a+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),a,hashlib.sha256).digest()).rstrip(b'=')).decode()
def base_service(image,memory):
 return {'image':image,'platform':'linux/amd64','pull_policy':'never','restart':'unless-stopped',
  'read_only':True,'user':'999:999','cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],
  'mem_limit':memory,'cpus':0.5,'pids_limit':128,'tmpfs':['/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777'],
  'networks':['private'],'environment':{k:'' for k in PROXY_KEYS},'labels':{'cladora.dev.owner':PROJECT}}
def configuration(s):
 images=PROFILE['images'];pg=base_service(images['pg'],'768m')
 pg['volumes']=['pgdata:/var/lib/postgresql/data']
 pg['tmpfs']+=['/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0770']
 pg['environment'].update(POSTGRES_PASSWORD=s['database_password'],POSTGRES_DB='postgres')
 auth=base_service(images['auth'],'384m')
 auth['environment'].update(GOTRUE_API_HOST='0.0.0.0',GOTRUE_API_PORT='9999',API_EXTERNAL_URL=PROFILE['origin']+'/auth/v1',
  GOTRUE_SITE_URL='http://127.0.0.1:3000',GOTRUE_URI_ALLOW_LIST='http://127.0.0.1:3000/**',
  GOTRUE_DB_DRIVER='postgres',GOTRUE_DB_DATABASE_URL='postgres://supabase_auth_admin:'+s['auth_password']+'@pg:5432/postgres?sslmode=disable',
  GOTRUE_DB_NAMESPACE='auth',GOTRUE_JWT_SECRET=s['jwt_secret'],GOTRUE_JWT_AUD='authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME='authenticated',
  GOTRUE_JWT_ADMIN_ROLES='service_role',GOTRUE_JWT_ISSUER=PROFILE['origin']+'/auth/v1',GOTRUE_JWT_EXP='3600',
  GOTRUE_DISABLE_SIGNUP='false',GOTRUE_EXTERNAL_EMAIL_ENABLED='true',GOTRUE_MAILER_AUTOCONFIRM='true',
  GOTRUE_EXTERNAL_PHONE_ENABLED='false',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED='false')
 rest=base_service(images['rest'],'256m')
 rest['environment'].update(PGRST_DB_URI='postgres://authenticator:'+s['rest_password']+'@pg:5432/postgres',
  PGRST_DB_SCHEMAS='public,platform_dev',PGRST_DB_ANON_ROLE='anon',PGRST_JWT_SECRET=s['jwt_secret'],PGRST_DB_MAX_ROWS='1000')
 storage=base_service(images['storage'],'384m')
 storage['environment'].update(ANON_KEY=s['anon_key'],SERVICE_KEY=s['service_key'],AUTH_JWT_SECRET=s['jwt_secret'],
  DATABASE_URL='postgres://supabase_storage_admin:'+s['storage_password']+'@pg:5432/postgres',POSTGREST_URL='http://rest:3000',
  STORAGE_BACKEND='file',FILE_STORAGE_BACKEND_PATH='/var/lib/storage',FILE_SIZE_LIMIT='16777216',
  TENANT_ID=PROJECT,REGION='local',GLOBAL_S3_BUCKET='local',ENABLE_IMAGE_TRANSFORMATION='false',
  STORAGE_PUBLIC_URL=PROFILE['origin']+'/storage/v1')
 # Named storage directory uses image's normal uid1000, not host/shared ownership repair.
 storage['user']='1000:1000';storage['volumes']=['storage-data:/var/lib/storage']
 gateway=base_service(images['gateway'],'64m');gateway['user']='101:101'
 gateway['entrypoint']=['nginx','-g','daemon off;']
 gateway['volumes']=[str(PRIVATE/'gateway.conf')+':/etc/nginx/nginx.conf:ro']
 return {'name':PROJECT,'services':{'pg':pg,'auth':auth,'rest':rest,'storage':storage,'gateway':gateway},
  'networks':{'private':{'name':PROJECT+'-private','internal':True,'labels':{'cladora.dev.owner':PROJECT}}},
  'volumes':{name:{'name':PROJECT+'-'+name,'labels':{'cladora.dev.owner':PROJECT,'cladora.dev.persistent':'true'}} for name in PROFILE['persistent_volumes']}}
def state():
 need(PRIVATE.resolve()==PRIVATE and PRIVATE.is_dir() and PRIVATE.stat().st_uid==os.getuid() and PRIVATE.stat().st_mode&0o077==0,'PRIVATE_CUSTODY')
 for name in ('secrets.json','descriptor.json','compose.json'):
  p=PRIVATE/name;need(p.is_file() and not p.is_symlink() and p.stat().st_nlink==1 and p.stat().st_mode&0o077==0,'PRIVATE_FILE_CUSTODY')
 s=json.loads((PRIVATE/'secrets.json').read_text());d=json.loads((PRIVATE/'descriptor.json').read_text())
 need(d['project']==PROJECT and d['source_seal']==source_seal(),'SOURCE_DRIFT')
 need(json.loads((PRIVATE/'compose.json').read_text())==configuration(s),'CONFIG_DRIFT')
 gateway=PRIVATE/'gateway.conf'
 need(gateway.is_file() and not gateway.is_symlink() and gateway.stat().st_nlink==1
  and gateway.read_bytes()==(HERE/'gateway.conf').read_bytes() and gateway.stat().st_mode&0o777==0o444,'GATEWAY_CONFIG_CUSTODY')
 return s,d
def compose(args,data=None,timeout=60):return docker(['compose','-p',PROJECT,'-f',str(PRIVATE/'compose.json')]+args,data,timeout)
def cid(service):
 value=compose(['ps','-a','-q',service]).decode().strip();need(len(value)==64 and all(x in '0123456789abcdef' for x in value),'CONTAINER_IDENTITY:'+service)
 info=json.loads(docker(['inspect',value]))[0]
 need(info['Config']['Labels'].get('cladora.dev.owner')==PROJECT and info['Config']['Labels'].get('com.docker.compose.service')==service,'FOREIGN_CONTAINER')
 expected=configuration(json.loads((PRIVATE/'secrets.json').read_text()))['services'][service]
 need(info['Config']['Image']==expected['image'] and info['Config']['User']==expected['user'],'CONTAINER_IMAGE_OR_USER_DRIFT')
 h=info['HostConfig']
 need(h['ReadonlyRootfs'] and not h['Privileged'] and h['CapDrop']==['ALL'] and not h.get('CapAdd')
  and h['SecurityOpt']==['no-new-privileges:true'] and h['PidMode']=='' and not h.get('Devices'),'CONTAINER_ISOLATION_DRIFT')
 need(set(info['NetworkSettings']['Networks'])=={PROJECT+'-private'},'CONTAINER_NETWORK_DRIFT')
 ports=h.get('PortBindings') or {}
 need(ports=={},'CONTAINER_PORT_DRIFT')
 actual={x['Destination']:x for x in info.get('Mounts',[]) if x['Type']!='tmpfs'}
 targets={'pg':{'/var/lib/postgresql/data':'pgdata'},'storage':{'/var/lib/storage':'storage-data'},
  'gateway':{'/etc/nginx/nginx.conf':str(PRIVATE/'gateway.conf')}}.get(service,{})
 need(set(actual)==set(targets),'CONTAINER_MOUNT_DRIFT')
 for dest,source in targets.items():
  entry=actual[dest]
  if service=='gateway':need(entry['Type']=='bind' and entry['Source']==source and not entry['RW'],'GATEWAY_BIND_DRIFT')
  else:need(entry['Type']=='volume' and entry['Name']==PROJECT+'-'+source and entry['RW'],'PERSISTENT_VOLUME_DRIFT')
 for key,expected_value in expected['environment'].items():need(key+'='+str(expected_value) in info['Config']['Env'],'CONTAINER_ENV_DRIFT')
 return value,info
def sql(raw):
 state();container,_=cid('pg')
 return docker(['exec','-i','--user','999:999',container,'psql','-U','postgres','-d','postgres','-XAt','-v','ON_ERROR_STOP=1'],raw,40)
def init():
 need(not PRIVATE.exists(),'PRIVATE_STATE_ALREADY_EXISTS')
 containers=docker(['ps','-a','--filter','label=cladora.dev.owner='+PROJECT,'--format','{{.ID}}']).strip()
 volumes=docker(['volume','ls','--filter','label=cladora.dev.owner='+PROJECT,'--format','{{.Name}}']).strip()
 need(not containers and not volumes,'EXISTING_RESOURCE_REQUIRES_CUSTODY_RECOVERY')
 names=docker(['volume','ls','--format','{{.Name}}']).decode().splitlines()
 need(not any(PROJECT+'-'+name in names for name in PROFILE['persistent_volumes']),'NAMED_VOLUME_COLLISION')
 networks=docker(['network','ls','--format','{{.Name}}']).decode().splitlines()
 need(PROJECT+'-private' not in networks,'NETWORK_NAME_COLLISION')
 PRIVATE.mkdir(mode=0o700,parents=True)
 write(PRIVATE/'gateway.conf',(HERE/'gateway.conf').read_bytes());os.chmod(PRIVATE/'gateway.conf',0o444)
 s={k:secrets.token_hex(32) for k in ('database_password','auth_password','rest_password','storage_password','jwt_secret','user_a_password','user_b_password')}
 s['anon_key']=jwt_key(s['jwt_secret'],'anon');s['service_key']=jwt_key(s['jwt_secret'],'service_role')
 write(PRIVATE/'secrets.json',s);write(PRIVATE/'compose.json',configuration(s))
 write(PRIVATE/'descriptor.json',{'project':PROJECT,'instance':uuid.uuid4().hex,'source_seal':source_seal(),'phase':'INITIALIZED_NO_DOMAIN','created_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())})
def pull():
 state()
 for name,image in PROFILE['images'].items():
  if name=='scanner':continue # signatures/queue integration is a separate explicit gate
  docker(['pull','--platform=linux/amd64',image],timeout=240)
def wait_pg():
 container,_=cid('pg')
 docker(['exec',container,'sh','-ec','i=0; until pg_isready -U postgres >/dev/null; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'],timeout=65)
def bootstrap():
 s,d=state();need(d['phase']=='INITIALIZED_NO_DOMAIN','BOOTSTRAP_ALREADY_ATTEMPTED')
 d['phase']='BOOTSTRAP_DISPATCHED';write(PRIVATE/'descriptor.json',d)
 compose(['up','-d','--no-deps','pg']);wait_pg()
 result=sql((HERE/'bootstrap.sql').read_bytes())
 # Values generated hex only; never receive arbitrary SQL from caller.
 need(all(len(s[k])==64 and all(x in '0123456789abcdef' for x in s[k]) for k in ('auth_password','rest_password','storage_password')),'GENERATED_PASSWORD_FORMAT')
 sql(('ALTER ROLE supabase_auth_admin PASSWORD \''+s['auth_password']+'\';\nALTER ROLE authenticator PASSWORD \''+s['rest_password']+'\';\nALTER ROLE supabase_storage_admin PASSWORD \''+s['storage_password']+'\';').encode())
 d['phase']='INFRASTRUCTURE_INSTALLED_NO_DOMAIN';d['bootstrap_output_sha256']=sha(result);write(PRIVATE/'descriptor.json',d)
def start():
 _,d=state();need(d['phase']=='INFRASTRUCTURE_INSTALLED_NO_DOMAIN','BOOTSTRAP_REQUIRED')
 compose(['up','-d','--no-deps','pg']);wait_pg()
 volume_init()
 compose(['up','-d','--no-deps','auth','rest','storage']);compose(['up','-d','--no-deps','gateway'])
 start_gateway_process()
 health()
 sql((HERE/'provider-compatibility.sql').read_bytes())

def volume_init():
 state();name=PROJECT+'-storage-data'
 # The sole persistent-volume ownership bootstrap, never a shared host chmod.
 existing=docker(['volume','ls','--format','{{.Name}}']).decode().splitlines()
 if name not in existing:
  docker(['volume','create','--label','cladora.dev.owner='+PROJECT,'--label','cladora.dev.persistent=true',
   '--label','com.docker.compose.project='+PROJECT,'--label','com.docker.compose.volume=storage-data',name])
 v=json.loads(docker(['volume','inspect',name]))[0];need(v['Labels'].get('cladora.dev.owner')==PROJECT,'FOREIGN_STORAGE_VOLUME')
 if (PRIVATE/'storage-volume-init.json').exists():
  r=json.loads((PRIVATE/'storage-volume-init.json').read_text());need(r['state']=='ACKNOWLEDGED' and r['volume']==name,'VOLUME_INIT_ACK_UNKNOWN');return
 helper=PROJECT+'-storage-volume-init'
 write(PRIVATE/'storage-volume-init.json',{'state':'DISPATCHED','volume':name,'helper_name':helper})
 args=['create','--pull=never','--name',helper,'--label','cladora.dev.owner='+PROJECT,'--network=none','--read-only',
  '--user=0:0','--cap-drop=ALL','--cap-add=CHOWN','--security-opt=no-new-privileges:true','--memory=64m','--cpus=0.25','--pids-limit=32',
  '--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1m',
  '--mount','type=volume,src='+name+',dst=/owned-storage','--entrypoint','sh',PROFILE['images']['pg'],'-ec',
  'test -z "$(find /owned-storage -mindepth 1 -maxdepth 1 -print -quit)"; chmod 0700 /owned-storage; chown 1000:1000 /owned-storage; test "$(stat -c %u:%g:%a /owned-storage)" = 1000:1000:700']
 container=docker(args).decode().strip();need(len(container)==64,'VOLUME_HELPER_CID')
 write(PRIVATE/'storage-volume-init.json',{'state':'CREATED','volume':name,'helper_name':helper,'cid':container})
 docker(['start','-a',container]);info=json.loads(docker(['inspect',container]))[0]
 need(info['Config']['Labels'].get('cladora.dev.owner')==PROJECT and info['State']['Status']=='exited' and info['State']['ExitCode']==0,'VOLUME_HELPER_FAILED')
 docker(['rm','-v',container]) # Only helper-owned anonymous volumes, never named product data.
 write(PRIVATE/'storage-volume-init.json',{'state':'ACKNOWLEDGED','volume':name,'helper_name':helper,'cid':container,'cleanup':'helper_removed_volume_preserved','uid':1000,'gid':1000,'mode':'0700'})
def status():
 _,d=state();result={'phase':d['phase'],'services':{}}
 for service in ('pg','auth','rest','storage','gateway'):
  container,info=cid(service)
  result['services'][service]={'cid':container,'running':info['State']['Running'],'image_id':info['Image'],'status':info['State']['Status']}
 net=json.loads(docker(['network','inspect',PROJECT+'-private']))[0];need(net['Internal'] is True,'NETWORK_NOT_INTERNAL')
 result['internal_network']=True
 for name in ('pgdata','storage-data'):
  v=json.loads(docker(['volume','inspect',PROJECT+'-'+name]))[0]
  need(v['Labels'].get('cladora.dev.owner')==PROJECT and v['Labels'].get('cladora.dev.persistent')=='true','FOREIGN_VOLUME')
 return result
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**kw):raise RuntimeError('REDIRECT_DENIED')

def serve():
 state()
 capacity=threading.BoundedSemaphore(8)
 class PGHandler(socketserver.BaseRequestHandler):
  def handle(self):
   if not capacity.acquire(blocking=False):return
   try:pg_forward(self.request)
   except Exception:pass # opaque transport UNKNOWN; never infer SQL outcome/replay
   finally:capacity.release()
 pg_server=socketserver.ThreadingTCPServer(('127.0.0.1',55422),PGHandler,bind_and_activate=False)
 pg_server.allow_reuse_address=True;pg_server.daemon_threads=True;pg_server.server_bind();pg_server.server_activate()
 threading.Thread(target=pg_server.serve_forever,daemon=True).start()
 class Handler(BaseHTTPRequestHandler):
  protocol_version='HTTP/1.0'
  def log_message(self,*args):pass # no path/token/body logging
  def handle_fixed(self):
   if not capacity.acquire(blocking=False):self.send_error(503,'Local capacity exhausted; request not dispatched');return
   try:
    state();need(self.command in ('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'),'METHOD_NOT_ALLOWED')
    need(self.path.startswith(('/auth/v1/','/rest/v1/','/storage/v1/')) and '://' not in self.path and '\\' not in self.path and '\r' not in self.path and '\n' not in self.path,'ROUTE_NOT_ALLOWED')
    need(not self.headers.get('Transfer-Encoding'),'REQUEST_TRANSFER_ENCODING_NOT_ALLOWED')
    length=int(self.headers.get('Content-Length','0'));need(0<=length<=16*1024*1024,'REQUEST_BOUND')
    self.connection.settimeout(15);body=self.rfile.read(length);need(len(body)==length,'REQUEST_SHORT_READ')
    allowed={'authorization','apikey','content-type','accept','accept-profile','content-profile','prefer','range','if-match','x-upsert','x-client-info','origin','access-control-request-method','access-control-request-headers'}
    headers=[f'{k}: {v}' for k,v in self.headers.items() if k.lower() in allowed]
    raw=(self.command+' '+self.path+' HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\nContent-Length: '+str(length)+'\r\n'+'\r\n'.join(headers)+'\r\n\r\n').encode()+body
    reply=relay(raw)
    class Socket:
     def makefile(self,*args,**kwargs):return io.BytesIO(reply)
    response=HTTPResponse(Socket());response.begin();data=response.read(16*1024*1024+1);need(len(data)<=16*1024*1024,'RESPONSE_BOUND')
    self.send_response(response.status)
    for k,v in response.getheaders():
     if k.lower() not in ('connection','transfer-encoding','content-length','server','date','access-control-allow-origin','access-control-allow-credentials'):self.send_header(k,v)
    origin=self.headers.get('Origin')
    if origin in ('http://127.0.0.1:3000','http://localhost:3000'):
     self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
    self.send_header('Content-Length',str(len(data)));self.end_headers()
    if self.command!='HEAD':self.wfile.write(data)
   except Exception:
    self.send_error(502,'Local transport failed; no automatic replay')
   finally:capacity.release()
  do_GET=do_HEAD=do_POST=do_PUT=do_PATCH=do_DELETE=do_OPTIONS=handle_fixed
 server=ThreadingHTTPServer(('127.0.0.1',55421),Handler)
 server.daemon_threads=True;server.serve_forever()

def pg_forward(client):
 state();container,_=cid('pg')
 script='exec 3<>/dev/tcp/127.0.0.1/5432; cat <&3 & reader=$!; trap "kill $reader 2>/dev/null || :" EXIT; cat >&3; kill "$reader" 2>/dev/null || :; wait "$reader" 2>/dev/null || :'
 p=subprocess.Popen(DOCKER+['exec','-i','--user','999:999',container,'bash','-ec',script],env=env(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
 sel=selectors.DefaultSelector();incoming=bytearray();outgoing=bytearray();deadline=time.monotonic()+120
 try:
  client.setblocking(False);os.set_blocking(p.stdin.fileno(),False);os.set_blocking(p.stdout.fileno(),False)
  while True:
   remaining=deadline-time.monotonic();need(remaining>0,'PG_FORWARD_DEADLINE_UNKNOWN')
   for key in list(sel.get_map().values()):sel.unregister(key.fileobj)
   events=(selectors.EVENT_READ if len(incoming)<65536 else 0)|(selectors.EVENT_WRITE if outgoing else 0)
   if events:sel.register(client,events)
   if incoming:sel.register(p.stdin,selectors.EVENT_WRITE)
   if len(outgoing)<65536:sel.register(p.stdout,selectors.EVENT_READ)
   ready=sel.select(remaining);need(ready,'PG_FORWARD_DEADLINE_UNKNOWN')
   for key,mask in ready:
    if key.fileobj is client:
     if mask&selectors.EVENT_READ:
      part=client.recv(65536-len(incoming))
      if not part:return
      incoming.extend(part)
     if mask&selectors.EVENT_WRITE:
      sent=client.send(outgoing);del outgoing[:sent]
    elif key.fileobj is p.stdin:
     sent=os.write(p.stdin.fileno(),incoming);del incoming[:sent]
    else:
     part=os.read(p.stdout.fileno(),65536-len(outgoing))
     if not part:return
     outgoing.extend(part)
 finally:
  sel.close()
  # EOF must reach the exact remote relay before killing its local CLI. The
  # remote reader then closes its socket; a client disconnect is NOT an ACK.
  p.stdin.close()
  try:p.wait(timeout=2)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=2)
  p.stdout.close()

def relay(raw):
 # Reuse the existing fixed bash physical relay pattern, with an HTTP/1.0
 # Connection: close peer. EOF on input must NOT discard the server response.
 container,_=cid('pg')
 script='exec 3<>/dev/tcp/gateway/8080; cat <&3 & reader=$!; trap "kill $reader 2>/dev/null || :" EXIT; cat >&3; wait "$reader"'
 p=subprocess.Popen(DOCKER+['exec','-i','--user','999:999',container,'bash','-ec',script],env=env(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
 sel=selectors.DefaultSelector();out=bytearray();view=memoryview(raw);deadline=time.monotonic()+20
 try:
  os.set_blocking(p.stdin.fileno(),False);os.set_blocking(p.stdout.fileno(),False)
  sel.register(p.stdin,selectors.EVENT_WRITE);sel.register(p.stdout,selectors.EVENT_READ)
  while sel.get_map():
   remaining=deadline-time.monotonic();need(remaining>0,'HTTP_RELAY_TIMEOUT_UNKNOWN_NO_REPLAY')
   events=sel.select(remaining);need(events,'HTTP_RELAY_TIMEOUT_UNKNOWN_NO_REPLAY')
   for key,mask in events:
    if key.fileobj is p.stdin:
     try:count=os.write(p.stdin.fileno(),view[:65536])
     except BlockingIOError:continue
     need(count>0,'HTTP_RELAY_SHORT_WRITE_UNKNOWN');view=view[count:]
     if not view:sel.unregister(p.stdin);p.stdin.close()
    else:
     chunk=os.read(p.stdout.fileno(),65536)
     if not chunk:sel.unregister(p.stdout);continue
     need(len(out)+len(chunk)<=20*1024*1024,'HTTP_RELAY_CAPTURE_BOUND_UNKNOWN');out.extend(chunk)
  need(p.wait(timeout=max(0.01,deadline-time.monotonic()))==0,'HTTP_RELAY_PROCESS_UNKNOWN')
  return bytes(out)
 finally:
  sel.close()
  if p.poll() is None:p.kill();p.wait(timeout=2)
  if not p.stdin.closed:p.stdin.close()
  p.stdout.close()

def gateway_process():
 p=PRIVATE/'gateway-process.json'
 if not p.exists():return None
 d=json.loads(p.read_text());pid=d['pid'];proc=Path('/proc')/str(pid)
 need(proc.exists(),'HOST_GATEWAY_PROCESS_EXITED_NO_AUTOMATIC_REPLACEMENT')
 args=(proc/'cmdline').read_bytes().split(b'\0');need(str(HERE/'stack.py').encode() in args and b'serve' in args,'FOREIGN_HOST_PROCESS')
 need((proc/'stat').read_text().split()[21]==d['start_ticks'],'HOST_PROCESS_ID_REUSED')
 return d
def start_gateway_process():
 if gateway_process() is not None:return
 # No daemon socket TCP exposure; fixed loopback HTTP -> owned docker-exec nc.
 clean={k:v for k,v in os.environ.items() if k in ('PATH','HOME','DOCKER_CONFIG','SSL_CERT_FILE','REQUESTS_CA_BUNDLE')}
 log=os.open(PRIVATE/'gateway-process.private.log',os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
 try:p=subprocess.Popen([sys.executable,'-I','-B',str(HERE/'stack.py'),'serve'],env=clean,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
 finally:os.close(log)
 ticks=Path('/proc',str(p.pid),'stat').read_text().split()[21]
 write(PRIVATE/'gateway-process.json',{'pid':p.pid,'start_ticks':ticks,'source_seal':source_seal(),'purpose':'fixed-loopback-owned-internal-http-relay'})
def stop_gateway_process():
 d=gateway_process()
 if d:
  import signal
  os.kill(d['pid'],signal.SIGTERM)
  deadline=time.monotonic()+5;proc=Path('/proc')/str(d['pid'])
  while proc.exists() and (proc/'stat').read_text().split()[2]!='Z':
   need(time.monotonic()<deadline,'HOST_GATEWAY_STOP_UNKNOWN');time.sleep(0.05)
  write(PRIVATE/('gateway-process-stopped-'+str(time.time_ns())+'.json'),d)
  (PRIVATE/'gateway-process.json').unlink()
def http(path,method='GET',body=None,token=None,headers=None):
 need(path.startswith(('/auth/v1/','/rest/v1/','/storage/v1/')) and '://' not in path and '\\' not in path,'FIXED_LOCAL_ROUTE')
 h=dict(headers or {});h['Content-Type']='application/json'
 if token:h['Authorization']='Bearer '+token
 req=urllib.request.Request(PROFILE['origin']+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 try:
  with opener.open(req,timeout=15) as response:return response.status,response.read(2*1024*1024)
 except urllib.error.HTTPError as error:return error.code,error.read(2*1024*1024)
def health():
 for i in range(60):
  try:
   code,data=http('/auth/v1/health')
   if code==200 and PROFILE['versions']['auth'] in data.decode():return
  except (OSError,RuntimeError):pass
  time.sleep(1)
 raise RuntimeError('AUTH_HEALTH_NOT_READY')
def users():
 s,d=state();health();need(not (PRIVATE/'users.json').exists(),'USERS_ALREADY_CREATED_NO_REPLAY')
 write(PRIVATE/'users.json',{'state':'DISPATCHED_NO_RETRY'})
 users=[]
 for name in ('a','b'):
  email='dev-'+d['instance']+'-'+name+'@example.invalid'
  code,raw=http('/auth/v1/signup','POST',{'email':email,'password':s['user_'+name+'_password']})
  write(PRIVATE/('signup-'+name+'.private.json'),{'http_status':code,'response':raw.decode()})
  need(code==200,'SYNTHETIC_SIGNUP_FAILED')
  response=json.loads(raw);user=response.get('user',response);need(isinstance(user.get('id'),str),'AUTH_USER_MISSING')
  uuid.UUID(user['id']);users.append({'id':user['id'],'email':email,'password_key':'user_'+name+'_password'})
 write(PRIVATE/'users.json',{'state':'CREATED_BY_REAL_AUTH','users':users})
 ids=[x['id'] for x in users]
 sql(("INSERT INTO platform_dev.workspaces VALUES ('11111111-1111-4111-8111-111111111111','"+ids[0]+"','Synthetic development A'),('22222222-2222-4222-8222-222222222222','"+ids[1]+"','Synthetic development B');").encode())
def verify():
 s,d=state();health();u=json.loads((PRIVATE/'users.json').read_text());need(u['state']=='CREATED_BY_REAL_AUTH','USER_CUSTODY')
 receipt={'kind':'real-local-auth-rest-rls-infrastructure.v1','instance':d['instance'],'source_seal':source_seal(),'services':status(),
  'product_domain':'NOT_INSTALLED_CORE_REQUIRED','aal2':'NOT_CLAIMED','mail':'NOT_SENT','checks':{}}
 tokens=[]
 for i,user in enumerate(u['users']):
  code,raw=http('/auth/v1/token?grant_type=password','POST',{'email':user['email'],'password':s[user['password_key']]})
  need(code==200,'REAL_LOGIN_FAILED');v=json.loads(raw);token=v['access_token'];tokens.append(token)
  code,raw=http('/auth/v1/user',token=token);need(code==200 and json.loads(raw)['id']==user['id'],'REAL_CURRENT_USER_FAILED')
  claims=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='));need(claims['role']=='authenticated' and claims['aal']=='aal1' and claims['sub']==user['id'],'AUTH_CLAIMS_MISMATCH')
  session=uuid.UUID(claims['session_id'])
  count=sql(("SELECT count(*) FROM auth.sessions WHERE id='"+str(session)+"' AND user_id='"+user['id']+"';").encode()).decode().strip();need(count=='1','AUTH_SESSION_NOT_IN_DATABASE')
  write(PRIVATE/('session-'+str(i)+'.json'),v)
  code,raw=http('/rest/v1/workspaces?select=id',token=token,headers={'Accept-Profile':'platform_dev'})
  need(code==200 and len(json.loads(raw))==1,'OWN_WORKSPACE_READ_FAILED')
  receipt['checks']['user_'+str(i)+'_login_current_session_own_workspace']=True
 code,_=http('/rest/v1/workspaces?select=id',headers={'Accept-Profile':'platform_dev'});need(code in (401,403),'ANONYMOUS_NOT_DENIED');receipt['checks']['anonymous_denied']=code
 code,_=http('/rest/v1/notes','POST',{'id':str(uuid.uuid4()),'workspace_id':'11111111-1111-4111-8111-111111111111','body':'foreign must fail'},tokens[1],{'Content-Profile':'platform_dev'})
 need(code==403,'FOREIGN_WRITE_NOT_DENIED');receipt['checks']['unrelated_write_denied']=code
 code,raw=http('/rest/v1/workspaces?id=eq.11111111-1111-4111-8111-111111111111&select=id',token=tokens[1],headers={'Accept-Profile':'platform_dev'})
 need(code==200 and json.loads(raw)==[],'FOREIGN_READ_NOT_FILTERED');receipt['checks']['unrelated_read_empty']=True
 note=PRIVATE/'persistent-note.json'
 if not note.exists():
  record={'id':str(uuid.uuid4()),'workspace_id':'11111111-1111-4111-8111-111111111111','body':'durable development note'}
  write(note,{'state':'DISPATCHED','record':record})
  code,_=http('/rest/v1/notes','POST',record,tokens[0],{'Content-Profile':'platform_dev'});need(code==201,'OWN_WRITE_FAILED')
  write(note,{'state':'ACKNOWLEDGED','record':record})
 record=json.loads(note.read_text());need(record['state']=='ACKNOWLEDGED','WRITE_ACK_UNKNOWN_NO_RETRY')
 code,raw=http('/rest/v1/notes?id=eq.'+record['record']['id']+'&select=*',token=tokens[0],headers={'Accept-Profile':'platform_dev'})
 need(code==200 and json.loads(raw)==[record['record']],'DURABLE_READBACK_MISMATCH');receipt['checks']['durable_note_readback']=True
 receipt['pg_identity']=json.loads(sql(b"SELECT json_build_object('version',current_setting('server_version_num'),'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),'postmaster_start',pg_postmaster_start_time());").decode())
 need(receipt['pg_identity']['version']=='170011','PG_VERSION_DRIFT')
 receipt['checks']['storage_provider_health']=http('/storage/v1/status')[0]==200
 path=PRIVATE/('verification-'+str(time.time_ns())+'.json');write(path,receipt)
 return {'checks':receipt['checks'],'receipt_file':path.name,'receipt_sha256':sha(path.read_bytes()),'domain':'NOT_INSTALLED'}
def backup():
 state();container,_=cid('pg');directory=PRIVATE/('backup-'+str(time.time_ns()));directory.mkdir(mode=0o700)
 # Pause every HTTP writer. PG remains available for a consistent logical dump.
 stop_gateway_process();compose(['stop','--timeout','20','auth','rest','storage','gateway'])
 for name,args in [('database.dump',['pg_dump','-U','postgres','-d','postgres','-Fc']),('globals.sql',['pg_dumpall','-U','postgres','--globals-only'])]:
  raw=docker(['exec','--user','999:999',container]+args,timeout=120);write(directory/name,raw)
 helper=PROJECT+'-backup-'+str(time.time_ns())
 helper_cid=docker(['create','--pull=never','--name',helper,'--label','cladora.dev.owner='+PROJECT,'--network=none','--read-only',
  '--user=1000:1000','--cap-drop=ALL','--security-opt=no-new-privileges:true','--memory=128m','--pids-limit=32',
  '--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1m',
  '--mount','type=volume,src='+PROJECT+'-storage-data,dst=/owned-storage,readonly','--entrypoint','tar',PROFILE['images']['pg'],'-C','/owned-storage','-cf','-','.']).decode().strip()
 write(directory/'helper.json',{'cid':helper_cid,'name':helper,'cleanup':'PENDING'})
 raw=docker(['start','-a',helper_cid],timeout=120);info=json.loads(docker(['inspect',helper_cid]))[0]
 need(info['State']['ExitCode']==0 and info['State']['Status']=='exited','STORAGE_BACKUP_UNKNOWN');write(directory/'storage.tar',raw)
 docker(['rm','-v',helper_cid]);write(directory/'helper.json',{'cid':helper_cid,'name':helper,'cleanup':'ACKNOWLEDGED_HELPER_REMOVED_NAMED_VOLUME_PRESERVED'})
 write(directory/'receipt.json',{'state':'ACKNOWLEDGED','writers':'STOPPED','files':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in directory.iterdir()},'restore':'NOT_TESTED; separate empty owned target only','storage':'owned named volume archived read-only while writers stopped'})
 return {'backup':directory.name,'receipt_sha256':sha((directory/'receipt.json').read_bytes())}
def scanner_engine():
 state();image=PROFILE['images']['scanner'];name=PROJECT+'-scanner-engine'
 need(not (PRIVATE/'scanner-engine.json').exists(),'SCANNER_ENGINE_ALREADY_ATTEMPTED')
 write(PRIVATE/'scanner-engine.json',{'state':'DISPATCHED','name':name,'image':image})
 docker(['pull','--platform=linux/amd64',image],timeout=240)
 container=docker(['create','--pull=never','--name',name,'--label','cladora.dev.owner='+PROJECT,'--network=none','--read-only',
  '--user=1000:1000','--cap-drop=ALL','--security-opt=no-new-privileges:true','--memory=256m','--pids-limit=64',
  '--entrypoint','clamscan',image,'--version']).decode().strip()
 write(PRIVATE/'scanner-engine.json',{'state':'CREATED','cid':container,'name':name,'image':image})
 version=docker(['start','-a',container]).decode().strip();i=json.loads(docker(['inspect',container]))[0]
 need(i['State']['Status']=='exited' and i['State']['ExitCode']==0 and 'ClamAV 1.4.4' in version,'SCANNER_ENGINE_IDENTITY')
 docker(['rm','-v',container])
 receipt={'state':'ENGINE_VERSION_PROVED_ONLY','version':version,'image':image,'cid':container,'cleanup':'ACKNOWLEDGED_HELPER_REMOVED','signature_database':'NOT_AVAILABLE','scan':'NOT_RUN','documents_queue':'NOT_BOUND'}
 write(PRIVATE/'scanner-engine.json',receipt);return receipt
def main():
 parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False);parser.add_argument('command',choices=['init','pull','bootstrap','start','stop','status','users','verify','backup','scanner-engine','serve']);a=parser.parse_args()
 if a.command=='init':init();result={'initialized':True}
 else:
  state()
  if a.command=='pull':pull();result={'images':'PINNED_PULLED'}
  elif a.command=='bootstrap':bootstrap();result={'infrastructure':'INSTALLED_NO_DOMAIN'}
  elif a.command=='start':start();result={'started':True}
  elif a.command=='stop':stop_gateway_process();compose(['stop','--timeout','20']);result={'stopped':True,'volumes':'PRESERVED'}
  elif a.command=='status':result=status()
  elif a.command=='users':users();result={'synthetic_auth_users':2,'platform_dev_workspaces':2,'canonical_workspaces':'CORE_REQUIRED'}
  elif a.command=='verify':result=verify()
  elif a.command=='backup':result=backup()
  elif a.command=='scanner-engine':result=scanner_engine()
  elif a.command=='serve':serve();return
 print(json.dumps(result))
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'status':'FAILED_OR_UNKNOWN','reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,'automatic_retry':False}));raise SystemExit(1)
