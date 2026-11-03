"""Closed SQL proposal renderer; source only until exact curated admission.

No SQL/file/target arguments. Run identifiers and existing synthetic actor IDs
come only from the custodian's private candidate, never from a consumer request.
"""
import re
from pathlib import Path
from recovery import CATALOGS, CONTRACT

NON_DML = ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
POLICIES = (
 ('objects', 'actor_read', 'SELECT', 'authenticated'),
 ('objects', 'actor_insert', 'INSERT', 'authenticated'),
 ('objects', 'service_read', 'SELECT', 'service_role'),
 ('objects', 'service_insert', 'INSERT', 'service_role'),
 ('objects', 'service_delete', 'DELETE', 'service_role'),
 ('buckets', 'service_read', 'SELECT', 'service_role'),
 ('buckets', 'service_delete', 'DELETE', 'service_role'),
)


def need(ok, why):
 if not ok:
  raise ValueError(why)


def literal(s):
 need(isinstance(s, str) and '\0' not in s, 'SQL_LITERAL')
 return "'" + s.replace("'", "''") + "'"


def validate(f):
 need(set(f) == {'run', 'bucket', 'path', 'actor_a', 'actor_b'}, 'FIXTURE_KEYS')
 need(re.fullmatch('[0-9a-f]{32}', f['run']), 'RUN')
 need(f['bucket'] == 'platform15-' + f['run'], 'BUCKET')
 need(f['path'] == 'owned/fixture.png', 'OBJECT_PATH')
 for k in ('actor_a', 'actor_b'):
  need(re.fullmatch('[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', f[k]), 'ACTOR_UUID')
 need(f['actor_a'] != f['actor_b'], 'DISTINCT_ACTORS')


def target_guard(target):
 need(set(target) == {'system_identifier', 'database_oid'}, 'SQL_TARGET_KEYS')
 need(all(re.fullmatch('[0-9]+', str(x)) for x in target.values()), 'SQL_TARGET_IDENTITY')
 return """DO $p15$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR current_setting('server_version_num')::int<>170011
 OR (SELECT system_identifier::text FROM pg_control_system())<>%s
 OR (SELECT oid::text FROM pg_database WHERE datname=current_database())<>%s
 THEN RAISE EXCEPTION 'p15_foreign_target'; END IF;
 END $p15$;
""" % (literal(str(target['system_identifier'])), literal(str(target['database_oid'])))


def relation_acl_guard(v):
 out = []
 for r in v['relations']:
  acl = 'NULL::aclitem[]' if r['acl'] is None else 'ARRAY[' + ','.join(literal(x) for x in r['acl']) + ']::aclitem[]'
  out.append("IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname=%s AND c.oid=%s AND c.relowner=%s AND c.relacl IS NOT DISTINCT FROM %s AND c.relrowsecurity AND NOT c.relforcerowsecurity) THEN RAISE EXCEPTION 'p15_relation_prestate'; END IF;" % (literal(r['name']), int(r['oid']), int(r['owner']), acl))
 return '\n'.join(out)


def definition_guard(review):
 pairs = ','.join('(%s,%s)' % (literal(x['signature']), literal(x['definition_sha256'])) for x in review['functions'])
 helper = review['actor_helper']
 need(helper['signature'] == 'auth.uid()' and helper['security_definer'] is False
  and helper['owner'] == 'supabase_auth_admin' and helper['owner_superuser'] is False
  and helper['owner_bypassrls'] is False and helper['authenticated_execute'] is True
  and helper['authenticated_auth_schema_usage'] is True
  and re.fullmatch('[0-9a-f]{64}', helper['definition_sha256']), 'ACTOR_HELPER_BINDING')
 return ("""IF EXISTS(SELECT 1 FROM (VALUES %s) e(signature,sha)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR p.prosecdef OR encode(extensions.digest(convert_to(pg_get_functiondef(p.oid),'UTF8'),'sha256'),'hex')<>e.sha)
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='storage')<>20
 THEN RAISE EXCEPTION 'p15_definition_drift'; END IF;""" % pairs) + "\nIF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='auth.uid()'::regprocedure AND NOT prosecdef AND encode(extensions.digest(convert_to(pg_get_functiondef(oid),'UTF8'),'sha256'),'hex')=%s) THEN RAISE EXCEPTION 'p15_actor_helper_drift'; END IF;" % literal(helper['definition_sha256'])


def wrap(body, target, review):
 return ('BEGIN;\nSET LOCAL lock_timeout=\'3s\';\nSET LOCAL statement_timeout=\'10s\';\n' +
  target_guard(target) + 'DO $p15$ BEGIN\n' + definition_guard(review) + '\nEND $p15$;\n' + body + '\nCOMMIT;\n').encode()


def recovery_sql(body, target, review):
 # READ COMMITTED is essential: a writer which commits while LOCK waits must
 # be visible to the subsequent complete prestate SELECT. No stale RR snapshot.
 begin = ("BEGIN ISOLATION LEVEL READ COMMITTED;\nSET LOCAL lock_timeout='3s';\n"
  "SET LOCAL statement_timeout='10s';\nSET LOCAL idle_in_transaction_session_timeout='5s';\n"
  'LOCK TABLE ' + ','.join('pg_catalog.' + n for n in CATALOGS) +
  ' IN SHARE ROW EXCLUSIVE MODE;\n').encode()
 effect = (target_guard(target) + 'DO $p15$ BEGIN\n' + definition_guard(review) +
  '\nEND $p15$;\n' + body + '\nRESET ROLE;\n').encode()
 return {'recovery_begin': begin, 'recovery_state': Path(__file__).with_name('catalog-review.sql').read_bytes(),
  'acl_recover': effect, 'recovery_commit': b'COMMIT;\n'}


