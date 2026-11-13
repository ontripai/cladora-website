// Offline AIRPROP source packet. No pg/client/process/network execution API.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const BASE='067464d07cb08629adf59490febf6222f5c0d878';
export const DIR='supabase/proposals/airprop-listing-binding-adoption-v2';
export const INPUTS=Object.freeze({
 'supabase/proposals/airprop_listing_selected_bindings_v1.sql':'124fc20a2dfb63d7da13290a1e1aaefc49655287d0e490c82d3dda85ab1640c1',
 'supabase/proposals/airprop_listing_selected_bindings_v2.sql':'305831d860e25c61c0ccb18e1433ec1e9d5c1fcc03290210a689360a90e22387',
 'src/lib/airprop/listing-selected-binding-v1.ts':'0cab6d8a8b3ccdc32f749bc43afba33b90a0ab3823d4c1426dbeb611bb807027',
 'src/lib/airprop/listing-runtime-binding-v1.ts':'ec3a86f36fc2e24ba0751e6ce35451b26f2ccd32fb7e21564912775d437195da',
 'src/lib/airprop/listing-flow-contract-v1.ts':'cfa7c903e799cb48f02824ff93169b9a41226a371df25b619aa42344aaa88057',
});
export const sha256=b=>createHash('sha256').update(b).digest('hex');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p));
const TABLE='airprop.listing_selected_bindings_v1';
export const GUARD="DO $inactive$ BEGIN RAISE EXCEPTION 'AIRPROP_BINDING_V2_SOURCE_ONLY' USING ERRCODE='55000'; END $inactive$;";
const prefix=readOnly=>`-- INACTIVE AIRPROP V2 SOURCE. NOT an installer/admission. Never strip guard.\nBEGIN${readOnly?' READ ONLY':''};\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL search_path=pg_catalog,pg_temp;\n${GUARD}\n`;
const legacy="NOT (binding ? 'binding_version') AND NOT ((binding->'selection') ? 'source_versions')";
function requireOne(source,needle,replacement){if(source.split(needle).length!==2)throw Error('EXTRACTION_NOT_UNIQUE');return source.replace(needle,replacement);}
export function extractFunction(sql,name){
 const start=sql.indexOf(`create function airprop.${name}()`),end=sql.indexOf('$$;',start);
 if(start<0||end<0)throw Error('FUNCTION_BOUNDARY');return sql.slice(start,end+3);
}
// One stable closed catalog projection reused by gates and recovery. No row data.
export const CATALOG=`jsonb_build_object(
 'table',(select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,'options',c.reloptions)
   from pg_catalog.pg_class c where c.oid=to_regclass('${TABLE}')),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'ordinal',a.attnum,
   'not_null',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,'dropped',a.attisdropped,
   'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid=to_regclass('${TABLE}') and a.attnum>0),
 'constraints',(select jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'validated',c.convalidated,
   'deferrable',c.condeferrable,'initially_deferred',c.condeferred,'definition',pg_get_constraintdef(c.oid)) order by c.conname)
   from pg_catalog.pg_constraint c where c.conrelid=to_regclass('${TABLE}')),
 'indexes',(select jsonb_agg(jsonb_build_object('name',x.relname,'definition',pg_get_indexdef(i.indexrelid),
   'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready) order by x.relname)
   from pg_catalog.pg_index i join pg_catalog.pg_class x on x.oid=i.indexrelid where i.indrelid=to_regclass('${TABLE}')),
 'triggers',(select jsonb_agg(jsonb_build_object('name',case when t.tgisinternal then null else t.tgname end,
   'internal',t.tgisinternal,'type',t.tgtype,'function',t.tgfoid::regprocedure::text,'enabled',t.tgenabled,
   'deferrable',t.tgdeferrable,'initially_deferred',t.tginitdeferred,'args',encode(t.tgargs,'hex'),
   'when',pg_get_expr(t.tgqual,t.tgrelid),'columns',t.tgattr::text)
   order by t.tgisinternal,t.tgtype,t.tgfoid::regprocedure::text,case when t.tgisinternal then '' else t.tgname end)
   from pg_catalog.pg_trigger t where t.tgrelid=to_regclass('${TABLE}')),
 'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
   'roles',p.polroles::text,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
   from pg_catalog.pg_policy p where p.polrelid=to_regclass('${TABLE}')),
 'rules',(select jsonb_agg(pg_get_ruledef(r.oid) order by r.rulename) from pg_catalog.pg_rewrite r where r.ev_class=to_regclass('${TABLE}')),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
   'kind',p.prokind,'result',pg_get_function_result(p.oid),'args',pg_get_function_arguments(p.oid),'language',l.lanname,
   'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'volatility',p.provolatile,'strict',p.proisstrict,
   'leakproof',p.proleakproof,'parallel',p.proparallel,'cost',p.procost,'rows',p.prorows,
   'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by p.oid::regprocedure::text)
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang
   where n.nspname='airprop' and p.proname in ('guard_listing_selected_binding_v1','assert_listing_selected_binding_c03_v1')),
 'schemas',(select jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text) order by n.nspname)
   from pg_catalog.pg_namespace n where n.nspname in ('airprop','portfolio','platform','audit','app_private','customer_api','auth')),
 'dependencies',(select jsonb_agg(jsonb_build_object('name',w.name,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text) order by a.attnum)
     from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_catalog.pg_constraint k where k.conrelid=c.oid)) order by w.name)
   from(values('airprop.market_listings'),('portfolio.unit_specification_versions'),('portfolio.parties'),('platform.idempotency_keys'),('audit.events'),('platform.outbox_events'))w(name)
   left join pg_catalog.pg_class c on c.oid=to_regclass(w.name)),
 'helpers',(select jsonb_agg(jsonb_build_object('signature',w.signature,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,
   'config',p.proconfig,'security_definer',p.prosecdef,'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by w.signature)
   from(values('auth.uid()'),('app_private.active_context_id()'),('app_private.active_tenant_id()'))w(signature)
   left join pg_catalog.pg_proc p on p.oid=to_regprocedure(w.signature)),
 'roles',(select jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid) from pg_catalog.pg_roles r),
 'memberships',(select jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor) from pg_catalog.pg_auth_members m),
 'default_acl',(select jsonb_agg(to_jsonb(a) order by a.oid) from pg_catalog.pg_default_acl a),
 'events',(select jsonb_agg(to_jsonb(e) order by e.oid) from pg_catalog.pg_event_trigger e))`;
