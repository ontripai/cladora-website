#!/usr/bin/env python3
"""Versioned CORS facade reusing the sealed v1 HTTP/PG physical transport.

Never overwrites the v1 descriptor, source files or gateway-process record.
The expected binding digest is integrity input, not an approval mechanism.
"""
import argparse
import hashlib
from http.client import HTTPResponse
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import socketserver
import stat
import sys
import threading
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import cors_policy as policy
PROFILE=json.loads((HERE/'profile.json').read_text())
SEALED_FILES=frozenset(('cors_policy.py','profile.json','relay_v2.py','transition.py',
 'test_cors_v2.py','CONTRACT.md','activation-binding.template.json','sdk-source-pins.json'))


def need(ok,code):
 if not ok:raise RuntimeError(code)


def digest(raw):return hashlib.sha256(raw).hexdigest()


def safe(path,private=False):
 need(path.resolve()==path and path.is_file() and not path.is_symlink(),'SOURCE_OR_FILE_ALIAS')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and before.st_nlink==1,'FILE_LINKS_OR_TYPE')
  need(before.st_size<=(131072 if private else 2097152),'FILE_READ_BOUND')
  if private:
   need(before.st_uid==os.getuid() and not before.st_mode&0o077,'PRIVATE_FILE_CUSTODY')
   found=False
   for parent in path.parents:
    s=parent.stat();need(parent.resolve()==parent and not parent.is_symlink() and not s.st_mode&0o077 and s.st_uid==os.getuid(),'PRIVATE_DIRECTORY_CUSTODY')
    if parent.name=='cladora-functional-dev-v1':found=True;break
   need(found,'FOREIGN_PRIVATE_ROOT')
  with os.fdopen(os.dup(fd),'rb') as stream:raw=stream.read(before.st_size+1)
  after=os.fstat(fd)
  need(len(raw)==before.st_size and (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns) and path.resolve()==path,'FILE_CHANGED_DURING_READ')
  return raw
 finally:os.close(fd)


def write_new(path,value):
 write_raw_new(path,(json.dumps(value,indent=2)+'\n').encode())


def write_raw_new(path,raw):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:need(os.write(fd,raw)==len(raw),'PRIVATE_SHORT_WRITE');os.fsync(fd)
 finally:os.close(fd)
 fd=os.open(path.parent,os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)


def verify_sources(expected=None):
 raw=safe(HERE/'source-seal.json');seal=json.loads(raw)
 if expected is not None:need(digest(raw)==expected,'RELAY_SEAL_IDENTITY')
 need(set(seal['files'])==SEALED_FILES,'SOURCE_SEAL_COMPLETENESS')
 need(digest(json.dumps(seal['files'],sort_keys=True,separators=(',',':')).encode())==seal['sha256'],'SOURCE_SEAL_ENCODING')
 for rel,pin in seal['files'].items():need(digest(safe(HERE/rel))==pin,'RELAY_SOURCE_DRIFT')
 for rel,pin in PROFILE['environment_filter_files'].items():need(digest(safe(ROOT/rel))==pin,'ENVIRONMENT_FILTER_SOURCE_DRIFT')
 need(set(PROFILE['origins'])==policy.ORIGINS,'CORS_PROFILE_DRIFT')
 return digest(raw)


def load_legacy():
 source=ROOT/PROFILE['legacy_relative_path']
 for name,pin in PROFILE['legacy_files'].items():need(digest(safe(source.with_name(name)))==pin,'LEGACY_SOURCE_DRIFT')
 spec=importlib.util.spec_from_file_location('platform17_cors_v2_legacy',source)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 module.state() # same immutable v1 five-file descriptor/config and target
 return module


def relay_environment():
 # Reuse the accepted F01 closed child filter; keep host proxy/CA/network
 # guards, not inherited cloud/app credentials. Docker config is a selector.
 for rel,pin in PROFILE['environment_filter_files'].items():need(digest(safe(ROOT/rel))==pin,'ENVIRONMENT_FILTER_SOURCE_DRIFT')
 path=ROOT/'scripts/service-consumer-rehearsal-17/lane.py'
 spec=importlib.util.spec_from_file_location('platform17_cors_v2_env',path)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 result=module.clean_env()
 if 'DOCKER_CONFIG' in os.environ:result['DOCKER_CONFIG']=os.environ['DOCKER_CONFIG']
 return result


def snapshot(legacy):
 _,descriptor=legacy.state();current=legacy.status()
 need(current['internal_network'] and all(v['running'] for v in current['services'].values()),'BACKEND_NOT_CURRENT')
 return {'descriptor_sha256':digest(safe(legacy.PRIVATE/'descriptor.json',True)),
  'instance':descriptor['instance'],'services':current['services']}