def render(v, review, f, target):
 validate(f)
 need(len(v['relations']) == 10 and len(v['functions']) == 20, 'CATALOG_SCOPE')
 need(not v['default_acl'] and v['namespace']['acl'] is None, 'BASELINE_DEFAULT_ACL')
 need(all(not x['policies'] and x['rls'] and not x['force_rls'] for x in v['relations']), 'BASELINE_RLS')
 need(all(not x['security_definer'] for x in v['functions']), 'BASELINE_DEFINER')
 # Resolve role OID from the actual catalog rather than relying on the historical value.
 service_oid = next(str(r['oid']) for r in v['roles'] if r['name'] == 'service_role')
 harden = [r for r in v['relations'] if any(a['privilege_type'] in NON_DML and str(a['grantee']) == service_oid for a in r['acl_expanded'])]
 need(len(harden) == 7, 'NON_DML_SCOPE_DRIFT')
 guard = "DO $p15$ BEGIN\n" + relation_acl_guard(v) + "\nIF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='storage' AND nspacl IS NULL AND pg_get_userbyid(nspowner)='supabase_storage_admin') OR EXISTS(SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage') THEN RAISE EXCEPTION 'p15_namespace_policy_prestate'; END IF;\nEND $p15$;\n"
 expected_harden = {'buckets','buckets_analytics','iceberg_namespaces','iceberg_tables','objects','s3_multipart_uploads','s3_multipart_uploads_parts'}
 need({r['name'] for r in harden} == expected_harden, 'NAMED_NON_DML_SCOPE')
 apply = guard + Path(__file__).with_name('acl-delta.v1.sql').read_text()
 apply += "DO $p15$ BEGIN IF NOT has_schema_privilege('authenticated','storage','USAGE') OR NOT has_schema_privilege('service_role','storage','USAGE') THEN RAISE EXCEPTION 'p15_usage_poststate'; END IF; END $p15$;"
 bucket, path, actor = literal(f['bucket']), literal(f['path']), literal(f['actor_a'])
 fixture = "DO $p15$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id=%s) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=%s) THEN RAISE EXCEPTION 'p15_existing_fixture'; END IF; END $p15$;\n" % (bucket, bucket)
 fixture += "INSERT INTO storage.buckets(id,name,public,owner_id,file_size_limit,allowed_mime_types,versioning_status) VALUES(%s,%s,false,%s,4096,ARRAY['image/png'],'DISABLED');\n" % (bucket, bucket, actor)
 policy_names = []
 for table, suffix, cmd, role in POLICIES:
  name = 'p15_' + f['run'][:12] + '_' + table + '_' + suffix
  policy_names.append({'table': table, 'name': name, 'command': cmd, 'role': role})
  cond = ('bucket_id=%s AND name=%s AND owner_id=%s' % (bucket, path, actor)) if table == 'objects' else ('id=%s AND name=%s AND owner_id=%s AND NOT public AND versioning_status=\'DISABLED\'' % (bucket, bucket, actor))
  if role == 'authenticated':
   cond += ' AND (SELECT auth.uid())=' + actor + '::uuid'
  fixture += 'CREATE POLICY ' + name + ' ON storage.' + table + ' FOR ' + cmd + ' TO ' + role + (' WITH CHECK (' if cmd == 'INSERT' else ' USING (') + cond + ');\n'
 drop = "DO $p15$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id=%s) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=%s) THEN RAISE EXCEPTION 'p15_fixture_residue_cleanup_hold'; END IF; END $p15$;\n" % (bucket, bucket)
 for p in policy_names:
  drop += 'DROP POLICY ' + p['name'] + ' ON storage.' + p['table'] + ';\n'
 recover = Path(__file__).with_name('acl-recovery.v1.sql').read_text()
 for r in harden:
  # Original expanded ACL states exactly which privileges/options were present.
  grants = [a for a in r['acl_expanded'] if str(a['grantee']) == service_oid and a['privilege_type'] in NON_DML]
  need(all(not a['is_grantable'] and str(a['grantor']) == str(r['owner']) for a in grants), 'INITIAL_GRANTOR_OR_OPTION_UNSUPPORTED')
  need({a['privilege_type'] for a in grants} == set(NON_DML), 'INITIAL_PRIVILEGE_SET_UNSUPPORTED')
 # The original namespace ACL was NULL. SQL REVOKE restores effective owner ACL,
 # not that physical NULL representation. Never update pg_namespace to hide it.
 return {'sql': {'acl_apply': wrap(apply, target, review), 'fixture_create': wrap(fixture, target, review),
  'fixture_drop_policies': wrap(drop, target, review), **recovery_sql(recover, target, review)},
  'atomic_recovery': CONTRACT,
  'policies': policy_names, 'harden_relations': [r['name'] for r in harden],
  'raw_namespace_recovery': 'NULL_TO_EXPLICIT_OWNER_ACL_REPRESENTATION_REMAINS',
  'effective_namespace_recovery': 'OWNER_USAGE_CREATE_ONLY_SAME_GRANTOR',
  'consumer_object_update_policy': False, 'bucket_insert_update_policies': False,
  'service_object_update_policy': False}
