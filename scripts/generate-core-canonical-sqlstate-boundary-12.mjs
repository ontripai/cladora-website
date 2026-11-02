/** Deterministic BYTE extraction/transformation; NOT a SQL parser or executor. */
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const BASE='847fa09039578eace8361ed00a4eedf815e03ded';
export const ITERATION_PARENT='6110229e72f5a81b2d3c3a1ff7090aa93741a2bc';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const PATH='supabase/proposals/core-canonical-sqlstate-boundary-v1/';
const FILES=['supabase/install/v14-operations/foundation.sql','supabase/install/v14-operations/building-provisioning.sql'];
export const INSERT=" when sqlstate '40001' then raise;";
export const identity=b=>({bytes:Buffer.byteLength(b),sha256:createHash('sha256').update(b).digest('hex'),git_blob:createHash('sha1').update(`blob ${Buffer.byteLength(b)}\0`).update(b).digest('hex')});
const literal=v=>"'"+v.replaceAll("'","''")+"'";
function requireValue(value,code){if(!value)throw Error(code);}
export function transformBody(before){
 const found=[...before.matchAll(/\bexception(?=\s+when\s+others\s+then)/gi)];
 requireValue(found.length===1,'BOUNDARY_COUNT');
 const at=found[0].index+found[0][0].length;
 return before.slice(0,at)+INSERT+before.slice(at);
}
export function validateBody(before,after){
 requireValue(after.includes(INSERT),'SERIALIZATION_RETHROW_MISSING');
 requireValue(after.split(INSERT).length===2,'SERIALIZATION_RETHROW_COUNT');
 requireValue(after.replace(INSERT,'')===before,'NON_BOUNDARY_BODY_CHANGE');
 requireValue(after===transformBody(before),'WRONG_BOUNDARY_PLACEMENT');
}
/** Independent full-definition round-trip, including dollar quotes/header/suffix. */
export function validateDefinition(before,after){
 const beforeTag=before.match(/\bas\s+(\$[a-z0-9_]*\$)/i)?.[1];
 const afterTag=after.match(/\bas\s+(\$[a-z0-9_]*\$)/i)?.[1];
 requireValue(beforeTag!==undefined&&afterTag===beforeTag,'DEFINITION_DELIMITER_MISMATCH');
 requireValue(before.split(beforeTag).length===3&&after.split(beforeTag).length===3,'DEFINITION_DELIMITER_COUNT');
 const bStart=before.indexOf(beforeTag)+beforeTag.length,bEnd=before.lastIndexOf(beforeTag);
 const aStart=after.indexOf(beforeTag)+beforeTag.length,aEnd=after.lastIndexOf(beforeTag);
 const bBody=before.slice(bStart,bEnd),aBody=after.slice(aStart,aEnd);
 validateBody(bBody,aBody);
 const restored=after.slice(0,aStart)+aBody.replace(INSERT,'')+after.slice(aEnd);
 const normalize=value=>value.replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function');
 requireValue(normalize(restored)===normalize(before),'DEFINITION_HEADER_OR_SUFFIX_DRIFT');
 return true;
}
export function build(){
 const functions=new Map(),sources=[];
 for(const path of FILES){
  const source=execFileSync('git',['show',`${BASE}:${path}`],{cwd:ROOT,encoding:'utf8'});sources.push({path,ref:BASE,...identity(source)});
  const re=/create\s+(?:or\s+replace\s+)?function\s+(app_private\.[a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\b([\s\S]*?)\bas\s+(\$[a-z0-9_]*\$)([\s\S]*?)\4\s*;/gi;
  for(const m of source.matchAll(re)){
   const params=m[2].split(',').map(s=>s.trim());
   const name=m[1].toLowerCase();
   functions.set(name,{name,path,line:source.slice(0,m.index).split('\n').length,end_line:source.slice(0,m.index+m[0].length).split('\n').length,byte_offset:Buffer.byteLength(source.slice(0,m.index),'utf8'),definition:m[0],body:m[5],delimiter:m[4],params});
  }
 }
 const roots=['app_private.check_workspace_native_permission_v2','app_private.check_workspace_native_permission_v2_at_v1'];
 const seen=new Set(),queue=[...roots],edges=[],external=new Set();
 while(queue.length){const name=queue.shift();if(seen.has(name))continue;seen.add(name);const f=functions.get(name);requireValue(f,'UNMAPPED_CANONICAL_CALL:'+name);
  requireValue(!/\bexecute\s/i.test(f.body),'DYNAMIC_CANONICAL_CALL_UNREVIEWED');
  for(const m of f.body.matchAll(/\b([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(/gi))if(!m[1].startsWith('app_private.')){requireValue(['auth.uid','auth.jwt','pg_catalog.isfinite'].includes(m[1]),'UNREVIEWED_EXTERNAL_CALL');external.add(m[1]);}
  for(const call of new Set(f.body.match(/app_private\.[a-z0-9_]+/gi)??[])){edges.push({caller:name,callee:call});queue.push(call);}
 }
 const targets=[...seen].filter(n=>/\bexception\s+when\s+others\s+then\s+return\s+false\s*;/i.test(functions.get(n).body)).sort();
 requireValue(targets.length===8,'TARGET_FAMILY_COUNT');
 const records=targets.map(name=>{
  const f=functions.get(name);const types=f.params.map(p=>{const m=/^p_\w+\s+(uuid\[\]|uuid|text|boolean|timestamptz)(?:\s+default[\s\S]*)?$/i.exec(p);requireValue(m,'UNSUPPORTED_SIGNATURE');return m[1].toLowerCase();});
  const afterBody=transformBody(f.body);validateBody(f.body,afterBody);
  const after=f.definition.replace(f.delimiter+f.body+f.delimiter,()=>f.delimiter+afterBody+f.delimiter).replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function');
  validateDefinition(f.definition,after);
  const beforeClause=f.body.match(/\bexception\s+when\s+others\s+then\s+return\s+false\s*;/i)[0];
  return {...f,signature:`${name}(${types.join(',')})`,afterBody,afterDefinition:after,beforeClause,afterClause:beforeClause.replace(/^exception/i,'exception'+INSERT),before:identity(f.definition),after:identity(after),before_body:identity(f.body),after_body:identity(afterBody)};
 });
 const vals=records.map(f=>`(${literal(f.signature)},${f.before_body.bytes},${literal(f.before_body.sha256)},${literal(f.after_body.sha256)})`).join(',\n');
 const sql=`-- CORE-CANONICAL-SQLSTATE-BOUNDARY-12: review-only independent delta, NOT an installer\n-- Existing migrations/installers/guards immutable. Exact preimage required. No execution authority.\nBEGIN;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='10s';\nDO $hold$ BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_review_only_execution_hold'; END $hold$;\n\nCREATE TEMP TABLE core12_targets(signature text PRIMARY KEY,before_bytes integer,before_sha text,after_sha text) ON COMMIT DROP;\nINSERT INTO pg_temp.core12_targets VALUES\n${vals};\nDO $pre$ DECLARE t record; p record; BEGIN\n IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_pg17_required'; END IF;\n FOR t IN SELECT * FROM pg_temp.core12_targets LOOP\n  SELECT r.*,l.lanname INTO p FROM pg_proc r JOIN pg_language l ON l.oid=r.prolang WHERE r.oid=to_regprocedure(t.signature);\n  IF NOT FOUND OR p.lanname<>'plpgsql' OR p.prokind<>'f' OR p.provolatile<>'s' OR NOT p.prosecdef OR p.proisstrict OR p.proretset OR p.prorettype<>'boolean'::regtype\n   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]\n   OR octet_length(convert_to(p.prosrc,'UTF8'))<>t.before_bytes\n   OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>t.before_sha\n  THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_preimage_mismatch'; END IF;\n  IF NOT pg_has_role(current_user,p.proowner,'USAGE') OR NOT has_schema_privilege(current_user,p.pronamespace,'CREATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_exact_owner_create_required'; END IF;\n END LOOP;\nEND $pre$;\nCREATE TEMP TABLE core12_before ON COMMIT DROP AS SELECT p.oid,p.prosrc,to_jsonb(p)-'prosrc' AS attributes FROM pg_proc p;\nCREATE TEMP TABLE core12_defaults ON COMMIT DROP AS SELECT to_jsonb(d) AS value FROM pg_default_acl d;\nCREATE TEMP TABLE core12_dependencies ON COMMIT DROP AS SELECT to_jsonb(d) AS value FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets);\n\n${records.map(f=>`-- ${f.path}:${f.line}; ${f.signature}\n-- before-prosrc ${f.before_body.sha256}; after-prosrc ${f.after_body.sha256}\n${f.afterDefinition}`).join('\n\n')}\n\nDO $post$ DECLARE t record; BEGIN\n FOR t IN SELECT * FROM pg_temp.core12_targets LOOP\n  IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure(t.signature)) IS DISTINCT FROM t.after_sha THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_postimage_mismatch'; END IF;\n END LOOP;\n IF EXISTS(SELECT 1 FROM pg_temp.core12_before b FULL JOIN (SELECT oid,prosrc,to_jsonb(p)-'prosrc' AS attributes FROM pg_proc p) a USING(oid) WHERE b.attributes IS DISTINCT FROM a.attributes OR (b.prosrc IS DISTINCT FROM a.prosrc AND a.oid NOT IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets))) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_catalog_owner_acl_attribute_delta'; END IF;\n IF EXISTS((SELECT value FROM pg_temp.core12_defaults EXCEPT ALL SELECT to_jsonb(d) FROM pg_default_acl d) UNION ALL (SELECT to_jsonb(d) FROM pg_default_acl d EXCEPT ALL SELECT value FROM pg_temp.core12_defaults)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_default_acl_delta'; END IF;\n IF EXISTS((SELECT value FROM pg_temp.core12_dependencies EXCEPT ALL SELECT to_jsonb(d) FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets)) UNION ALL (SELECT to_jsonb(d) FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets) EXCEPT ALL SELECT value FROM pg_temp.core12_dependencies)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_dependency_delta'; END IF;\nEND $post$;\nROLLBACK;\n`;
 const cases=[{code:null,control:true,result:true},{code:null,control:false,result:false},...['40001','57014','42501','22023','42P01','40P01','XX000','P0001','P0004'].map(code=>({code,control:false,before_state:['57014','P0004'].includes(code)?code:null,after_state:['40001','57014','P0004'].includes(code)?code:null,result:false}))];
 const ddl=[];
 records.forEach((f,i)=>{for(const variant of ['before','after']){const n=`core12_${variant}_${i+1}`;ddl.push(`-- EXACT extracted ${variant} handler, not a parallel evaluator: ${f.signature}\nCREATE FUNCTION pg_temp.${n}(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$\nBEGIN\n BEGIN\n  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;\n  RETURN p_control;\n  ${variant==='before'?f.beforeClause:f.afterClause}\n END;\nEND $case$;\nREVOKE ALL ON FUNCTION pg_temp.${n}(text,boolean) FROM PUBLIC;`);}});
 const matrix=records.flatMap((f,i)=>cases.flatMap(c=>['before','after'].map(v=>`(${literal(`core12_${v}_${i+1}`)},${c.code===null?'NULL':literal(c.code)},${c.control},${c[`${v}_state`]?literal(c[`${v}_state`]):'NULL'},${c.result})`))).join(',\n');
 const harness=`-- PG-ONLY FUTURE BOUNDARY-SEMANTICS WITNESS; NOT full canonical evaluator/native SSI proof\n-- No Auth/provider/schema installation. No execution currently authorized.\nBEGIN ISOLATION LEVEL SERIALIZABLE;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='10s';\nDO $guard$ BEGIN\n IF current_setting('core12.reviewed_pg_only_capsule',true) IS DISTINCT FROM 'core12-boundary-v1'\n  OR current_database()<>'core_sqlstate_boundary_proof'\n  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999\n  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform'))\n  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))\n  OR EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND defaclobjtype='f')\n THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_pg_only_execution_hold'; END IF;\nEND $guard$;\n-- The GUC is only an accidental-execution guard, NEVER approval/authority.\n-- External target/executor/authorization bindings remain NULL in caseplan.\n${ddl.join('\n\n')}\nCREATE TEMP TABLE core12_matrix(function_name text,code text,control boolean,expected_state text,expected_result boolean) ON COMMIT DROP;\nINSERT INTO pg_temp.core12_matrix VALUES\n${matrix};\nDO $verify$ DECLARE t record; got text; msg text; detail text; hint text; value boolean; BEGIN\n FOR t IN SELECT * FROM pg_temp.core12_matrix LOOP\n  got:=NULL; msg:=NULL; detail:=NULL; hint:=NULL; value:=NULL;\n  BEGIN\n   EXECUTE format('SELECT pg_temp.%I($1,$2)',t.function_name) INTO value USING t.code,t.control;\n  EXCEPTION WHEN OTHERS OR query_canceled OR assert_failure THEN\n   GET STACKED DIAGNOSTICS got=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,detail=PG_EXCEPTION_DETAIL,hint=PG_EXCEPTION_HINT;\n  END;\n  IF got IS DISTINCT FROM t.expected_state OR (got IS NULL AND value IS DISTINCT FROM t.expected_result) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='core12_boundary_oracle_failed'; END IF;\n  IF got IS NOT NULL AND (msg<>'synthetic_boundary_fault' OR detail<>'synthetic_detail' OR hint<>'synthetic_hint') THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='core12_bare_raise_diagnostics_changed'; END IF;\n END LOOP;\nEND $verify$;\nROLLBACK;\n`;
 const plan={task:'CORE-CANONICAL-SQLSTATE-BOUNDARY-12',base:ITERATION_PARENT,canonical_source_base:BASE,iteration_parent:ITERATION_PARENT,correction:'CORE12-F01/R1; literal replacement plus full-definition round-trip on8 functions',scope:'T10-D04 only',execution_authorization:null,execution_target:null,executor:null,runtime_binding:null,historical_slots:'BLOCKED',status:'NOT_RUN_NOT_PASS',sources,roots,closure:{named_routines:[...seen].sort(),edges,unmapped:[],external_qualified_calls:[...external].sort(),method:'pinned-source lexical named calls; no dynamic EXECUTE allowed; external Auth/system primitives unchanged; NOT parser/compile/overload/catalog proof'},targets:records.map(f=>({signature:f.signature,source:f.path,line:f.line,end_line:f.end_line,byte_offset:f.byte_offset,before:f.before,after:f.after,before_body:f.before_body,after_body:f.after_body,body_edit:'one insertion after EXCEPTION; WHEN SQLSTATE40001 THEN bare RAISE; existing OTHERS false unchanged',declaration_edit:'CREATE OR REPLACE only; signature/header/owner/ACL/security/search_path policy unchanged',definition_round_trip:'PASS: remove only inserted clause + normalize CREATE prefix => exact full original definition, including delimiters/header/suffix'})),pg_only:{file:PATH+'pg-only-boundary.test.sql',target_database:'core_sqlstate_boundary_proof',principal:'existing ordinary executor, non-superuser/non-BYPASSRLS with TEMP and own pg_temp function rights; actual identity NULL; no role/grant creation in packet',objects:'16 pg_temp boundary wrappers + temp matrix, final ROLLBACK; ordinary EXECUTE ACL owner-only after PUBLIC revoke; function default-ACL rows must be absent, no defaults modified',cases,planned_calls:records.length*cases.length*2,proof:'future real PL/pgSQL RAISE/exception/GET STACKED DIAGNOSTICS for exact extracted clauses only; NOT full canonical evaluator or native SSI concurrency',rollback:'outer final ROLLBACK; separate same-backend ACK and fresh observer absence required; no retry on UNKNOWN'},delta:{file:PATH+'delta.sql',default:'unconditional55000 guard before catalog reads/DDL; BEGIN/final ROLLBACK; not installable/activation-approved',privilege:'actual ownership/effective owner rights plus schema CREATE, exact profile must be independently reviewed; no superuser/SET/GRANT assumptions',preserve:['all8 existing OIDs/owners/ACLs/attributes except prosrc','all pg_default_acl','target pg_depend','ordinary errors false','57014/P0004 propagate as before','Core11/evaluator policy/store/managed Auth unchanged except proposed40001 body branch'],unknown:'failure/mismatch/timeout/cancel => stop and rollback; unknown settlement not success, no blind retry'},not_run:['all SQL parsing/compile/execution','PG/Auth/native SSI/concurrency','full canonical authorization semantics','owner/ACL/RLS/hosted grant proof','actual timeout/backend cancellation and genuine concurrent SSI40001','installation/activation']};
 return {records,sources,plan,sql,harness,planText:JSON.stringify(plan,null,2)+'\n'};
}
export function validatePacket(packet){
 const exact=build();
 requireValue(JSON.stringify(packet.records.map(f=>f.signature))===JSON.stringify(exact.records.map(f=>f.signature)),'TARGET_FAMILY_DRIFT');
 for(const [i,f] of packet.records.entries()){requireValue(f.body===exact.records[i].body,'CANONICAL_PREIMAGE_DRIFT');validateBody(f.body,f.afterBody);validateDefinition(f.definition,f.afterDefinition);}
 const plan=JSON.parse(packet.planText);requireValue(plan.execution_authorization===null&&plan.execution_target===null&&plan.executor===null&&plan.runtime_binding===null,'EXECUTION_BINDING_NOT_NULL');
 requireValue(packet.sql.includes("ERRCODE='55000',MESSAGE='core12_review_only_execution_hold'"),'GUARD_MISSING');
 requireValue(packet.sql.endsWith('ROLLBACK;\n'),'NO_FINAL_ROLLBACK');
 requireValue(!/^\s*(?:ALTER\s+DEFAULT\s+PRIVILEGES|GRANT\s|ALTER\s+FUNCTION|COMMIT\s*;)/im.test(packet.sql),'PRIVILEGE_OR_ACTIVATION_DELTA');
 requireValue(packet.sql===exact.sql,'NONCANONICAL_DELTA');requireValue(packet.harness===exact.harness,'NONCANONICAL_HARNESS');requireValue(packet.planText===exact.planText,'NONCANONICAL_CASEPLAN');
 return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const p=build();validatePacket(p);const output={'delta.sql':p.sql,'pg-only-boundary.test.sql':p.harness,'caseplan.json':p.planText};
 for(const [name,body] of Object.entries(output)){const file=resolve(ROOT,PATH,name);if(process.argv.includes('--write'))writeFileSync(file,body);else requireValue(readFileSync(file,'utf8')===body,'ARTIFACT_DRIFT:'+name);}
 console.log(JSON.stringify({mode:process.argv.includes('--write')?'SOURCE_GENERATED':'SOURCE_CHECKED',targets:p.records.length,closure:p.plan.closure.named_routines.length,planned_pg_calls:p.plan.pg_only.planned_calls,sql:'NOT_RUN',runtime_binding:null}));
}
