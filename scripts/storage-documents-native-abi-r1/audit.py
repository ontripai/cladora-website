"""Sanitize the fixed private catalog review; never exports function bodies/OIDs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = Path('/workspace/private/platform-storage-documents-native-abi-15/acl-r1')


def digest(b):
 return hashlib.sha256(b).hexdigest()


def canonical(v):
 if isinstance(v, dict):
  return {k: canonical(x) for k, x in sorted(v.items())}
 if isinstance(v, list):
  return sorted((canonical(x) for x in v), key=lambda x: json.dumps(x, sort_keys=True))
 return v


def fingerprint(v):
 return digest(json.dumps(canonical(v), sort_keys=True, separators=(',', ':')).encode())


FUNCTION_SCOPE = {
 'allow_any_operation': 'Compares operation labels, not actor authority; invoker. Operation GUC is not an authorization envelope.',
 'allow_only_operation': 'Operation-label predicate only; no actor/tenant binding; invoker.',
 'can_insert_object': 'Attempts caller-scoped object INSERT then raises rollback sentinel. No own actor authorization; table ACL/RLS still required.',
 'enforce_bucket_lifecycle_service_role': 'Trigger checks current role against configured trigger role argument; bucket control columns. Not an actor ownership check.',
 'enforce_bucket_name_length': 'Trigger validates bucket name length; no actor/scope authority.',
 'enforce_versioning_status_transition': 'Trigger restricts versioning transitions; no actor authorization.',
 'extension': 'Pure path/string helper; no actor authorization or row access.',
 'filename': 'Pure path/string helper; no actor authorization or row access.',
 'foldername': 'Pure path/string helper; no actor authorization or row access.',
 'get_common_prefix': 'Pure prefix helper; no actor authorization or row access.',
 'get_size_by_bucket': 'Caller-selected bucket/version filters and object aggregation; no actor predicate of its own; invoker ACL/RLS boundary.',
 'list_multipart_uploads_with_delimiter': 'Caller-supplied bucket/prefix/cursor filters; invoker multipart-table RLS, not a canonical actor check.',
 'list_objects_with_delimiter': 'Bucket/prefix/version/cursor filters with dynamic SELECT; no actor identity check; invoker object RLS. Not a SQL-injection certification.',
 'operation': 'Reads storage.operation GUC; pure status label, not authority.',
 'protect_bucket_control_columns': 'Trigger checks configured-role membership for lifecycle insertion and bucket/version/lifecycle consistency. Not a user membership verifier.',
 'protect_delete': 'Trigger denies direct deletion unless provider sets allow_delete_query. GUC is a safety latch, not owner/actor authority.',
 'search_by_timestamp': 'Parameterized dynamic SELECT and sort/filter construction; caller bucket/prefix filters; invoker RLS; no own actor predicate.',
 'search': 'Dynamic listing/filter branches; caller bucket/prefix/version filters, invoker RLS; no own actor predicate. No broad injection-safety claim.',
 'search_v2': 'Delegates to invoker listing/search helpers; caller scope arguments do not establish actor authority.',
 'update_updated_at_column': 'Timestamp trigger; no actor or tenant authorization.',
}


def sanitize(v, extra_roles):
 all_roles = v['roles'] + extra_roles
 roles = {str(r['oid']): r['name'] for r in all_roles}
 roles['0'] = 'PUBLIC'
 attrs = {r['name']: {k: x for k, x in r.items() if k != 'oid'} for r in all_roles}
 def role(oid):
  if str(oid) not in roles:
   raise ValueError('UNREVIEWED_ACL_ROLE')
  return roles[str(oid)]
 reach = v['role_reachability']
 def grants(x):
  expanded = [{**a, 'grantee': role(a['grantee']), 'grantor': role(a['grantor'])} for a in x['acl_expanded']]
  result = {}
  for principal in ('anon', 'authenticated', 'service_role', 'supabase_storage_admin'):
   inherited = {a['role'] for a in reach if a['principal'] == principal and a['usage'] and a['role'] != principal}
   result[principal] = {
    'direct': [a for a in expanded if a['grantee'] == principal],
    'inherited': [a for a in expanded if a['grantee'] in inherited],
    'public': [a for a in expanded if a['grantee'] == 'PUBLIC'],
    'owner': role(x['owner']) == principal,
   }
  return result
 relations = []
 for x in v['relations']:
  relations.append({'name': 'storage.' + x['name'], 'kind': x['kind'], 'owner': role(x['owner']),
   'owner_attributes': attrs[role(x['owner'])], 'acl_representation': 'NULL_DEFAULT' if x['acl'] is None else 'EXPLICIT', 'access': grants(x),
   'acl_summary': [{**a, 'grantee': role(a['grantee']), 'grantor': role(a['grantor'])} for a in x['acl_expanded']],
   'rls': x['rls'], 'force_rls': x['force_rls'],
   'policies': [{'name': p['name'], 'command': p['command'], 'permissive': p['permissive'],
    'roles': [role(r) for r in p['roles']], 'using_sha256': digest((p['using'] or '').encode()),
    'check_sha256': digest((p['check'] or '').encode())} for p in (x['policies'] or [])],
   'column_acl_count': sum(a['acl'] is not None for a in x['columns']),
   'catalog_shape_sha256': fingerprint(x),
   'effect': 'Owner bypasses non-FORCE RLS. Non-owner DML default-denied with no policies. RLS does not constrain TRUNCATE/REFERENCES/TRIGGER/MAINTAIN.',
  })
 functions = []
 for x in v['functions']:
  if x['name'] not in FUNCTION_SCOPE:
   raise ValueError('UNREVIEWED_FUNCTION')
  functions.append({'signature': x['signature'], 'result': x['result'], 'owner': role(x['owner']),
   'owner_attributes': attrs[role(x['owner'])], 'access': grants(x), 'raw_acl_is_null': x['acl'] is None,
   'security': 'DEFINER' if x['security_definer'] else 'INVOKER',
   'search_path': x['config'] if x['config'] else 'AMBIENT_NOT_PINNED',
   'language': x['language'], 'definition_bytes': len(x['definition'].encode()),
   'definition_sha256': digest(x['definition'].encode()), 'scope_review': FUNCTION_SCOPE[x['name']],
   'execution_in_native_harness': 'NO_DIRECT_FUNCTION_INVOCATION; existing table triggers may fire',
  })
 return {'format': 'platform15.acl-review.v1',
  'private_snapshot_sha256': fingerprint(v), 'relations': relations, 'functions': functions,
  'sequences': [r['name'] for r in relations if r['kind'] == 'S'],
  'custom_default_acl': v['default_acl'] or [],
  'implicit_defaults': {'functions': 'NULL proacl expands to owner EXECUTE and PUBLIC EXECUTE; not NO_PRIVILEGES',
   'relations': 'NULL relacl is owner-only default; migrations has no client grant',
   'namespace': 'NULL nspacl is owner USAGE/CREATE only'},
  'membership': v['membership'], 'reachability': reach,
  'additional_principals': [attrs[r['name']] for r in extra_roles],
  'schema_owner': role(v['namespace']['owner']), 'schema_acl_representation': 'NULL_DEFAULT' if v['namespace']['acl'] is None else 'EXPLICIT',
  'shared_schema_grant_status': 'PROPOSED_NOT_APPROVED_NOT_EXECUTED',
 }


if __name__ == '__main__':
 v = json.loads((PRIVATE / 'catalog.private.json').read_text())
 out = sanitize(v, json.loads((PRIVATE/'principal-review.private.json').read_text()))
 path = ROOT / 'docs/testing/platform-storage-documents-native-abi-15.r1.acl-review.json'
 path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
 print('SAFE_PER_OBJECT_REVIEW_WRITTEN; raw bodies retained privately')
