/** Semantic negatives for the NEW session cut; not a substitute for native evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bootstrap=read('supabase/install/core-functional-runtime-v1/04-session-bootstrap.sql');
const repair=read('supabase/install/core-functional-runtime-v1/05-session-auth-owner.sql');
const runtime=read('src/lib/core/authenticated-session-runtime-v1.ts');
const native=read('scripts/prove-core15-authenticated-session-native-v1.mjs');
let n=0;const check=(name,f)=>{f();console.log(`PASS ${++n} ${name}`);};
function validate(sql){
 assert.match(sql,/ALTER FUNCTION core_runtime\.lock_request_session_v1\(\) OWNER TO supabase_auth_admin;/);
 assert.match(sql,/REVOKE CREATE ON SCHEMA core_runtime FROM supabase_auth_admin;/);
 assert.match(sql,/has_column_privilege\('cladora_core_runtime','auth.sessions','id','SELECT'\)/);
 assert.match(sql,/TABLE pg_default_acl EXCEPT TABLE core15_defaults_before/);
 assert.match(sql,/TABLE pg_auth_members EXCEPT TABLE core15_roles_before/);
 assert.match(sql,/core15_auth_before/);assert.match(sql,/core15_bodies_before/);
 assert.doesNotMatch(sql,/DISABLE ROW LEVEL SECURITY|BYPASSRLS\s*;|GRANT\s+[^;]+\s+TO\s+(?:PUBLIC|cladora_core_runtime)\s+WITH GRANT OPTION|ALTER DEFAULT PRIVILEGES/i);
 assert.doesNotMatch(sql,/GRANT\s+[^;]+ON\s+(?:TABLE\s+)?auth\.sessions[^;]+TO\s+cladora_core_runtime/is);
}
check('closed Auth-owner encapsulation; no public access, role delegation or RLS weakening',()=>validate(repair));
for(const [name,mutate] of [
 ['missing CREATE cleanup',s=>s.replace('REVOKE CREATE ON SCHEMA core_runtime FROM supabase_auth_admin;','')],
 ['wrong owner',s=>s.replace('lock_request_session_v1() OWNER TO supabase_auth_admin','lock_request_session_v1() OWNER TO cladora_core_runtime')],
 ['runtime direct Auth grant',s=>s+'\nGRANT SELECT ON auth.sessions TO cladora_core_runtime;'],
 ['RLS disabled',s=>s+'\nALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;'],
 ['default ACL mutation',s=>s+'\nALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;'],
 ['missing membership equality',s=>s.replace('TABLE pg_auth_members EXCEPT TABLE core15_roles_before','SELECT * FROM pg_auth_members WHERE false')]
])check('coherent source negative: '+name,()=>assert.throws(()=>validate(mutate(repair))));
check('DB clock after real session lock and canonical recheck; raw time helper not exposed',()=>{
 const lock=bootstrap.indexOf('FOR SHARE;'),clock=bootstrap.indexOf('at_time:=clock_timestamp();');assert.ok(lock>0&&clock>lock);
 assert.ok(bootstrap.indexOf('require_request_session_current_at_v1(at_time)',clock)>clock);
 assert.match(bootstrap,/require_request_session_current_at_v1\(timestamptz\) FROM PUBLIC,anon,authenticated,service_role,cladora_core_runtime/);
 assert.doesNotMatch(runtime,/Date\.now|new Date|service_role/);
});
check('actual native proof requires SDK, observed row lock, SQLSTATE and RFQ, not mocks',()=>{
 for(const p of [/from '@supabase\/supabase-js'/,/from 'pg'/,/wait_event_type='Lock'/,/e\.code==='40001'/,/e\.status==='I'/,/auth\.signOut\(\{scope:'local'\}\)/])assert.match(native,p);
 assert.doesNotMatch(native,/__core15_test_auth_transport|fake\w*token|mockAuth/);
});
console.log(JSON.stringify({checks:n,kind:'SOURCE_ONLY',native:'SEPARATE_PINNED_RECEIPT'}));
