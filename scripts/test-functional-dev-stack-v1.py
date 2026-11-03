"""Targeted persistent lifecycle/config checks, no Docker or native substitute."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

path=Path(__file__).with_name('functional-dev-stack-v1')/'stack.py'
spec=importlib.util.spec_from_file_location('functional_stack',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class StackTests(unittest.TestCase):
 def config(self):
  s={k:'a'*64 for k in ('database_password','auth_password','rest_password','storage_password','jwt_secret')}
  s.update(anon_key='local-anon-api-key',service_key='private-server-api-key');return m.configuration(s)
 def test_internal_network_loopback_gateway_and_no_default_egress(self):
  c=self.config();self.assertTrue(c['networks']['private']['internal'])
  for name,service in c['services'].items():
   self.assertEqual(service['pull_policy'],'never');self.assertTrue(service['read_only']);self.assertEqual(service['cap_drop'],['ALL'])
   self.assertEqual(service['security_opt'],['no-new-privileges:true']);self.assertEqual(service['networks'],['private'])
   for key in m.PROXY_KEYS:self.assertEqual(service['environment'][key],'')
   self.assertEqual(service.get('ports',[]),[])
 def test_volumes_are_persistent_and_never_test_cleanup(self):
  c=self.config();self.assertEqual(len(c['volumes']),3)
  self.assertEqual(c['services']['pg']['volumes'],['pgdata:/var/lib/postgresql/data'])
  self.assertEqual(c['services']['storage']['volumes'],['storage-data:/var/lib/storage'])
  for v in c['volumes'].values():self.assertEqual(v['labels']['cladora.dev.persistent'],'true')
  source=path.read_text();self.assertNotIn("['down'",source);self.assertNotIn("['volume','rm'",source)
 def test_runtime_does_not_inherit_host_credentials_or_create_user_jwts(self):
  c=self.config()
  self.assertTrue(c['services']['auth']['environment']['GOTRUE_MAILER_AUTOCONFIRM']=='true')
  self.assertEqual(c['services']['auth']['environment']['GOTRUE_EXTERNAL_PHONE_ENABLED'],'false')
  for service in c['services'].values():self.assertNotIn('SUPABASE_ACCESS_TOKEN',service['environment'])
  self.assertNotIn('aal',json.loads(__import__('base64').urlsafe_b64decode(m.jwt_key('x'*64,'anon').split('.')[1]+'===')))
 def test_private_state_and_source_drift_failclosed(self):
  with tempfile.TemporaryDirectory() as t,patch.object(m,'PRIVATE',Path(t)):
   with self.assertRaisesRegex(RuntimeError,'PRIVATE_FILE_CUSTODY'):m.state()
 def test_foreign_route_rejected_without_request(self):
  with patch('urllib.request.build_opener') as opener:
   for route in ('https://example.com','/auth/v1/http://evil','/rest/v1/\\evil','/other'):
    with self.assertRaises(RuntimeError):m.http(route)
   opener.assert_not_called()
 def test_no_generic_cli_or_deletion_operation(self):
  with patch('sys.argv',['stack.py','--exec','anything']),patch.object(m,'docker') as docker:
   with self.assertRaises(SystemExit):m.main()
   docker.assert_not_called()
 def test_cid_stays_actual_cid_after_environment_validation(self):
  with tempfile.TemporaryDirectory() as t,patch.object(m,'PRIVATE',Path(t)):
   secret={k:'a'*64 for k in ('database_password','auth_password','rest_password','storage_password','jwt_secret')};secret.update(anon_key='anon',service_key='private')
   (Path(t)/'secrets.json').write_text(json.dumps(secret));expected=m.configuration(secret)['services']['pg']
   identity='a'*64
   info={'Config':{'Image':expected['image'],'User':expected['user'],'Labels':{'cladora.dev.owner':m.PROJECT,'com.docker.compose.service':'pg'},'Env':[k+'='+v for k,v in expected['environment'].items()]},
    'HostConfig':{'ReadonlyRootfs':True,'Privileged':False,'CapDrop':['ALL'],'SecurityOpt':['no-new-privileges:true'],'PidMode':''},
    'NetworkSettings':{'Networks':{m.PROJECT+'-private':{}}},'Mounts':[{'Destination':'/var/lib/postgresql/data','Type':'volume','Name':m.PROJECT+'-pgdata','RW':True}]}
   with patch.object(m,'compose',return_value=identity.encode()),patch.object(m,'docker',return_value=json.dumps([info]).encode()):
    self.assertEqual(m.cid('pg')[0],identity)
 def test_host_relay_uses_real_http_handler_and_fixed_loopback_only(self):
  with patch.object(m,'state'),patch.object(m,'ThreadingHTTPServer') as server,patch.object(m.socketserver,'ThreadingTCPServer') as pg,patch.object(m.threading,'Thread'):
   m.serve();args=server.call_args.args
   self.assertEqual(args[0],('127.0.0.1',55421));self.assertTrue(issubclass(args[1],m.BaseHTTPRequestHandler))
   self.assertEqual(pg.call_args.args[0],('127.0.0.1',55422));self.assertTrue(pg.return_value.allow_reuse_address)
   server.return_value.serve_forever.assert_called_once()
 def test_backup_calls_existing_pg_identity_and_preserves_named_volumes(self):
  with tempfile.TemporaryDirectory() as t,patch.object(m,'PRIVATE',Path(t)),patch.object(m,'state'),patch.object(m,'stop_gateway_process'),patch.object(m,'compose'),patch.object(m,'cid',return_value=('p'*64,{})) as identity:
   def run(args,*a,**kw):
    if args[0]=='create':return b'b'*64
    if args[0]=='inspect':return json.dumps([{'State':{'ExitCode':0,'Status':'exited'}}]).encode()
    return b'backup-bytes'
   with patch.object(m,'docker',side_effect=run) as docker:
    result=m.backup();identity.assert_called_once_with('pg')
    calls=[x.args[0] for x in docker.call_args_list]
    self.assertTrue(any(x==['rm','-v','b'*64] for x in calls));self.assertFalse(any(x[:2]==['volume','rm'] for x in calls))
    receipt=json.loads((Path(t)/result['backup']/'receipt.json').read_text());self.assertEqual(receipt['state'],'ACKNOWLEDGED');self.assertEqual(receipt['writers'],'STOPPED')

if __name__=='__main__':unittest.main()