def load_binding(expected):
 need(isinstance(expected,str) and len(expected)==64 and all(x in '0123456789abcdef' for x in expected),'EXACT_OWNER_REVIEWED_BINDING_DIGEST_REQUIRED')
 legacy=load_legacy();raw=safe(legacy.PRIVATE/PROFILE['operator_binding'],True)
 need(digest(raw)==expected,'BINDING_DIGEST_MISMATCH');b=json.loads(raw)
 need(set(b)=={'contract','run_id','Core_install_base','origin','relay_seal_sha256','backend','app'},'EXACT_BINDING_FIELDS')
 need(b.get('contract')=='platform17.relay-cors-transition-binding.v2','BINDING_ABI')
 import re
 need(isinstance(b['run_id'],str) and re.fullmatch(r'[a-f0-9]{32}',b['run_id']) is not None,'RUN_IDENTITY_REQUIRED')
 need(isinstance(b['relay_seal_sha256'],str) and re.fullmatch(r'[a-f0-9]{64}',b['relay_seal_sha256']) is not None,'RELAY_SOURCE_PIN_REQUIRED')
 need(b.get('Core_install_base')==PROFILE['installed_Core_base'],'INSTALLED_CORE_RELABEL')
 need(b.get('origin')=='http://localhost:3008','OFFICIAL_ORIGIN')
 verify_sources(b.get('relay_seal_sha256'))
 need(b.get('backend')==snapshot(legacy),'FOREIGN_OR_DRIFTED_BACKEND')
 app=b.get('app');need(isinstance(app,dict) and set(app)=={'root','sha','tree','launcher_sha256'},'APP_BINDING_REQUIRED')
 for key,length in [('sha',40),('tree',40),('launcher_sha256',64)]:
  need(isinstance(app[key],str) and re.fullmatch(r'[a-f0-9]{'+str(length)+'}',app[key]) is not None,'EXACT_APP_PINS_REQUIRED')
 need(app['sha']!=PROFILE['known_incompatible_app'],'OLD_LAUNCHER_NOT_COMPATIBLE')
 import subprocess
 root=Path(app['root']);need(root.resolve()==root and root.is_dir(),'APP_ROOT_ALIAS')
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
 tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip()
 need(head==app['sha'] and tree==app['tree'],'EXACT_APP_SHA_TREE')
 subprocess.run(['git','diff','--quiet','HEAD','--'],cwd=root,check=True)
 launcher=root/'scripts/run-core-service-app-assembly-17.mjs'
 need(digest(safe(launcher))==app['launcher_sha256'],'EXACT_COMPATIBLE_LAUNCHER_REQUIRED')
 need(PROFILE['compatible_launcher_abi'] in safe(launcher).decode(),'VERSIONED_LAUNCHER_ABI_REQUIRED')
 return legacy,b


def process_identity(pid):
 root=Path('/proc')/str(pid);stat=(root/'stat').read_text().split(') ',1)[1].split()
 return {'ticks':stat[19],'state':stat[0],'argv':(root/'cmdline').read_bytes().split(b'\0')[:-1]}


def assert_ready(expected):
 legacy,b=load_binding(expected);record=json.loads(safe(legacy.PRIVATE/'relay-cors-v2/process.json',True))
 actual=process_identity(record['pid'])
 need(actual['ticks']==record['start_ticks'] and actual['state']!='Z','RELAY_PROCESS_IDENTITY')
 need(actual['argv']==[sys.executable.encode(),b'-I',b'-B',str(HERE/'relay_v2.py').encode(),b'serve',expected.encode()],'RELAY_PROCESS_ARGV')
 need(record['binding_sha256']==expected and record['relay_seal_sha256']==b['relay_seal_sha256'],'RELAY_RUNNING_BINDING')
 need(record['backend']==b['backend'],'RELAY_BACKEND_MISMATCH')
 return {'contract':PROFILE['compatible_launcher_abi'],'ready':True,'binding_sha256':expected}


def preflight(expected):
 """Required ABI used by the reviewed official launcher before build/start."""
 return assert_ready(expected)


