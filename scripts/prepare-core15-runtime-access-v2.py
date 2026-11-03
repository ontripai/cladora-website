from pathlib import Path
import hashlib
s=Path('supabase/install/core-functional-runtime-v1/02-session-runtime-access.sql').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='b7cf676aa64308ebdeefc08383966660c11e19775e1257ddb69606e231a5fd44','accepted02 identity'
s=s.replace("current_database()!~'^cladora_dev_[a-z0-9_]+$'","current_database()<>'postgres'").replace('postgres','cladora_core_installer')
# Restore the database literal; logical owner mapping must not rename a database.
s=s.replace("current_database()<>'cladora_core_installer'","current_database()<>'postgres'")
a=s.index("  OR NOT has_column_privilege(current_user,'auth.sessions','id','UPDATE')")
b=s.index("  OR NOT has_schema_privilege('cladora_core_runtime','auth','USAGE')",a)
s=s[:a]+"""  OR NOT has_schema_privilege(current_user,'core_runtime','USAGE')
  OR NOT has_function_privilege(current_user,'core_runtime.lock_request_session_v1()','EXECUTE')
  OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_class c ON c.oid='auth.sessions'::regclass
    WHERE p.oid='core_runtime.lock_request_session_v1()'::regprocedure AND p.proowner=c.relowner
     AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND c.relrowsecurity AND NOT c.relforcerowsecurity)
"""+s[b:]
a=s.index('AS $session$');b=s.index('$session$;',a)
s=s[:a]+"""AS $session$
BEGIN
 -- Exact existing private Auth-owned session/lock guard. No row-policy bypass,
 -- caller-time parameter, parallel authority or direct runtime Auth SELECT.
 PERFORM core_runtime.lock_request_session_v1();
END
"""+s[b:]
s=s.replace("   AND a.grantee='cladora_core_runtime'::regrole)\n OR EXISTS(SELECT 1 FROM pg_policy", "   AND a.grantee='cladora_core_runtime'::regrole\n   AND p.oid NOT IN ('app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure,\n    'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure))\n OR EXISTS(SELECT 1 FROM pg_policy")
for name in ['app_private.require_request_session_current_at_v1(timestamptz)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)']:
 s=s.replace(' '+name+',\n','')
s=s.replace(',\n customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)\n TO','\n TO')
assert 'row_security_active' not in s
assert 'customer_api.resolve_canonical_resource_reference_v1' not in s
output='-- Core15 real Platform12 access successor: exact ordinary installer + existing Auth-owner guard.\n'+s
assert hashlib.sha256(output.encode()).hexdigest()=='da89067ca7326cb27b4dea8a751cba47ae3c0c1e4df38ce79967fab57aec3d1c','exact native-proved derivative identity'
Path('supabase/install/core-functional-runtime-v1/service-native-v3/07-runtime-access.sql').write_text(output)