// DO blocks deliberately remain after the unconditional source guard.
function gate(mode,phase){
 const field=phase==='before'?(mode==='fresh'?'fresh_before':'v1_before'):(mode==='fresh'?'fresh_after':'adapt_after');
 return `DO $gate$ DECLARE p jsonb; image jsonb; actual text; BEGIN
 p:=nullif(current_setting('cladora.airprop_binding_adoption_v2',true),'')::jsonb;
 IF p IS NULL OR p->>'mode' IS DISTINCT FROM '${mode}'
  OR p->>'database_name' IS DISTINCT FROM current_database()
  OR p->>'database_oid' IS DISTINCT FROM (select oid::text from pg_catalog.pg_database where datname=current_database())
  OR p->>'executor' IS DISTINCT FROM current_user OR p->>'session' IS DISTINCT FROM session_user
  OR p->>'${field}' IS NULL OR p->>'${field}' !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'AIRPROP_V2_PLAN_TARGET_OR_COMPILED_IMAGE_REQUIRED' USING ERRCODE='55000'; END IF;
 image:=${CATALOG}; actual:=encode(sha256(convert_to(image::text,'UTF8')),'hex');
 IF actual IS DISTINCT FROM p->>'${field}' THEN RAISE EXCEPTION 'AIRPROP_V2_CATALOG_${phase.toUpperCase()}_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(select 1 from pg_catalog.pg_event_trigger where evtenabled<>'D')
 THEN RAISE EXCEPTION 'AIRPROP_V2_EVENT_TRIGGER_CLOSURE_REQUIRED' USING ERRCODE='55000'; END IF;
 ${phase==='before'&&mode==='fresh'?`IF to_regclass('${TABLE}') IS NOT NULL OR to_regprocedure('airprop.guard_listing_selected_binding_v1()') IS NOT NULL
 OR to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()') IS NOT NULL
 OR EXISTS(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='airprop' and p.proname in ('guard_listing_selected_binding_v1','assert_listing_selected_binding_c03_v1'))
 THEN RAISE EXCEPTION 'AIRPROP_V2_FRESH_REQUIRES_ABSENT' USING ERRCODE='55000'; END IF;`:''}
 ${phase==='before'&&mode==='adapt'?`IF to_regclass('${TABLE}') IS NULL OR NOT EXISTS(select 1 from pg_catalog.pg_class c
 where c.oid=to_regclass('${TABLE}') and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'AIRPROP_V2_ADAPT_REQUIRES_EXACT_V1' USING ERRCODE='55000'; END IF;`:''}
 ${mode==='adapt'?`IF p->>'v1_table_oid' IS DISTINCT FROM to_regclass('${TABLE}')::oid::text
 OR p->>'v1_guard_oid' IS DISTINCT FROM to_regprocedure('airprop.guard_listing_selected_binding_v1()')::oid::text
 OR p->>'v1_receipt_guard_oid' IS DISTINCT FROM to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()')::oid::text
 THEN RAISE EXCEPTION 'AIRPROP_V2_EXISTING_OBJECT_IDENTITY_DRIFT' USING ERRCODE='55000'; END IF;`:''}
 ${mode==='adapt'?`IF NOT EXISTS(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()')
   and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='__V1_RECEIPT_HASH__' and not prosecdef)
 ${phase==='before'?`OR NOT EXISTS(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('airprop.guard_listing_selected_binding_v1()')
   and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='__V1_GUARD_HASH__' and not prosecdef)`:''}
 THEN RAISE EXCEPTION 'AIRPROP_V2_V1_FUNCTION_SOURCE_DRIFT' USING ERRCODE='55000'; END IF;`:''}
 IF EXISTS(select 1 from(values('airprop.market_listings'),('portfolio.unit_specification_versions'),('portfolio.parties'),
 ('platform.idempotency_keys'),('audit.events'),('platform.outbox_events'))w(name) where to_regclass(w.name) IS NULL)
 OR EXISTS(select 1 from(values('auth.uid()'),('app_private.active_context_id()'),('app_private.active_tenant_id()'))w(signature)
 where to_regprocedure(w.signature) IS NULL)
 THEN RAISE EXCEPTION 'AIRPROP_V2_STORAGE_DEPENDENCY_ABSENT' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(select 1 from pg_catalog.pg_attribute where attrelid=to_regclass('portfolio.parties')
 and attname='native_revision_v1' and atttypid='bigint'::regtype and not attisdropped)
 THEN RAISE EXCEPTION 'AIRPROP_V2_CORE_PARTY_REVISION_REQUIRED' USING ERRCODE='55000'; END IF;
 END $gate$;\n`;
}
function constraintSlices(sql){
 const start=sql.indexOf(" check((binding->'binding_version'"),end=sql.indexOf('\n);',start);
 if(start<0||end<0)throw Error('V2_CONSTRAINT_BOUNDARY');
 const tail=sql.slice(start,end);
 const rootAt=tail.indexOf(" check(binding-array"),selectionAt=tail.indexOf(" check((binding->'selection')-array");
 if(rootAt<0||selectionAt<0)throw Error('V2_KEYS_BOUNDARY');
 const version=tail.slice(0,rootAt).trim().replace(/,$/,'');
 const root=tail.slice(rootAt,selectionAt).trim().replace(/,$/,'');
 const selection=tail.slice(selectionAt).trim();
 const mix=(name,value)=>`constraint ${name} check((${legacy}) OR (${value.slice(6,-1)}))`;
 return [mix('listing_selected_binding_v2_versions',version),
  mix('listing_selected_binding_v2_root_keys',root),mix('listing_selected_binding_v2_selection_keys',selection)];
}
export function buildPacket(reader=read){
 const inventory=Object.entries(INPUTS).map(([path,expected])=>{const b=reader(path);if(sha256(b)!==expected)throw Error('SOURCE_PIN:'+path);return {path,bytes:b.length,sha256:expected};});
 const v1=reader(inventory[0].path).toString('utf8'),v2=reader(inventory[1].path).toString('utf8');
 const checks=constraintSlices(v2);
 // The legacy alternative permits old rows to remain, but legacy keys still use
 // their EXACT old whitelist. No new legacy INSERT may pass the invoker guard.
 const oldRoot=v1.slice(v1.indexOf(' check(binding-array'),v1.indexOf(" check((binding->'selection')-array")).trim().replace(/,$/,'');
 const oldSelection=v1.slice(v1.indexOf(" check((binding->'selection')-array"),v1.indexOf('\n);')).trim();
 checks[1]=checks[1].replace(`(${legacy})`, `(${legacy} AND (${oldRoot.slice(6,-1)}))`);
 checks[2]=checks[2].replace(`(${legacy})`, `(${legacy} AND (${oldSelection.slice(6,-1)}))`);
 let guard=extractFunction(v2,'guard_listing_selected_binding_v1');
 guard=requireOne(guard," if auth.uid() is null",` if new.binding->'binding_version' IS DISTINCT FROM '2'::jsonb THEN
   raise exception 'listing_selected_binding_v2_new_insert_required' using errcode='23514';
 end if;
 if auth.uid() is null`);
 const v2TailStart=v2.indexOf(" check((binding->'binding_version'");
 const v2TailEnd=v2.indexOf('\n);',v2TailStart);
 let fresh=v2.slice(v2.indexOf('create table'),v2.lastIndexOf('\ncommit;'));
 fresh=requireOne(fresh,v2.slice(v2TailStart,v2TailEnd),' '+checks.join(',\n '));
 fresh=requireOne(fresh,extractFunction(v2,'guard_listing_selected_binding_v1'),guard);
 // No grants/owner/default ACL changes. AFTER triggers never run for existing
 // rows while validating CHECKs. All old jsonb values and C03 history stay put.
 const adapt=`LOCK TABLE ${TABLE} IN ACCESS EXCLUSIVE MODE;\n`+gate('adapt','before')+`
DO $adapt$ DECLARE p jsonb; n text; names text[]; expected text; BEGIN
 p:=current_setting('cladora.airprop_binding_adoption_v2')::jsonb;
 names:=ARRAY[p#>>'{v1_constraints,root_keys,name}',p#>>'{v1_constraints,selection_keys,name}'];
 IF names[1] IS NULL OR names[2] IS NULL OR names[1]=names[2]
 THEN RAISE EXCEPTION 'AIRPROP_V2_V1_CONSTRAINT_MAPPING_REQUIRED' USING ERRCODE='55000'; END IF;
 FOREACH n IN ARRAY names LOOP
   expected:=CASE WHEN n=names[1] THEN p#>>'{v1_constraints,root_keys,expression_sha256}' ELSE p#>>'{v1_constraints,selection_keys,expression_sha256}' END;
   IF expected IS NULL OR expected !~ '^[a-f0-9]{64}$' OR NOT EXISTS(select 1 from pg_catalog.pg_constraint c
     where c.conrelid='${TABLE}'::regclass and c.conname=n and c.contype='c' and c.convalidated
     and encode(sha256(convert_to(pg_get_expr(c.conbin,c.conrelid),'UTF8')),'hex')=expected)
   THEN RAISE EXCEPTION 'AIRPROP_V2_V1_CONSTRAINT_IMAGE_DRIFT' USING ERRCODE='55000'; END IF;
   EXECUTE format('ALTER TABLE airprop.listing_selected_bindings_v1 DROP CONSTRAINT %I',n);
 END LOOP;
 END $adapt$;
ALTER TABLE ${TABLE} ADD ${checks.join(',\n ADD ')};
${guard.replace('create function','create or replace function')}
`;
 const units={
  'preflight-fresh.sql':prefix(true)+gate('fresh','before')+'ROLLBACK;\n',
  'preflight-adapt.sql':prefix(true)+gate('adapt','before')+'ROLLBACK;\n',
  'fresh.sql':prefix(false)+gate('fresh','before')+fresh+'\n'+gate('fresh','after')+'ROLLBACK;\n',
  'adapt-v1.sql':prefix(false)+gate('adapt','before')+adapt+gate('adapt','after')+'ROLLBACK;\n',
  'verify-fresh.sql':prefix(true)+gate('fresh','after')+'ROLLBACK;\n',
  'verify-adapt.sql':prefix(true)+gate('adapt','after')+'ROLLBACK;\n',
  'recovery.sql':prefix(true)+`SELECT ${CATALOG} AS catalog_image;\nROLLBACK;\n`,
 };
 const bodyHash=name=>{const definition=extractFunction(v1,name);return sha256(definition.slice(definition.indexOf('as $$')+5,definition.lastIndexOf('$$;')));};
 for(const name of Object.keys(units))units[name]=units[name].replaceAll('__V1_GUARD_HASH__',bodyHash('guard_listing_selected_binding_v1'))
  .replaceAll('__V1_RECEIPT_HASH__',bodyHash('assert_listing_selected_binding_c03_v1')).replace(/\n[ \t]+(?=\n)/g,'\n');
 const plan={contract:'airprop-binding-storage-v2.private-plan.v1',mode:null,database_name:null,database_oid:null,executor:null,session:null,
  fresh_before:null,v1_before:null,fresh_after:null,adapt_after:null,
  v1_table_oid:null,v1_guard_oid:null,v1_receipt_guard_oid:null,
  v1_constraints:{root_keys:{name:null,expression_sha256:null},selection_keys:{name:null,expression_sha256:null}},
  target_transport_authority:'EXTERNAL_PLATFORM_ADMISSION_NOT_PROVEN_BY_THIS_JSON',activation:null};
 units['private-plan.template.json']=JSON.stringify(plan,null,2)+'\n';
 const seal={contract:'airprop-binding-storage-v2.seal.v1',base:BASE,inventory,
  units:Object.entries(units).map(([name,bytes])=>({name,bytes:Buffer.byteLength(bytes),sha256:sha256(bytes),
    git_blob:createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex')})),
  sql_compiled:'NOT_RUN_NOT_PASS',activation:null};
 return {units,seal,sealBytes:JSON.stringify(seal,null,2)+'\n'};
}
export function loadSealedPacket(reader,expectedSealSha256){
 if(typeof expectedSealSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSealSha256))throw Error('EXPECTED_SEAL_REQUIRED');
 const actualSeal=reader('seal.json');if(sha256(actualSeal)!==expectedSealSha256)throw Error('SEAL_IDENTITY');
 const expected=buildPacket(),seal=JSON.parse(actualSeal.toString('utf8'));
 if(JSON.stringify(seal)!==JSON.stringify(expected.seal))throw Error('SEAL_SOURCE_OR_INVENTORY');
 const result=[];
 for(const pin of seal.units){
  const bytes=reader(pin.name);if(bytes.length!==pin.bytes||sha256(bytes)!==pin.sha256)throw Error('FRAME_IDENTITY:'+pin.name);
  const text=bytes.toString('utf8');
  if(pin.name.endsWith('.sql')&&(!text.includes(GUARD)||!text.endsWith('ROLLBACK;\n')||/\bCOMMIT\s*;/i.test(text)))throw Error('INACTIVE_FRAME_REQUIRED');
  result.push(Object.freeze({name:pin.name,utf8:text,bytes:bytes.length,sha256:pin.sha256}));
 }
 return Object.freeze({status:'INACTIVE_SOURCE_VERIFIED',activation:null,dispatch:null,units:Object.freeze(result)});
}
/** Offline mode selection is not permission or proof of installed correctness. */
export function selectSourceMode({presence,before,expectedFresh,expectedV1,expectedV2}){
 const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(!Array.isArray(presence)||presence.length!==3||presence.some(x=>typeof x!=='boolean')||!hash(before))return {status:'BLOCKED_INPUT',dispatch:null};
 if(presence.some(Boolean)&&!presence.every(Boolean))return {status:'PARTIAL_INSTALL_STOP',dispatch:null};
 if(presence.every(Boolean)&&hash(expectedV2)&&before===expectedV2)return {status:'ALREADY_PRESENT_REVERIFY',dispatch:null};
 if(presence.every(x=>!x)&&hash(expectedFresh)&&before===expectedFresh)return {status:'FRESH_SOURCE_CANDIDATE',dispatch:null};
 if(presence.every(Boolean)&&hash(expectedV1)&&before===expectedV1)return {status:'V1_ADAPT_SOURCE_CANDIDATE',dispatch:null};
 return {status:'PREIMAGE_UNKNOWN_OR_DRIFT_STOP',dispatch:null};
}
/** Metadata recovery only; never guesses settlement or rewrites a business key. */
export function classifyRecovery({before,after,expectedAfter,settlement='unknown'}){
 const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(!hex(before)||!hex(after)||!hex(expectedAfter))return {status:'BLOCKED_INPUT',repeat:false,business_unknown:'UNCHANGED'};
 if(!['unknown','commit_ack','rollback_ack'].includes(settlement))return {status:'BLOCKED_SETTLEMENT',repeat:false,business_unknown:'UNCHANGED'};
 return {status:after===expectedAfter?'POSTIMAGE_REVERIFY_REQUIRED':after===before?'BEFORE_IMAGE_PRESERVED':'DRIFT_STOP',
  settlement,repeat:false,business_unknown:'UNCHANGED',activation:null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const packet=buildPacket();
 if(process.argv.includes('--write')){
  mkdirSync(resolve(root,DIR),{recursive:true});for(const [name,bytes] of Object.entries(packet.units))writeFileSync(resolve(root,DIR,name),bytes);
  writeFileSync(resolve(root,DIR,'seal.json'),packet.sealBytes);
 }else if(process.argv.includes('--check')){
  for(const [name,bytes] of Object.entries({...packet.units,'seal.json':packet.sealBytes}))if(read(`${DIR}/${name}`).toString('utf8')!==bytes)throw Error('OUTPUT_DRIFT:'+name);
  loadSealedPacket(name=>read(`${DIR}/${name}`),sha256(packet.sealBytes));console.log('PASS V2 source packet identities, inactive loader; no SQL/native');
 }else throw Error('Use --write or --check (offline only)');
}
