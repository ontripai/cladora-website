#!/usr/bin/env python3
"""Owned disposable PG17 install test. No existing container/port/volume/secret used."""
import argparse,hashlib,json,os,pathlib,re,secrets,subprocess,time,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
PG='postgres@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416'
AUTH='supabase/gotrue@sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f'
ENV={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
DOCKER=['docker','--host=unix:///var/run/docker.sock']
def run(args,**kw):return subprocess.run(args,env=ENV,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw)
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--accepted-source',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 out=pathlib.Path(a.output).resolve();out.mkdir(parents=True,exist_ok=False);os.chmod(out,0o700)
 token=uuid.uuid4().hex;prefix='core-guide-r3-'+token[:12];marker='core15-dev:'+token;pg=prefix+'-pg';auth=prefix+'-auth';net=prefix+'-net'
 packet={name:(ROOT/'supabase/install/guide-no-document-v1'/name).read_text() for name in ['00-fixed-roles.sql','05-owner-delegations.sql','08-audience-dependency.sql','10-guide-core.sql','20-save-relation.sql','preflight.sql','verify.sql']}
 pw={x:secrets.token_hex(24) for x in ['pg','auth','installer','runtime']};owned=[];events=[];stage='admission'
 def private(name,text):f=out/name;f.write_text(text);os.chmod(f,0o600);return f
 def sql(text,user='postgres',label='query',expect=True):
  # Every dispatch binds to the exact freshly created container identity/label.
  info=json.loads(run(DOCKER+['inspect',pg]).stdout)[0]
  assert info['Config']['Labels']['cladora.run']==token and info['Config']['Labels']['cladora.task']=='guide-install-r3'
  command=DOCKER+['exec','-i']
  if user!='postgres':command+=['--env-file',str(private('psql-'+user+'.env','PGPASSWORD='+pw['runtime' if user=='cladora_ce_guide_runtime' else 'installer']+'\n'))]
  command+=[pg,'psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-d','postgres','-U',user]
  if user!='postgres':command+=['-h','127.0.0.1']
  r=subprocess.run(command,input=text.encode(),env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  private(label+'.stdout',r.stdout.decode(errors='replace'));private(label+'.stderr',r.stderr.decode(errors='replace'))
  events.append(dict(case=label,principal=user,payload_bytes=len(text.encode()),payload_sha256=sha(text.encode()),exit=r.returncode,sqlstate=(re.search(rb'ERROR:\s+([A-Z0-9]{5}):',r.stderr).group(1).decode() if re.search(rb'ERROR:\s+([A-Z0-9]{5}):',r.stderr) else None)))
  if expect and r.returncode:raise RuntimeError('SQL case failed: '+label)
  if not expect:assert r.returncode!=0,label
  return r
 try:
  run(DOCKER+['info','--format','{{.ServerVersion}}']);
  for image in [PG,AUTH]:run(DOCKER+['image','inspect',image])
  assert not json.loads(run(DOCKER+['ps','-a','--filter','name='+prefix,'--format','json']).stdout or b'null')
  run(['node','scripts/lib/core-guide-lab-prestate-v1.mjs',a.accepted_source,str(out/'derived')],cwd=ROOT)
  run(DOCKER+['network','create','--internal','--label','cladora.run='+token,net]);owned.append(('network',net))
  pg_env=private('pg.env','POSTGRES_PASSWORD='+pw['pg']+'\nPOSTGRES_DB=postgres\n')
  run(DOCKER+['run','-d','--pull=never','--name',pg,'--label','cladora.task=guide-install-r3','--label','cladora.run='+token,'--network',net,'--network-alias','pg','--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,size=512m','--env-file',str(pg_env),PG]);owned.append(('container',pg))
  for _ in range(60):
   r=subprocess.run(DOCKER+['exec',pg,'pg_isready','-h','127.0.0.1','-U','postgres'],env=ENV,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   if r.returncode==0:break
   time.sleep(0.5)
  else:raise RuntimeError('fresh PG startup failed')
  stage='official-platform-bootstrap';sql((ROOT/'scripts/functional-dev-stack-v1/bootstrap.sql').read_text(),label='platform-bootstrap')
  sql("ALTER ROLE supabase_auth_admin PASSWORD '"+pw['auth']+"';",label='private-auth-password')
  env=private('auth.env','\n'.join(['GOTRUE_API_HOST=0.0.0.0','GOTRUE_API_PORT=9999','API_EXTERNAL_URL=http://localhost:9999/auth/v1','GOTRUE_SITE_URL=http://localhost:3000','GOTRUE_DB_DRIVER=postgres','GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:'+pw['auth']+'@pg:5432/postgres?sslmode=disable','GOTRUE_DB_NAMESPACE=auth','GOTRUE_JWT_SECRET='+secrets.token_hex(32),'GOTRUE_JWT_AUD=authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','GOTRUE_JWT_ADMIN_ROLES=service_role','GOTRUE_DISABLE_SIGNUP=true','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','GOTRUE_EXTERNAL_PHONE_ENABLED=false','GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false'])+'\n')
  run(DOCKER+['run','-d','--pull=never','--name',auth,'--label','cladora.run='+token,'--network',net,'--memory','384m','--cpus','1','--env-file',str(env),AUTH]);owned.append(('container',auth))
  for _ in range(80):
   r=sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='sessions';",label='auth-migration-observe')
   logs=run(DOCKER+['logs',auth])
   if re.search(rb'\n\s+1\s*\n',r.stdout) and b'gotrue api started' in (logs.stdout+logs.stderr).lower():break
   time.sleep(0.5)
  else:raise RuntimeError('official Auth schema migration not ready')
  sql((ROOT/'scripts/functional-dev-stack-v1/provider-compatibility.sql').read_text(),label='provider-compatibility')
  config="SELECT set_config('cladora.core15.owned_backend','"+marker+"',false);\n"
  sql(config+(ROOT/'supabase/install/core-functional-runtime-v1/04-session-bootstrap.sql').read_text(),label='accepted-session-bootstrap')
  sql(config+(ROOT/'supabase/install/core-functional-runtime-v1/05-session-auth-owner.sql').read_text(),label='accepted-session-owner')
  sql("COMMENT ON SCHEMA core_runtime IS '"+marker+"';",label='private-lab-marker')
  oid='5';bind="SELECT set_config('cladora.install.target','"+marker+"',false),set_config('cladora.install.target_oid','5',false),set_config('cladora.install.unit','foundation',false);\n"
  sql(bind+(ROOT/'supabase/install/core-functional-runtime-v1/service-native-v3/installer-prerequisites.sql').read_text(),label='accepted-installer-prerequisites')
  sql("ALTER ROLE cladora_core_installer PASSWORD '"+pw['installer']+"';",label='private-installer-password')
  stage='accepted-foundation-prestate'
  foundation=(out/'derived/foundation.sql').read_text();a=foundation.index("select set_config('cladora.install.catalog_before',");b=foundation.index('\ndo $catalog_entry$',a)
  # Actual same-PID read-only observation, as the accepted Core15 transport;
  # psql variables retain its hash across acknowledged ROLLBACK. No fake catalog.
  observation="\\o /dev/null\nBEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"+foundation[a:b]+"\nSELECT encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_before'),'UTF8'),'sha256'),'hex') AS actual_prestate \\gset\nROLLBACK;\n\\o\n"
  bindings="SELECT set_config('cladora.install.prestate_sha256',:'actual_prestate',false),set_config('cladora.install.native_binding',jsonb_build_object('contract','core-guide-disposable-lab-prestate.v1','principal',current_user,'pid',pg_backend_pid(),'version',current_setting('server_version_num'),'payload_sha256','"+sha(foundation.encode())+"','compiled_oracle','NOT_CLAIMED')::text,false),set_config('cladora.install.operator_binding','CORE-DOMAIN-PORTS-01/R3 explicit disposable lab only',false),set_config('cladora.install.execution_binding',jsonb_build_object('run','"+token+"','pid',pg_backend_pid(),'unit','foundation')::text,false);\n"
  sql(bind+observation+bindings+foundation,'cladora_core_installer','accepted-foundation')
  sql((out/'derived/module-registry.sql').read_text(),'cladora_core_installer','accepted-module-dependency')
  sql((out/'derived/canonical-sqlstate.sql').read_text(),'cladora_core_installer','accepted-sqlstate-boundary')
  sql((ROOT/'supabase/install/core-functional-runtime-v1/service-native-v3/06-session-authority-delegation.sql').read_text(),label='accepted-session-delegation')
  plan=sha(packet['10-guide-core.sql'].encode())
  cfg="SELECT set_config('cladora.guide.target_marker','"+marker+"',false),set_config('cladora.guide.target_oid','5',false),set_config('cladora.guide.installer','cladora_core_installer',false),set_config('cladora.guide.lifecycle_principal','postgres',false),set_config('cladora.guide.plan_sha256','"+plan+"',false);\n"
  stage='guide-preflight';sql(cfg+packet['preflight.sql'],'cladora_core_installer','guide-preflight')
  for unit,user in [('00-fixed-roles.sql','postgres'),('05-owner-delegations.sql','postgres'),('08-audience-dependency.sql','cladora_core_installer'),('10-guide-core.sql','cladora_core_installer'),('20-save-relation.sql','cladora_core_installer')]:
   stage=unit
   if unit=='10-guide-core.sql':
    fault=packet[unit].replace('COMMIT;\n',"DO $fault$ BEGIN RAISE EXCEPTION 'controlled_guide_unit_abort'; END $fault$;\nCOMMIT;\n")
    assert fault!=packet[unit]
    rejected=sql(cfg+fault,user,'native-full-guide-unit-rollback',False);assert b'controlled_guide_unit_abort' in rejected.stderr
    sql("DO $pre$ BEGIN IF to_regnamespace('experience') IS NOT NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor') THEN RAISE EXCEPTION 'guide_failed_unit_prestate_not_restored'; END IF; END $pre$;",label='native-full-unit-prestate-readback')
   sql(cfg+packet[unit],user,unit)
  stage='verify';sql(cfg+packet['verify.sql'],'cladora_core_installer','guide-verify')
  stage='limited-role-and-RLS-cases'
  sql("ALTER ROLE cladora_ce_guide_runtime PASSWORD '"+pw['runtime']+"';",label='private-runtime-password')
  # Actual authenticated database principal; no SET SESSION AUTHORIZATION or
  # issuer/session fixture is used to claim real application authentication.
  sql("BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; SELECT app_private.assert_ce_guide_role_safety_v1(); SELECT app_private.acquire_ce_guide_role_safety_lease_v1(); ROLLBACK;",'cladora_ce_guide_runtime','native-fixed-role-safety')
  sql("BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; SELECT g.id FROM identity.context_grants g JOIN identity.memberships m ON m.id=g.membership_id JOIN platform.customer_workspaces w ON w.tenant_id=m.tenant_id FOR SHARE OF g,m,w; SELECT revision FROM app_private.canonical_authority_revision_v1 WHERE singleton FOR SHARE; ROLLBACK;",'cladora_ce_guide_runtime','native-discovery-FOR-SHARE')
  bad="BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; INSERT INTO experience.guides(id,tenant_id,workspace_id,title,audience,created_by) VALUES('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','Synthetic unauthorized Guide','{\"kind\":\"workspace\"}','20000000-0000-4000-8000-000000000001'); COMMIT;"
  denied=sql(bad,'cladora_ce_guide_runtime','native-guide-no-session-denial',False)
  assert b'row-level security' in denied.stderr.lower() and b'42501' in denied.stderr,'wrong failure must not count as denial'
  missing="BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; SELECT app_private.require_request_session_current_at_v1(clock_timestamp()); ROLLBACK;"
  denied=sql(missing,'cladora_ce_guide_runtime','native-canonical-session-denial',False)
  assert b'request_session_not_current' in denied.stderr and b'42501' in denied.stderr,'wrong session fault'
  sql("DO $zero$ BEGIN IF EXISTS(SELECT 1 FROM experience.guides) OR EXISTS(SELECT 1 FROM experience.guide_steps) OR EXISTS(SELECT 1 FROM experience.guide_references) OR EXISTS(SELECT 1 FROM experience.guide_save_receipts_v1) THEN RAISE EXCEPTION 'guide_denial_residue'; END IF; END $zero$;",label='native-denial-zero-residue')
  # Single-unit transaction failure: ordinary server state and previously
  # committed schema must survive. This is not rollback of committed business.
  failed=sql("BEGIN; CREATE TABLE experience.core_guide_test_abort(id int); DO $abort$ BEGIN RAISE EXCEPTION 'controlled_lab_abort'; END $abort$; COMMIT;",'cladora_core_installer','native-install-rollback-oracle',False)
  assert b'controlled_lab_abort' in failed.stderr
  sql("DO $intact$ BEGIN IF to_regclass('experience.core_guide_test_abort') IS NOT NULL OR to_regclass('experience.guide_save_receipts_v1') IS NULL THEN RAISE EXCEPTION 'install_rollback_oracle_failed'; END IF; END $intact$;",label='native-rollback-preserves-committed-units')
  sql('ALTER ROLE cladora_ce_guide_runtime INHERIT;',label='test-only-inherit-drift')
  invalid=sql('BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; SELECT app_private.assert_ce_guide_role_safety_v1(); ROLLBACK;','cladora_ce_guide_runtime','native-role-inherit-denial',False)
  assert b'42501' in invalid.stderr and b'core_platform_role_safety_invalid' in invalid.stderr
  sql('ALTER ROLE cladora_ce_guide_runtime NOINHERIT;',label='test-only-inherit-restore')
  sql('GRANT cladora_ce_guide_executor TO cladora_ce_guide_runtime WITH ADMIN TRUE, INHERIT FALSE, SET TRUE;',label='test-only-admin-drift')
  invalid=sql('BEGIN; SET LOCAL ROLE cladora_ce_guide_executor; SELECT app_private.assert_ce_guide_role_safety_v1(); ROLLBACK;','cladora_ce_guide_runtime','native-role-admin-denial',False)
  assert b'42501' in invalid.stderr and b'core_platform_role_safety_invalid' in invalid.stderr
  sql('GRANT cladora_ce_guide_executor TO cladora_ce_guide_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;',label='test-only-admin-restore')
  sql(cfg+packet['verify.sql'],'cladora_core_installer','native-final-verify-after-fault-restoration')
  stage='complete'
 except Exception as error:
  events.append(dict(stage=stage,error_type=type(error).__name__,message=str(error)[:180]));raise
 finally:
  for kind,name in reversed(owned):
   try:
    if kind=='container':run(DOCKER+['rm','-f',name])
    else:run(DOCKER+['network','rm',name])
    events.append(dict(cleanup=kind,result='ACK'))
   except Exception:events.append(dict(cleanup=kind,result='UNKNOWN'))
  (out/'receipt.json').write_text(json.dumps(dict(contract='core-guide-disposable-pg17.v1',stage=stage,packet={name:{'bytes':len(text.encode()),'sha256':sha(text.encode())} for name,text in packet.items()},events=events,shared_target_calls=0,Auth_HTTP='NOT_RUN',native_Guide_UI='NOT_RUN',activation=None),indent=2)+'\n')
if __name__=='__main__':main()
