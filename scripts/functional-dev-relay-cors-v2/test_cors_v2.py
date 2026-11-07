"""New v2 source/wire/lifecycle controls. No sockets, Docker, Auth or SQL."""
from http.client import HTTPResponse
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch,MagicMock
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import cors_policy as p
import relay_v2 as v
import transition as t


class Socket:
 def __init__(self,raw):self.raw=raw;self.output=bytearray()
 def makefile(self,*args,**kwargs):return io.BytesIO(self.raw)
 def sendall(self,data):self.output.extend(data)
 def settimeout(self,value):pass


def wire(method='GET',origin='http://localhost:3008',headers=None,body=b'',status=200,provider_headers=None):
 forwarded=[];provider_body=b'provider-owned-result' if status!=204 else b''
 fields={**(provider_headers or {}),'Content-Length':str(len(provider_body))}
 reply=('HTTP/1.0 '+str(status)+' Result\r\n'+''.join(k+': '+val+'\r\n' for k,val in fields.items())+'\r\n').encode()+provider_body
 backend=SimpleNamespace(PROFILE={'http_envelope_limit_bytes':4096},state=lambda:None,
  relay=lambda raw:(forwarded.append(raw) or reply))
 h={**(headers or {}),'Content-Length':str(len(body))}
 if origin is not None:h['Origin']=origin
 raw=(method+' /auth/v1/token HTTP/1.0\r\n'+''.join(k+': '+val+'\r\n' for k,val in h.items())+'\r\n').encode()+body
 sock=Socket(raw);v.handler(backend,threading.BoundedSemaphore(1))(sock,('127.0.0.1',123),SimpleNamespace())
 response=HTTPResponse(Socket(bytes(sock.output)),method=method);response.begin()
 return response,response.read(),forwarded,provider_body


class PolicyTests(unittest.TestCase):
 def test_exact_three_origins(self):
  for origin in p.ORIGINS:
   with self.subTest(origin=origin):self.assertEqual(dict(p.response_headers(origin))['Access-Control-Allow-Origin'],origin)
 def test_bad_origins_no_cors_authority(self):
  for origin in [None,'null','*','http://127.0.0.1:3008','https://localhost:3008','http://localhost:30080','http://localhost:3008/','http://localhost:3008.evil','http://evil:3008','http://localhost:3008,http://evil','http://localhost:9999']:
   with self.subTest(origin=origin):self.assertEqual(p.response_headers(origin),[])
 def test_actual_sdk_preflight_headers_and_methods(self):
  headers='apikey, authorization, content-type, x-client-info, x-supabase-api-version'
  for method in ['GET','HEAD','POST','PUT','PATCH','DELETE']:
   with self.subTest(method=method):self.assertTrue(p.preflight('http://localhost:3008',method,headers))
 def test_invalid_preflight_method_header_duplicates(self):
  for method,headers in [('TRACE','apikey'),('CONNECT','apikey'),('OPTIONS','apikey'),('POST','x-unapproved'),('POST','apikey,apikey'),('POST','apikey,'),('POST','*')]:
   with self.subTest(method=method,headers=headers):self.assertFalse(p.preflight('http://localhost:3008',method,headers))


