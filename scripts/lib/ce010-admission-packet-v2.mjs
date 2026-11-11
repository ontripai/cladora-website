/** Offline CE010 source admission packet. Never imports a driver or calls SQL.
 * The immutable Git roots below are independent of generated manifests/seals. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const CE010_ADMISSION_BASE_V2='c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1';
export const CORE_CE010_SOURCE_V2='6adb3e3f0ffc72f1f138a4990b23653a7c5b62cd';
export const CORE_CE010_METADATA_V2='103ee9ad61c033a0745b2558b052912f16381ee2';
export const sourceRootsV2=Object.freeze([
  {
    "scope": "ce",
    "ref": "c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1",
    "path": "src/app/api/customer/v1/community/base/route.ts",
    "bytes": 5131,
    "sha256": "2192521ed308093379df9031eb4839d2193818456b61ebc17318e9a9bcd48d4d",
    "git_blob": "e485e4d5954110a47d6bf7e5cb06293f22432657"
  },
  {
    "scope": "ce",
    "ref": "c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1",
    "path": "src/lib/community/community-announcement-platform-provider-v1.ts",
    "bytes": 623,
    "sha256": "5136a195edb2afada122c0fbb2d08f84df2ee9bb89a619ce1dff7787106c7163",
    "git_blob": "d49899970ce1abcecb35f37626530980470273ac"
  },
  {
    "scope": "ce",
    "ref": "c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1",
    "path": "src/lib/community/community-announcement-http-v1.ts",
    "bytes": 8106,
    "sha256": "d3b50b33dd0189a53a584cd494d64ff883b7c089e339c50bbb8d76a9279a5765",
    "git_blob": "8450708b8a9d352c766b891c8cebe7687eb0adfb"
  },
  {
    "scope": "ce",
    "ref": "c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1",
    "path": "src/lib/community/community-announcement-provider-v1.ts",
    "bytes": 11100,
    "sha256": "b34f8cdcd332a9336ba4da11655722d21364dd411879cdaa31cf88ae8bb7dd56",
    "git_blob": "1f15385912b14200686bb45de82f4f009876ae5b"
  },
  {
    "scope": "legacy",
    "ref": "989e35a78363908357f65460011492e0472dc047",
    "path": "supabase/install/ce010-announcement-v1/packet.json",
    "bytes": 31870,
    "sha256": "a1c7a2f357cd319d89e83d7a3fcb971fdfd223b47aa3b02e3ea1c7ac8bc9892a",
    "git_blob": "1ee09925b730d1ef75091a446bc652579fdff92d"
  },
  {
    "scope": "legacy",
    "ref": "989e35a78363908357f65460011492e0472dc047",
    "path": "supabase/install/ce010-announcement-v1/10-domain-candidate.sql",
    "bytes": 26294,
    "sha256": "91e97be48b473852b16d41fa1437bd6ec7e0f8343cdb1a1df7ba80ea194fa5dd",
    "git_blob": "0d8ae6cd3622389ec83bece8a03335dc7159917d"
  },
  {
    "scope": "legacy",
    "ref": "989e35a78363908357f65460011492e0472dc047",
    "path": "docs/contracts/ce010-community-announcement-01/install-packet/dependencies.json",
    "bytes": 17182,
    "sha256": "e0001c6bff6678820f6f50e9d0711a856c7a85450cf1e9a68b690d892794c81c",
    "git_blob": "ddc1ad023abc72ef0b768f14776bff527223a368"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "src/lib/core/ce010-request-binding-v1.ts",
    "bytes": 15164,
    "sha256": "18c6a299465f9e6838b2ad8cebd92f5785877a28352d310f788f22d349a67d84",
    "git_blob": "844abbececc0263c42e42a8359bdeef65e390408"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "src/lib/core/ce010-query-profile-v1.json",
    "bytes": 13147,
    "sha256": "0069780e3f14a056800f6923b251b47a5d303d1ab2dfbb40ea448f7ada751839",
    "git_blob": "8f76d65962deb52967d615d3bec53631fcff5b08"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "src/lib/core/platform-role-bound-pool-v1.ts",
    "bytes": 12209,
    "sha256": "a09a91da3d89f785a49559999482db6994a7607b375faa38aa0f994701522e17",
    "git_blob": "2e91086349247b00c461d83c3cdf4ce5be6026be"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "src/lib/core/postgres-transaction-host-v1.ts",
    "bytes": 64851,
    "sha256": "e269802f7b4b5b376eb3910d9f1b55f42eb8abc87d1cf75fd9d019a0ffd2297a",
    "git_blob": "8a2c5e97f929af3b52c66656046143fbf7fcbba1"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "src/lib/core/current-authority-postgres-provider-v1.ts",
    "bytes": 7831,
    "sha256": "0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a",
    "git_blob": "e67df2d947608f546dab42dba88b5bdc418cbffb"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "docs/core/domain-ports-01/ce010-producer-19/profile-contract.json",
    "bytes": 4666,
    "sha256": "75f139b554012956ae359dbb7547641a39908dac9a411cb4a6038368b42290b7",
    "git_blob": "8496b60471305f59abc16a4263a4a1e132855b17"
  },
  {
    "scope": "core",
    "ref": "103ee9ad61c033a0745b2558b052912f16381ee2",
    "path": "docs/core/domain-ports-01/ce010-producer-19/reference-correction.json",
    "bytes": 3091,
    "sha256": "4b8445d41f991cd63afd591122d3a0f544543b835cea01d648dcc318a23312cd",
    "git_blob": "b4259e3b15ac02bdc6944dd8d4337fac53b235f6"
  }
].map(Object.freeze));
export const sha256V2=x=>createHash('sha256').update(x).digest('hex');
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const domainTables=['community.communities','community.announcements','community.content_reports'];
const domainRoutines=['app_private.ce_community_authorize_v1(uuid,uuid,text)','app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid)','app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb)','customer_api.read_ce_community_v1(uuid,uuid)'];
export const requiredDomainInventoryV2=Object.freeze([...domainTables,...domainRoutines]);
const q=s=>"'"+s.replaceAll("'","''")+"'";
const guard="DO $review$ BEGIN RAISE EXCEPTION 'ce010_v2_review_only_no_admission' USING ERRCODE='55000'; END $review$;";
function guardedCatalog(stage,relations,routines){
 const rv=relations.map(n=>'('+q(n)+')').join(','),fv=routines.map(n=>'('+q(n)+')').join(',');
 return `-- CE010 ${stage}: review-only catalog source. No target admission/SQL execution supplied.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
${guard}
-- Do not execute either safety function here. Metadata/role reachability is NOT
-- proof of a held lease, authenticated target, exclusivity or operational authority.
WITH RECURSIVE requested_relations(name) AS (VALUES ${rv}),
requested_routines(signature) AS (VALUES ${fv}),
seeds AS (SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce010_runtime','cladora_ce010_executor',current_setting('cladora.ce010.owner',true))),
reach(roleid) AS (
 SELECT oid FROM seeds
 UNION SELECT m.roleid FROM reach r JOIN pg_auth_members m ON m.member=r.roleid
)
SELECT jsonb_build_object(
 'target',jsonb_build_object('database',current_database(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),'server_version_num',current_setting('server_version_num'),'backend_marker',(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')),
 'session_principal',session_user,'current_principal',current_user,
 'relations',(SELECT jsonb_agg(jsonb_build_object('identity',r.name,'present',c.oid IS NOT NULL,'oid',c.oid,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'collation',a.attcollation,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
  'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid) FROM pg_index i WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
 ) ORDER BY r.name) FROM requested_relations r LEFT JOIN pg_class c ON c.oid=to_regclass(r.name)),
 'routines',(SELECT jsonb_agg(jsonb_build_object('identity',r.signature,'present',p.oid IS NOT NULL,'oid',p.oid,'owner',pg_get_userbyid(p.proowner),'identity_arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'language',l.lanname,'definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'config',p.proconfig,'acl',p.proacl) ORDER BY r.signature) FROM requested_routines r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature) LEFT JOIN pg_language l ON l.oid=p.prolang),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'oid',oid,'login',rolcanlogin,'super',rolsuper,'bypassrls',rolbypassrls,'createrole',rolcreaterole,'createdb',rolcreatedb,'replication',rolreplication,'inherit',rolinherit) ORDER BY rolname) FROM pg_roles WHERE oid IN(SELECT roleid FROM reach)),
 'role_edges',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m WHERE m.member IN(SELECT roleid FROM reach) OR m.roleid IN(SELECT roleid FROM reach)),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'oid',oid,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('community','app_private','customer_api','identity','auth','platform','audit','core_runtime')),
 'default_acl',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d WHERE d.defaclnamespace=0 OR d.defaclnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('community','app_private','customer_api','identity','auth','platform','audit','core_runtime')))
) AS ce010_admission_catalog_v2;
-- Preserve full before/after images privately. This catalog does not authenticate
-- target/lease. ${stage==='recovery'?'Partial/drift/unsettled state: UNKNOWN, no ACK, no replay or compensating DDL.':'Missing/unknown role/helper/owner/ACL/binding is BLOCKED_CAPABILITY.'}
ROLLBACK;
`;
}
export function buildCe010AdmissionV2(readAt){
 const inputs=new Map();for(const pin of sourceRootsV2){const b=Buffer.from(readAt(pin.ref,pin.path));assert.equal(b.length,pin.bytes,'SOURCE_BYTES_MISMATCH '+pin.path);assert.equal(sha256V2(b),pin.sha256,'READONLY_DEPENDENCY_MISMATCH '+pin.path);assert.equal(createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex'),pin.git_blob,'GIT_IDENTITY_MISMATCH');inputs.set(pin.scope+':'+pin.path,b);}
 const get=(scope,suffix)=>{const matches=[...inputs].filter(([k])=>k.startsWith(scope+':')&&k.endsWith(suffix));assert.equal(matches.length,1);return JSON.parse(matches[0][1]);};
 const profile=get('core','/profile-contract.json'),queries=get('core','/ce010-query-profile-v1.json'),old=get('legacy','/packet.json'),roots=get('legacy','/dependencies.json');
 assert.equal(queries.queries.length,31);for(const x of queries.queries)assert.equal(sha256V2(x.sql),x.sha256,'OFFICIAL_QUERY_HASH_MISMATCH');
 for(const r of profile.source_references){const found=sourceRootsV2.find(x=>x.ref===r.ref&&x.path===r.path);assert.ok(found,'CORRECTED_REFERENCE_MISSING');assert.equal(found.sha256,r.sha256);assert.equal(found.bytes,r.bytes);assert.equal(found.git_blob,r.git_blob);}
 const safety=profile.required_Platform_primitives_NOT_IMPLEMENTED_HERE;assert.deepEqual(safety.map(x=>x.signature),['app_private.assert_ce010_role_safety_v1()','app_private.acquire_ce010_role_safety_lease_v1()']);
 const sharedFunctions=roots.shared_routine_calls_NOT_NEW_ABI.map(x=>x.signature);
 const routines=[...new Set([...domainRoutines,...sharedFunctions,'app_private.lock_core_request_session_v1()',...safety.map(x=>x.signature)])];
 const relations=[...new Set([...domainTables,...roots.shared_requirements_NOT_GRANTS.map(x=>x.object)])].sort();
 const inventory={contract:'ce010-source-admission-inventory.v2',consumer:CE010_ADMISSION_BASE_V2,producer:CORE_CE010_SOURCE_V2,metadata:CORE_CE010_METADATA_V2,
  producer_status:'OFFICIAL_SOURCE_AVAILABLE_AND_COUPLED',factory:profile.factory,route:'src/app/api/customer/v1/community/base/route.ts',slot:{path:'src/lib/community/community-announcement-platform-provider-v1.ts',symbol:'CE010_PLATFORM_PROVIDER_V1',value:null},
  activation:null,target:null,observed_roles:null,source_proposed_roles_NOT_OBSERVED:profile.source_proposed_roles_NOT_OBSERVED,connection_models:profile.connection_models,physical_release:profile.physical_release,mapping:profile.mapping,
  source_roots:sourceRootsV2,canonical_CE_declarations:old.declarations,CE_column_requirements_NOT_GRANTS:old.columns,CE_policy_candidates_NOT_ADMITTED:old.policies,
  current_closed_query_profile:{ref:CORE_CE010_METADATA_V2,path:'src/lib/core/ce010-query-profile-v1.json',contract:queries.contract,queries:queries.queries},
  root_shared_requirements_NOT_GRANTS:roots.shared_requirements_NOT_GRANTS,root_shared_routine_calls:roots.shared_routine_calls_NOT_NEW_ABI,schema_requirements_NOT_GRANTS:roots.schema_requirements_NOT_GRANTS,
  safety_requirements:{owner:'Platform implements; Core owns semantics; CE consumes only',required_primitives:safety,semantics:profile.safety_semantics,definition_owner_acl_pins:null,held_lease_and_invalidation_proof:null,status:'BLOCKED_CAPABILITY'},
  expected_postimage:{target:null,roles:null,schemas:null,default_acl:null,relations:null,routines:null,role_edges:null,status:'BLOCKED_TARGET_AND_CUSTODIAN_INPUT'},
  discovery_inventory:{relations,routines,domain:requiredDomainInventoryV2,metadata_only:true},
  boundary:'CE root column/declaration requirements and current official Core query/role profile are NOT a complete recursive C01/C03/session/evaluator/lineage/default/sequence closure. Core supplies that closure; Platform supplies actual role/helper/target/binding and custodian proof.',
  stale_fields_not_consumed:['legacy.required_producer official factory=null/current missing observation','legacy.packet.runtime NOT_READY_CORE_PRODUCER_MISSING','legacy.packet.sources old Core host hash'],
  native:'NOT_RUN_NOT_PASS',admitted:false,runnable:false};
 const fresh={contract:'ce010-fresh-review-plan.v2',path:'fresh',source_only:true,domain_unit:sourceRootsV2.find(x=>x.path.endsWith('/10-domain-candidate.sql')),ce_objects:'inventory.json#canonical_CE_declarations',guard_preserved:true,
  precondition:'All seven canonical CE tables/routines explicitly inventoried as absent; absence of inventory is UNKNOWN, not fresh.',
  order:['Platform/custodian exact target/window and protected before-image; Core recursive dependency/admission closure','Platform real safety implementations, full graph/owner/ACL/RLS/source and held lease proof; private Pool/target/model','Existing admitted temporary CREATE/owner lane; CE-only canonical fresh unit retains own single transaction','Exact bounded full postimage including definitions/ACL/RLS/policies/constraints/defaults/triggers and protected role/defaultACL comparison inside admitted wrapper before ACK','Private App binding only after actual capability admission; native Platform/QA tests under independent window'],
  blocked:['target and source-specific prestate','helper implementation/owner/ACL and real exclusion/invalidation capability','Core recursive closure and full postimage','private runtime binding and operational window'],
  warning:'Historical unit is a CE declaration/column/policy source reference, not a current Core install recipe. Do not run it, strip its guard or reseal it as admitted. No all-chain outer BEGIN, guessed ownership lane or shared grants.',runnable:false};
 const adaptation={contract:'ce010-existing-target-review-plan.v2',path:'adaptation',source_only:true,preimage:null,forward_delta:null,status:'BLOCKED_TARGET_BEFORE_IMAGE',
  required_before_image:['exact target/OID/version/marker','all requested object presence including partial installs','full definitions/signatures/owners/ACL/column ACL/RLS/policy expressions/defaults/constraints/indexes/triggers','actual role/defaultACL/schema ownership/privilege graph','data/legacy receipt/writer dependencies assessed by the domain and Core; never select/publish private rows here'],
  rules:['Any existing/partial CE object selects this path, never fresh CREATE','Exact existing shape does not automatically adopt rights or authorize a command','No DROP/replace/backfill/reset/grant/ownership/adoption delta without the real before-image and its review','Ambiguous COMMIT/unsettled/partial/drift stays UNKNOWN; readback under an independently admitted observer, no automatic retry'],runnable:false};
 const files={'inventory.json':JSON.stringify(inventory,null,2)+'\n','fresh-plan.json':JSON.stringify(fresh,null,2)+'\n','adaptation-plan.json':JSON.stringify(adaptation,null,2)+'\n','00-preflight.sql':guardedCatalog('preflight',relations,routines),'20-verify.sql':guardedCatalog('verify',relations,routines),'30-recovery.sql':guardedCatalog('recovery',relations,routines)};
 const manifest={contract:'ce010-admission-packet.v2',base:CE010_ADMISSION_BASE_V2,producer:CORE_CE010_SOURCE_V2,metadata:CORE_CE010_METADATA_V2,sources:sourceRootsV2,files:Object.entries(files).map(([path,s])=>({path,bytes:Buffer.byteLength(s),sha256:sha256V2(s)})),status:'SOURCE_RECONSTRUCTED_CAPABILITY_BLOCKED',activation:null,native:'NOT_RUN_NOT_PASS'};
 return {files,manifest};
}
/** Synthetic/imported metadata diagnostics ONLY, never authenticates a seal or admits SQL. */
function domainPresence(s){
 if(!Array.isArray(s?.relations)||!Array.isArray(s?.routines))return null;
 const rows=[...s.relations,...s.routines],found=requiredDomainInventoryV2.map(id=>rows.filter(x=>x.identity===id));
 if(found.some(x=>x.length!==1||typeof x[0].present!=='boolean'))return null;
 return found.flat();
}
const targetShape=t=>!!t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.database==='string'&&t.database.length>0&&Number.isSafeInteger(t.database_oid)&&t.database_oid>0&&typeof t.server_version_num==='string'&&/^17[0-9]{4}$/.test(t.server_version_num)&&typeof t.backend_marker==='string'&&t.backend_marker.length>0;
const targetMatches=(a,b)=>targetShape(a)&&targetShape(b)&&stable(a)===stable(b);
export function classifyCe010AdmissionV2(snapshot,expectedTarget){
 const base={admitted:false,runnable:false,ack:false,mutation:false};
 if(!targetShape(expectedTarget)||!targetShape(snapshot?.target))return {...base,status:'BLOCKED_TARGET_INPUT',path:null};
 if(!targetMatches(snapshot.target,expectedTarget))return {...base,status:'UNKNOWN_TARGET_MISMATCH',path:null};
 const domain=domainPresence(snapshot);if(!domain)return {...base,status:'UNKNOWN_INCOMPLETE_INVENTORY',path:null};
 return {...base,status:'BLOCKED_CAPABILITY',path:domain.every(x=>!x.present)?'fresh':'adaptation',reason:'Actual helper/owner/ACL/role-lease/binding and Core admission are not authenticated by this offline diagnostic.'};
}
export function recoverCe010AdmissionV2(before,actual,reference){
 const no={ack:false,mutation:false,automatic_retry:false};
 if(!targetShape(reference?.target)||!targetShape(before?.target)||!targetShape(actual?.target))return {...no,status:'UNKNOWN_STOP_NO_ACK_NO_MUTATION',reason:'TARGET_INPUT_MISSING'};
 if(!targetMatches(before.target,reference.target)||!targetMatches(actual.target,reference.target))return {...no,status:'UNKNOWN_STOP_NO_ACK_NO_MUTATION',reason:'TARGET_MISMATCH'};
 if(!domainPresence(before)||!domainPresence(actual))return {...no,status:'UNKNOWN_STOP_NO_ACK_NO_MUTATION',reason:'INCOMPLETE_INVENTORY'};
 if(!reference?.postimage)return {...no,status:'BLOCKED_REFERENCE_POSTIMAGE',reason:'MISSING_REFERENCE_NOT_AN_EXECUTION_PERMIT'};
 if(!targetMatches(reference.postimage.target,reference.target))return {...no,status:'UNKNOWN_STOP_NO_ACK_NO_MUTATION',reason:'REFERENCE_TARGET_MISMATCH'};
 if(stable(actual)===stable(reference.postimage))return {...no,status:'POSTIMAGE_METADATA_MATCH_REVIEW_ONLY',admitted:false};
 if(stable(actual)===stable(before))return {...no,status:'BEFORE_IMAGE_MATCH_MANUAL_REVIEW',path:classifyCe010AdmissionV2(actual,reference.target).path,admitted:false};
 return {...no,status:'UNKNOWN_STOP_NO_ACK_NO_MUTATION',reason:'PARTIAL_OR_DRIFT_OR_UNSETTLED'};
}
export function verifyCe010AdmissionPacketV2(packet,readAt){
 const expected=buildCe010AdmissionV2(readAt);
 assert.equal(stable(packet.files),stable(expected.files),'SOURCE_PACKET_BYTES_MISMATCH');
 assert.equal(stable(packet.manifest),stable(expected.manifest),'SOURCE_MANIFEST_MISMATCH');
 return {status:'SOURCE_BYTES_MATCH_ONLY',admitted:false,runnable:false,native:'NOT_RUN_NOT_PASS'};
}
