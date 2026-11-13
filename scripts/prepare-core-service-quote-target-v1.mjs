/** Offline source composer. No network/client/connection/execution, no env/secret reads. */
import{readFileSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import{resolve}from'node:path';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const SERVICE='bd6b9033cc6ca8a4f882cc6efa209a9c8b584f63';
export const SOURCE_PATH='supabase/proposals/service-quote-canonical-store-v1/install.sql';
export const SOURCE_SHA256='ea791090aaa99e5461f81d1fab510e1c33f749016875a490b0d0d2f66aab12de';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const UNITS=['preflight.sql','01-bootstrap-delegation.sql','02-quote-dependencies.sql','03-facades.sql','04-c03-access.sql','05-settle.sql','verify.sql'];
export const read=p=>readFileSync(resolve(ROOT,'supabase/install/service-quote-platform-dev-v1',p),'utf8');
export function source(){return execFileSync('git',['show',SERVICE+':'+SOURCE_PATH],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
function once(s,a,b){if(s.split(a).length!==2)throw Error('CANONICAL_TRANSFORM_AMBIGUOUS');return s.replace(a,()=>b);}
export function adoptCanonical(input){
 if(sha(input)!==SOURCE_SHA256)throw Error('CANONICAL_R10_IDENTITY_MISMATCH');
 let s=input.slice(input.indexOf('begin;')+6,input.lastIndexOf('commit;'));
 const grant=`grant execute on function customer_api.reserve_service_quote_command_v1(jsonb),
  customer_api.read_service_quote_history_v1(uuid,uuid) to authenticated;`;
 s=once(s,grant,'-- Caller EXECUTE belongs only to the two fixed platform_dev façades.');
 const ownerGrant=`grant usage on schema app_private, auth, customer_api, platform, portfolio,
  service_catalog to cladora_service_quote_store_owner;
grant execute on function auth.uid(),
  app_private.require_request_session_current_at_v1(timestamptz),
  app_private.service_request_authorize_v1(uuid,uuid,text)
  to cladora_service_quote_store_owner;`;
 s=once(s,ownerGrant,'-- Fixed custodian delegation already performed in this SAME transaction.');
 const cleanup=/do \$cleanup\$[\s\S]*?\$cleanup\$;/g;
 if([...s.matchAll(cleanup)].length!==1)throw Error('CANONICAL_CLEANUP_AMBIGUOUS');
 s=s.replace(cleanup,()=> '-- Cleanup returns to the actual membership grantor in Core unit05.');
 return s;
}
export function definitions(s){return[...s.matchAll(/create function\s+([a-z_]+\.[a-z_0-9]+)\([\s\S]*?\bas \$\$[\s\S]*?\$\$;/gi)].map(x=>({name:x[1],definition:x[0],sha256:sha(x[0])}));}
export function nativeVerify(input=source()){
 if(sha(input)!==SOURCE_SHA256)throw Error('CANONICAL_R10_IDENTITY_MISMATCH');
 const pins=definitions(input).map(f=>{const body=/as \$\$([\s\S]*?)\$\$/i.exec(f.definition)[1];const signature=f.name+(f.name.endsWith('reserve_service_quote_command_v1')?'(jsonb)':f.name.endsWith('read_service_quote_history_v1')?'(uuid,uuid)':'()');return `IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='${signature}'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '${sha(body)}' THEN RAISE EXCEPTION 'core_quote_canonical_body_changed' USING ERRCODE='55000'; END IF;`;}).join('\n');
 const facadePins=[...read('03-facades.sql').matchAll(/CREATE FUNCTION (platform_dev\.[a-z_0-9]+)\([\s\S]*?AS \$facade\$([\s\S]*?)\$facade\$;/g)].map(f=>{
  const signature=f[1]+(f[1].endsWith('reserve_service_quote_command_v1')?'(jsonb)':'(uuid,uuid)');
  return `IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='${signature}'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '${sha(f[2])}' THEN RAISE EXCEPTION 'core_quote_facade_body_changed' USING ERRCODE='55000'; END IF;`;
 }).join('\n');
 const scopeBody=/AS \$scope\$([\s\S]*?)\$scope\$;/.exec(read('04-c03-access.sql'))[1];
 const scopePin=`IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='app_private.core_service_quote_runtime_scope_v1(uuid,uuid)'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '${sha(scopeBody)}' THEN RAISE EXCEPTION 'core_quote_scope_body_changed' USING ERRCODE='55000'; END IF;`;
 return read('verify.sql').replace('-- CORE_QUOTE_CANONICAL_BODY_PINS',()=>pins+'\n'+facadePins+'\n'+scopePin);
}
/** Narrow source-invariant checker, NOT a SQL parser/compiler or privilege proof. */
export function validateUnits(units=Object.fromEntries(UNITS.map(p=>[p,read(p)]))){
 const need=(file,re,id)=>{if(!re.test(units[file]))throw Error(id);};
 const deny=(file,re,id)=>{if(re.test(units[file]))throw Error(id);};
 const f='03-facades.sql';
 need(f,/CREATE FUNCTION platform_dev\.reserve_service_quote_command_v1\(p_request jsonb\)\s+RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog\s+AS \$facade\$ SELECT customer_api\.reserve_service_quote_command_v1\(p_request\) \$facade\$;/,'FIXED_RESERVE_FACADE');
 need(f,/CREATE FUNCTION platform_dev\.read_service_quote_history_v1\(p_context_id uuid,p_workspace_id uuid\)\s+RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog\s+AS \$facade\$ SELECT customer_api\.read_service_quote_history_v1\(p_context_id,p_workspace_id\) \$facade\$;/,'FIXED_HISTORY_FACADE');
 if((units[f].match(/CREATE FUNCTION/g)||[]).length!==2)throw Error('ONLY_TWO_FACADES');
 deny(f,/\b(EXCEPTION|EXECUTE|format)\s*\(|\bWHEN\b|SECURITY INVOKER/i,'NO_ERROR_OR_DYNAMIC_WRAPPER');
 need(f,/FROM PUBLIC,anon,authenticated,service_role;/,'FACADE_CLOSED_ACL');
 need(f,/GRANT EXECUTE ON FUNCTION platform_dev\.[\s\S]* TO authenticated;/,'FACADE_MINIMUM_EXECUTE');
 deny(f,/GRANT\s+USAGE|GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+customer_api\./i,'NO_CUSTOMER_API_EXPOSURE');
 need('01-bootstrap-delegation.sql',/WITH ADMIN TRUE, INHERIT FALSE, SET TRUE;/,'TEMPORARY_FIXED_MEMBERSHIP');
 need('01-bootstrap-delegation.sql',/SET LOCAL ROLE cladora_core_installer;/,'ORDINARY_INSTALLER');
 need('05-settle.sql',/RESET ROLE;[\s\S]*REVOKE cladora_service_quote_store_owner FROM cladora_core_installer GRANTED BY CURRENT_USER;/,'ACTUAL_GRANTOR_CLEANUP');
 need('05-settle.sql',/core_quote_other_auth_schema_acl_changed/,'AUTH_SCHEMA_SNAPSHOT_COMPARE');
 need('preflight.sql',/core_quote_dependency_owner_policy_or_name_collision/,'DEPENDENCY_COLLISION_GATE');
 need('preflight.sql',/core_quote_runtime_existing_provider_dependency/,'EXISTING_RUNTIME_PROVIDER_GATE');
 need('04-c03-access.sql',/require_request_session_current_at_v1\(clock_timestamp\(\)\)/,'REAL_CLOCK_SESSION');
 need('04-c03-access.sql',/check_workspace_native_permission_v2\(c,w,'services.quotes.manage','services_orders'\)/,'CANONICAL_PERMISSION');
 need('04-c03-access.sql',/r\.membership_id=quote_drafts\.membership_id/,'BENEFICIARY_REQUEST_MEMBERSHIP');
 deny('04-c03-access.sql',/membership_id\s*=\s*app_private\.active_membership_id|GRANT\s+ALL|GRANT[\s\S]*?ON\s+(platform\.idempotency_keys|audit\.events|platform\.outbox_events)/i,'NO_C03_WIDENING');
 need('04-c03-access.sql',/WITH CHECK\(false\)/,'REQUEST_LOCK_NO_UPDATE');
 need('04-c03-access.sql',/z\.actor_id=auth.uid\(\)[\s\S]*z\.request_version=quote_drafts\.request_version/,'EXACT_RESERVATION_BINDING');
 need('verify.sql',/relforcerowsecurity/,'FORCED_RLS_VERIFICATION');
 return true;
}
export function readonlyPreflight(){return "BEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n"+read('preflight.sql')+'\nROLLBACK;\n';}
export function readonlyVerify(input=source()){return "BEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n"+nativeVerify(input)+'\nROLLBACK;\n';}
export function prepare(input=source()){
 validateUnits();
 const body=adoptCanonical(input),before=definitions(input),after=definitions(body);
 if(before.length!==4||JSON.stringify(before)!==JSON.stringify(after))throw Error('CANONICAL_BODY_HEADER_OR_DELIMITER_CHANGED');
 const prefix=`-- Core fixed platform_dev Quote target packet; SOURCE ONLY, no automatic execution.\nBEGIN;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n`;
 const sql=prefix+read('preflight.sql')+'\n'+read('01-bootstrap-delegation.sql')+'\n'+read('02-quote-dependencies.sql')+'\n'+body+'\n'+read('03-facades.sql')+'\n'+read('04-c03-access.sql')+'\n'+read('05-settle.sql')+'\n'+nativeVerify(input)+'\nCOMMIT;\n';
 return{sql,sha256:sha(sql),bytes:Buffer.byteLength(sql),canonical_definitions:before,source_sha256:sha(input),units:UNITS.map(path=>({path,bytes:Buffer.byteLength(read(path)),sha256:sha(read(path))}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=prepare(),out=process.argv.find(x=>x.startsWith('--output='));
 if(out)writeFileSync(out.slice(9),result.sql,{flag:'wx'});
 console.log(JSON.stringify({contract:'core-service-quote-platform-dev-install.v1',bytes:result.bytes,sha256:result.sha256,canonical_source:SERVICE,SQL_executed:false,default_execution:false}));
}