class HTTPTests(unittest.TestCase):
 def test_before_counterexample_then_new_origin_and_old_origin_responses(self):
  old={'http://127.0.0.1:3000','http://localhost:3000'}
  self.assertNotIn('http://localhost:3008',old) # exact v1 counterexample
  for origin in p.ORIGINS:
   with self.subTest(origin=origin):
    response,body,forwarded,expected=wire(origin=origin)
    self.assertEqual(response.status,200);self.assertEqual(body,expected)
    self.assertEqual(response.getheader('Access-Control-Allow-Origin'),origin);self.assertEqual(len(forwarded),1)
 def test_options_forwards_provider_status_and_exact_sdk_headers(self):
  headers={'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'apikey, authorization, content-type, x-client-info, x-supabase-api-version'}
  response,body,forwarded,_=wire(method='OPTIONS',headers=headers,status=204,provider_headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Access-Control-Allow-Credentials':'true'})
  self.assertEqual(response.status,204);self.assertEqual(body,b'');self.assertEqual(len(forwarded),1)
  self.assertEqual(response.getheader('Access-Control-Allow-Origin'),'http://localhost:3008')
  self.assertEqual(response.getheader('Access-Control-Allow-Methods'),'POST')
  self.assertEqual(response.getheader('Access-Control-Allow-Headers'),headers['Access-Control-Request-Headers'])
  self.assertIsNone(response.getheader('Access-Control-Allow-Credentials'))
 def test_bad_preflight_stops_before_upstream(self):
  for origin,headers in [('http://evil',{'Access-Control-Request-Method':'POST'}),('http://localhost:3008',{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-root-permit'})]:
   with self.subTest(origin=origin):
    response,_,forwarded,_=wire(method='OPTIONS',origin=origin,headers=headers)
    self.assertEqual(response.status,403);self.assertEqual(forwarded,[])
 def test_cors_does_not_override_auth_denial_or_change_wire_body(self):
  body=b'{"synthetic":"test-only"}'
  response,out,forwarded,expected=wire(method='POST',body=body,status=403,headers={'Authorization':'Bearer SYNTHETIC_TEST_ONLY','apikey':'SYNTHETIC_TEST_ONLY','X-Supabase-Api-Version':'2024-01-01'})
  self.assertEqual(response.status,403);self.assertEqual(out,expected)
  self.assertIn(b'Authorization: Bearer SYNTHETIC_TEST_ONLY',forwarded[0]);self.assertIn(b'X-Supabase-Api-Version: 2024-01-01',forwarded[0]);self.assertTrue(forwarded[0].endswith(body))
 def test_disallowed_origin_actual_request_no_auth_substitute(self):
  response,_,forwarded,_=wire(origin='http://evil',status=401)
  self.assertEqual(response.status,401);self.assertEqual(len(forwarded),1);self.assertIsNone(response.getheader('Access-Control-Allow-Origin'))
 def test_no_origin_cli_and_nonpreflight_options_remain(self):
  for method in ['GET','OPTIONS']:
   with self.subTest(method=method):
    response,_,forwarded,_=wire(method=method,origin=None,status=200)
    self.assertEqual(response.status,200);self.assertEqual(len(forwarded),1);self.assertIsNone(response.getheader('Access-Control-Allow-Origin'))
 def test_original_actual_methods_preserve_upstream(self):
  for method in ['GET','HEAD','POST','PUT','PATCH','DELETE']:
   with self.subTest(method=method):
    response,body,forwarded,expected=wire(method=method)
    self.assertEqual(response.status,200);self.assertEqual(body,b'' if method=='HEAD' else expected)
    self.assertTrue(forwarded[0].startswith((method+' /auth/v1/token HTTP/1.0').encode()))
 def test_no_new_generic_route_and_no_transfer_encoding(self):
  response,_,forwarded,_=wire(headers={'Transfer-Encoding':'chunked'})
  self.assertEqual(response.status,502);self.assertEqual(forwarded,[])


class BindingTests(unittest.TestCase):
 def fixture(self,directory):
  root=Path(directory)/'cladora-functional-dev-v1';root.mkdir(mode=0o700);(root/'relay-cors-v2').mkdir(mode=0o700)
  app=Path(directory)/'app';app.mkdir();(app/'scripts').mkdir()
  launcher=app/'scripts/run-core-service-app-assembly-17.mjs';launcher.write_text('// platform17.relay-cors-preflight.v2\n')
  binding={'contract':'platform17.relay-cors-transition-binding.v2','run_id':'a'*32,'Core_install_base':v.PROFILE['installed_Core_base'],'origin':'http://localhost:3008','relay_seal_sha256':'b'*64,'backend':{'fixed':'synthetic-only'},'app':{'root':str(app),'sha':'c'*40,'tree':'d'*40,'launcher_sha256':v.digest(launcher.read_bytes())}}
  return root,binding
 def save(self,root,binding):
  file=root/'relay-cors-v2/activation-binding.json';file.write_text(json.dumps(binding)+'\n');file.chmod(0o600);return v.digest(file.read_bytes())
 def test_missing_or_wrong_binding_digest_no_native_effect(self):
  with tempfile.TemporaryDirectory() as directory:
   root,binding=self.fixture(directory);expected=self.save(root,binding)
   with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)):
    with self.assertRaisesRegex(RuntimeError,'BINDING_DIGEST_MISMATCH'):v.load_binding('f'*64)
    self.assertNotEqual(expected,'f'*64)
 def test_current_5aa_launcher_is_explicitly_incompatible(self):
  with tempfile.TemporaryDirectory() as directory:
   root,binding=self.fixture(directory);binding['app']['sha']=v.PROFILE['known_incompatible_app'];expected=self.save(root,binding)
   with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)),patch.object(v,'verify_sources'),patch.object(v,'snapshot',return_value=binding['backend']):
    with self.assertRaisesRegex(RuntimeError,'OLD_LAUNCHER_NOT_COMPATIBLE'):v.load_binding(expected)
 def test_mocked_approved_exact_binding_positive_then_foreign_backend(self):
  with tempfile.TemporaryDirectory() as directory:
   root,binding=self.fixture(directory);expected=self.save(root,binding)
   with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)),patch.object(v,'verify_sources'),patch.object(v,'snapshot',return_value=binding['backend']),patch('subprocess.check_output',side_effect=['c'*40+'\n','d'*40+'\n']),patch('subprocess.run'):
    self.assertEqual(v.load_binding(expected)[1]['run_id'],'a'*32)
   with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)),patch.object(v,'verify_sources'),patch.object(v,'snapshot',return_value={'foreign':'synthetic-only'}):
    with self.assertRaisesRegex(RuntimeError,'FOREIGN_OR_DRIFTED_BACKEND'):v.load_binding(expected)
 def test_unknown_binding_cannot_create_process(self):
  with patch.object(v,'load_binding',side_effect=RuntimeError('BINDING_ABSENT')),patch.object(t.subprocess,'Popen',side_effect=AssertionError('no process')):
   with self.assertRaisesRegex(RuntimeError,'BINDING_ABSENT'):t.activate('a'*64)
 def test_null_source_pin_and_self_approval_field_rejected(self):
  for kind in ['source_pin','approval']:
   with self.subTest(kind=kind),tempfile.TemporaryDirectory() as directory:
    root,binding=self.fixture(directory)
    if kind=='source_pin':binding['relay_seal_sha256']=None
    else:binding['approved']=True
    expected=self.save(root,binding)
    with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)):
     with self.assertRaises(RuntimeError):v.load_binding(expected)
 def test_wrong_exact_app_or_launcher_hash_rejected(self):
  for kind in ['head','launcher']:
   with self.subTest(kind=kind),tempfile.TemporaryDirectory() as directory:
    root,binding=self.fixture(directory)
    if kind=='launcher':binding['app']['launcher_sha256']='f'*64
    expected=self.save(root,binding)
    outputs=['f'*40+'\n','d'*40+'\n'] if kind=='head' else ['c'*40+'\n','d'*40+'\n']
    with patch.object(v,'load_legacy',return_value=SimpleNamespace(PRIVATE=root)),patch.object(v,'verify_sources'),patch.object(v,'snapshot',return_value=binding['backend']),patch('subprocess.check_output',side_effect=outputs),patch('subprocess.run'):
     with self.assertRaises(RuntimeError):v.load_binding(expected)
 def test_legacy_history_archive_is_byte_identical_and_exclusive(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'preserved.json';raw=b'{"noncanonical_spacing":true}\n'
   v.write_raw_new(path,raw);self.assertEqual(path.read_bytes(),raw)
   with self.assertRaises(FileExistsError):v.write_raw_new(path,b'overwrite')


class TransitionTests(unittest.TestCase):
 def test_startup_timeout_retains_primary_even_cleanup_timeout(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)/'cladora-functional-dev-v1';root.mkdir(mode=0o700);(root/'relay-cors-v2').mkdir(mode=0o700)
   original=root/'gateway-process.json';original.write_text('{"pid":123,"start_ticks":"old"}\n');original.chmod(0o600)
   backend=SimpleNamespace(PRIVATE=root,env=lambda:{})
   binding={'run_id':'a'*32,'relay_seal_sha256':'b'*64,'backend':{'synthetic':'only'}}
   sock=MagicMock();sock.__enter__.return_value=sock;sock.connect_ex.return_value=1
   child=MagicMock();child.pid=456;child.poll.return_value=None;child.wait.side_effect=TimeoutError('synthetic cleanup timeout')
   with patch.object(v,'load_binding',return_value=(backend,binding)),patch.object(v,'relay_environment',return_value={}),patch.object(t,'old_identity',return_value='ALREADY_ABSENT'),patch.object(t.socket,'socket',return_value=sock),patch.object(t.subprocess,'Popen',return_value=child),patch.object(t.time,'monotonic',side_effect=[0,21]):
    with self.assertRaisesRegex(RuntimeError,'NEW_RELAY_STARTUP_ACK_UNKNOWN'):t.activate('c'*64)
   result=json.loads((root/'relay-cors-v2/transition.result.json').read_text())
   self.assertIn('NEW_RELAY_STARTUP_ACK_UNKNOWN',result['first_error']);self.assertEqual(result['cleanup'],'UNKNOWN_OWNER_PLATFORM_NO_RETRY')
   self.assertEqual(result['old_stop'],'SKIPPED_ALREADY_ABSENT_OR_EXITED_NOT_AN_ACK');self.assertEqual(result['new_start'],'ATTEMPTED')
   self.assertEqual(original.read_bytes(),(root/'relay-cors-v2/prior-gateway-process.json').read_bytes())


class SourceIntegrityTests(unittest.TestCase):
 def altered_seal(self,change):
  seal=json.loads((v.HERE/'source-seal.json').read_text());change(seal['files'])
  seal['sha256']=v.digest(json.dumps(seal['files'],sort_keys=True,separators=(',',':')).encode())
  return (json.dumps(seal)+'\n').encode()
 def test_missing_extra_source_is_rejected(self):
  for change in [lambda files:files.pop('cors_policy.py'),lambda files:files.update({'extra.py':'f'*64})]:
   raw=self.altered_seal(change)
   with patch.object(v,'safe',return_value=raw):
    with self.assertRaisesRegex(RuntimeError,'SOURCE_SEAL_COMPLETENESS'):v.verify_sources(v.digest(raw))
 def test_changed_source_bytes_rejected_before_backend(self):
  raw=self.altered_seal(lambda files:files.update({'relay_v2.py':'f'*64}));original=v.safe
  with patch.object(v,'safe',side_effect=lambda path,*args:raw if path==v.HERE/'source-seal.json' else original(path,*args)):
   with self.assertRaisesRegex(RuntimeError,'RELAY_SOURCE_DRIFT'):v.verify_sources(v.digest(raw))
 def test_changed_filter_source_rejected_without_node_or_backend(self):
  original=v.safe;target=v.ROOT/'scripts/lib/core-service-assembly-environment-v1.mjs'
  with patch.object(v,'safe',side_effect=lambda path,*args:b'drift' if path==target else original(path,*args)):
   with self.assertRaisesRegex(RuntimeError,'ENVIRONMENT_FILTER_SOURCE_DRIFT'):v.verify_sources(v.digest(original(v.HERE/'source-seal.json')))


if __name__=='__main__':unittest.main()