def handler(legacy,capacity):
 class Handler(BaseHTTPRequestHandler):
  protocol_version='HTTP/1.0'
  def log_message(self,*args):pass
  def handle_fixed(self):
   if not capacity.acquire(blocking=False):self.send_error(503,'Local capacity exhausted; no dispatch');return
   try:
    legacy.state();need(self.command in policy.METHODS,'METHOD_NOT_ALLOWED')
    need(self.path.startswith(('/auth/v1/','/rest/v1/','/storage/v1/')) and '://' not in self.path and not any(x in self.path for x in ('\\','\r','\n')),'FIXED_ROUTE')
    need(not self.headers.get('Transfer-Encoding'),'TRANSFER_ENCODING_FORBIDDEN')
    origin=self.headers.get('Origin');method=self.headers.get('Access-Control-Request-Method') if self.command=='OPTIONS' else None
    requested=self.headers.get('Access-Control-Request-Headers')
    if method is not None and not policy.preflight(origin,method,requested):self.send_error(403,'CORS preflight not admitted');return
    length=int(self.headers.get('Content-Length','0'));need(0<=length<=legacy.PROFILE['http_envelope_limit_bytes'],'REQUEST_BOUND')
    self.connection.settimeout(15);body=self.rfile.read(length);need(len(body)==length,'REQUEST_SHORT_READ')
    headers=[]
    for k,v in self.headers.items():
     if k.lower() in policy.REQUEST_HEADERS:
      need('\r' not in v and '\n' not in v,'HEADER_INJECTION');headers.append(f'{k}: {v}')
    raw=(self.command+' '+self.path+' HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\nContent-Length: '+str(length)+'\r\n'+'\r\n'.join(headers)+'\r\n\r\n').encode()+body
    reply=legacy.relay(raw) # same existing bounded physical transport; no SQL/SDK replacement
    class Socket:
     def makefile(self,*args,**kwargs):return io.BytesIO(reply)
    response=HTTPResponse(Socket());response.begin();data=response.read(legacy.PROFILE['http_envelope_limit_bytes']+1)
    need(len(data)<=legacy.PROFILE['http_envelope_limit_bytes'],'RESPONSE_BOUND')
    self.send_response(response.status) # provider denial/error never becomes success
    for k,v in response.getheaders():
     if k.lower() not in ('connection','transfer-encoding','content-length','server','date','access-control-allow-origin','access-control-allow-credentials','access-control-allow-methods','access-control-allow-headers'):
      self.send_header(k,v)
    for k,v in policy.response_headers(origin,method,requested):self.send_header(k,v)
    self.send_header('Content-Length',str(len(data)));self.end_headers()
    if self.command!='HEAD':self.wfile.write(data)
   except Exception:self.send_error(502,'Local transport failed; no automatic replay')
   finally:capacity.release()
  do_GET=do_HEAD=do_POST=do_PUT=do_PATCH=do_DELETE=do_OPTIONS=handle_fixed
 return Handler


def serve(expected):
 legacy,b=load_binding(expected);directory=legacy.PRIVATE/'relay-cors-v2'
 need((directory/'transition.claim.json').exists(),'TRANSITION_CLAIM_REQUIRED')
 claim=json.loads(safe(directory/'transition.claim.json',True));need(claim['binding_sha256']==expected,'TRANSITION_BINDING')
 capacity=threading.BoundedSemaphore(8)
 class PG(socketserver.BaseRequestHandler):
  def handle(self):
   if not capacity.acquire(blocking=False):return
   try:legacy.pg_forward(self.request)
   except Exception:pass # same opaque transport UNKNOWN; no replay
   finally:capacity.release()
 pg=socketserver.ThreadingTCPServer(tuple(PROFILE['pg_listener']),PG,bind_and_activate=False)
 http=None
 try:
  pg.allow_reuse_address=True;pg.daemon_threads=True;pg.server_bind();pg.server_activate()
  http=ThreadingHTTPServer(tuple(PROFILE['http_listener']),handler(legacy,capacity));http.daemon_threads=True
  thread=threading.Thread(target=pg.serve_forever,daemon=True);thread.start();need(thread.is_alive(),'PG_RELAY_THREAD')
  write_new(directory/'process.json',{'pid':os.getpid(),'start_ticks':process_identity(os.getpid())['ticks'],'binding_sha256':expected,'relay_seal_sha256':b['relay_seal_sha256'],'backend':b['backend'],'listeners':'BOTH_FIXED_LOOPBACK_SOCKETS_BOUND','CORS_origins':sorted(policy.ORIGINS)})
  http.serve_forever()
 finally:
  if http:http.server_close()
  pg.server_close()


if __name__=='__main__':
 parser=argparse.ArgumentParser(allow_abbrev=False);parser.add_argument('mode',choices=['serve','preflight']);parser.add_argument('binding_sha256');a=parser.parse_args()
 try:
  if a.mode=='serve':serve(a.binding_sha256)
  else:print(json.dumps(assert_ready(a.binding_sha256)))
 except Exception as error:print(json.dumps({'state':'HOLD_OR_UNKNOWN','error':type(error).__name__,'private_diagnostic':True}));sys.exit(1)
