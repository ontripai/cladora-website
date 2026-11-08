/** Deterministic SOURCE extraction. Never opens PG, alters a migration or executes SQL. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const PINS={"20261007092932_lifecycle_verified_ownership_transfer.sql": "1fa881f2ebb6a064b8c101b782096bad70630b86ece19d8268700028d81288e1", "20260928130116_20260928113655_scoped_unit_invitations.sql": "6003e11254cddec879cc4ecc5059578d266053a94367740e6c811e969d8fe385", "20260913063638_residential_pilot_import_completion.sql": "64b4fcbb1741ccdc3a690b66eb33569d7b763a380ef08995d21be1562f62f099", "20261004093017_audited_contractor_registration.sql": "ca454e940d2a097ab7c1b2ccf12c051245245b94b746308a74a606dc63a75e46", "20261004202244_20261004200732_service_request_self_person_v1.sql": "59ea589da6e912017334f6055ab7dff2d4473c16dbe4f666bb86247ce3e6c672", "20260929082301_prevent_duplicate_active_unit_grants.sql": "3ee812ff744d550d3aecb187f80d13fb811de01d47048dd7e3450c7c776f4db8", "20260929065846_owner_portfolio_manager_invite.sql": "b06e6a076b2dae6e6be43b23138c7d9557ed8e109c0391d0bc5d2b1bfb7c4084"};
export const WRITERS=Object.freeze([
 ['20260929065846_owner_portfolio_manager_invite.sql','customer_api.claim_unit_invitation_v1','uuid,text','upstream invitation wrapper; invitation lock BEFORE core mapping writer'],
 ['20261007092932_lifecycle_verified_ownership_transfer.sql','customer_api.execute_verified_ownership_transfer_v1','uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text','ownerships; Property->Unit->ownership locks'],
 ['20260928130116_20260928113655_scoped_unit_invitations.sql','customer_api.register_unit_invite_relationship_v1','uuid,uuid,uuid,text,text,text,date,date','Party/ownership INSERT; Unit lock'],
 ['20260913063638_residential_pilot_import_completion.sql','app_private.onboarding_commit_residential_internal_v1','uuid,uuid','Party/ownership import; run/advisory/row locks'],
 ['20260913063638_residential_pilot_import_completion.sql','app_private.onboarding_approve_import_commit_internal_v1','uuid,uuid','upstream approval; run lock BEFORE commit call'],
 ['20261004093017_audited_contractor_registration.sql','maintenance.register_contractor_v1','uuid,uuid,text,text','Party INSERT; vendor advisory lock'],
 ['20261004202244_20261004200732_service_request_self_person_v1.sql','customer_api.register_service_self_person_v1','jsonb','Party/member-party INSERT; C03/advisory/ledger waits'],
 ['20260929082301_prevent_duplicate_active_unit_grants.sql','customer_api.claim_unit_invitation_core_v1','uuid,text','member-party INSERT; invitation lock/membership DML'],
]);
export const BLOCK=`
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END
`;
export function extract(source,name){
 const escaped=name.replaceAll('.','\\.');
 const matches=[...source.matchAll(new RegExp(`create(?: or replace)? function ${escaped}\\s*\\(`,'ig'))];
 if(matches.length!==1)throw Error('SOURCE_FUNCTION_AMBIGUOUS:'+name);
 const start=matches[0].index,rest=source.slice(start),as=/\bas\s+(\$[\w]*\$)/i.exec(rest);
 if(!as)throw Error('SOURCE_DELIMITER_MISSING');
 const bodyStart=as.index+as[0].length,bodyEnd=rest.indexOf(as[1],bodyStart);
 if(bodyEnd<0||!/^\$[\w]*\$\s*;/.test(rest.slice(bodyEnd)))throw Error('SOURCE_DELIMITER_INVALID');
 const finish=bodyEnd+rest.slice(bodyEnd).match(/^\$[\w]*\$\s*;/)[0].length;
 return{definition:rest.slice(0,finish),body:rest.slice(bodyStart,bodyEnd),bodyStart,bodyEnd,line:source.slice(0,start).split('\n').length};
}
export function transform(original){
 const begin=/\bbegin\b/i.exec(original.body);if(!begin)throw Error('SOURCE_ENTRY_MISSING');
 const at=original.bodyStart+begin.index+begin[0].length;
 // Callback/literal splicing: $$ must never pass through replacement-string expansion.
 return original.definition.slice(0,at)+BLOCK+original.definition.slice(at);
}
export function normalizeHeader(s){return s.replace(/^create(?: or replace)? function/i,'create function');}
export function build(read=path=>readFileSync(resolve(ROOT,path),'utf8')){
 return WRITERS.map(([file,name,args,reason])=>{
  const path='supabase/migrations/'+file,source=read(path);
  if(sha(source)!==PINS[file])throw Error('SOURCE_PIN_MISMATCH:'+path);
  const old=extract(source,name),transformed=transform(old);
  const definition=transformed.replace(/^create(?: or replace)? function/i,()=> 'create or replace function');
  if(normalizeHeader(definition.replace(BLOCK,''))!==normalizeHeader(old.definition))throw Error('NONMINIMAL_FUNCTION_CHANGE');
  const body=old.body.replace(/\bbegin\b/i,m=>m+BLOCK);
  return{path,name,signature:name+'('+args+')',reason,line:old.line,before:old.definition,after:definition,bodyBefore:old.body,bodyAfter:body};
 });
}
const dir='supabase/proposals/core-listing-writer-lock-v1/';
export function observationSQL(rows,after){
 return rows.map(r=>`('${r.signature}','${sha(after?r.bodyAfter:r.bodyBefore)}')`).join(',\n');
}
export function preflightSQL(rows,after=false){return `-- READ-ONLY source/owner privilege gate; NOT executed by generation.\nBEGIN READ ONLY;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL search_path=pg_catalog;\nDO $check$\nDECLARE e jsonb; r record; p pg_proc; owner_role pg_roles; epoch pg_class;\nBEGIN\n e:=nullif(current_setting('cladora.listing_writer_target_v1',true),'')::jsonb;\n IF e IS NULL OR e->>'database_name' IS DISTINCT FROM current_database()\n  OR e->>'database_oid' IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())\n  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999\n THEN RAISE EXCEPTION 'listing_writer_target_unbound' USING ERRCODE='55000'; END IF;\n SELECT * INTO STRICT epoch FROM pg_class WHERE oid='app_private.canonical_authority_revision_v1'::regclass;\n FOR r IN SELECT * FROM(VALUES\n${observationSQL(rows,after)}\n )v(signature,body_sha256) LOOP\n  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);\n  IF NOT FOUND THEN\n   IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'absent' THEN\n    RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;\n   CONTINUE;\n  END IF;\n  IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'present' THEN\n   RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;\n  IF encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.body_sha256\n   OR NOT p.prosecdef OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')\n   OR NOT pg_has_role(current_user,p.proowner,'USAGE')\n  THEN RAISE EXCEPTION 'listing_writer_source_or_owner_mismatch' USING ERRCODE='55000'; END IF;\n  SELECT * INTO STRICT owner_role FROM pg_roles WHERE oid=p.proowner;\n  IF NOT has_schema_privilege(owner_role.oid,'app_private','USAGE')\n   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'singleton','SELECT')\n   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'revision','UPDATE')\n   OR (epoch.relrowsecurity AND NOT(owner_role.rolsuper OR owner_role.rolbypassrls\n     OR(epoch.relowner=owner_role.oid AND NOT epoch.relforcerowsecurity)))\n  THEN RAISE EXCEPTION 'listing_writer_epoch_privilege_or_rls_not_proven' USING ERRCODE='55000'; END IF;\n  -- Private admitted snapshot of ALL non-body catalog attributes, not only ACL.\n  IF e->'routine_metadata'->>r.signature IS DISTINCT FROM\n   encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex')\n  THEN RAISE EXCEPTION 'listing_writer_metadata_unbound' USING ERRCODE='55000'; END IF;\n END LOOP;\n IF NOT EXISTS(SELECT 1 FROM app_private.canonical_authority_revision_v1 WHERE singleton) THEN\n  RAISE EXCEPTION 'canonical_authority_revision_unavailable' USING ERRCODE='55000'; END IF;\nEND\n$check$;\nROLLBACK;\n`;}
export function deltaSQL(rows){
 const checks=after=>{const q=preflightSQL(rows,after);return q.slice(q.indexOf('DO $check$'),q.lastIndexOf('ROLLBACK;'));};
 const defs=rows.map((r,i)=>`-- Exact source: ${r.path}:${r.line}
DO $replace_${i}$ BEGIN
 IF to_regprocedure('${r.signature}') IS NOT NULL THEN
  EXECUTE $definition_${i}$${r.after}$definition_${i}$;
 END IF;
END $replace_${i}$;`).join('\n\n');
 return `-- Inactive versioned writer-order delta. NOT a migration/installer.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $not_admitted$ BEGIN
 RAISE EXCEPTION 'core_listing_writer_adoption_not_admitted' USING ERRCODE='55000';
END $not_admitted$;
-- Separate reviewed adoption must rebind private target/metadata/presence first.
-- Quiescent schema-change window is mandatory; no shared-catalog lock is added.
${checks(false)}
CREATE TEMP TABLE core_listing_writer_before_v1 ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p)-'prosrc' AS metadata FROM pg_proc p
 WHERE p.oid IN (${rows.map(r=>`to_regprocedure('${r.signature}')`).join(',')});
${defs}
DO $preserve$ BEGIN
 IF EXISTS(SELECT 1 FROM core_listing_writer_before_v1 b LEFT JOIN pg_proc p ON p.oid=b.oid
  WHERE p.oid IS NULL OR b.metadata IS DISTINCT FROM(to_jsonb(p)-'prosrc')) THEN
  RAISE EXCEPTION 'listing_writer_metadata_changed' USING ERRCODE='55000'; END IF;
END $preserve$;
${checks(true)}
-- No publication or data mutation. Private verified adoption is still required.
ROLLBACK;
`;
}
export function observeSQL(rows){return `-- Proposed bounded catalog observation ONLY; not executed. No function bodies/raw ACL.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
WITH wanted AS(SELECT * FROM(VALUES
${rows.map(r=>`('${r.signature}')`).join(',\n')}
)v(signature)), projected AS(
 SELECT w.signature,p.oid IS NOT NULL AS present,
  CASE WHEN p.oid IS NULL THEN NULL ELSE encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') END AS body_sha256,
  CASE WHEN p.oid IS NULL THEN NULL ELSE encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex') END AS metadata_sha256
 FROM wanted w LEFT JOIN pg_proc p ON p.oid=to_regprocedure(w.signature)
)
SELECT current_database() AS database_name,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
 current_setting('server_version_num') AS server_version_num,pg_backend_pid() AS observation_pid,
 jsonb_object_agg(signature,CASE WHEN present THEN 'present' ELSE 'absent' END) AS routine_presence,
 jsonb_object_agg(signature,metadata_sha256) AS routine_metadata,
 jsonb_object_agg(signature,body_sha256) AS routine_body_sha256
FROM projected;
ROLLBACK;
`;}
export function outputs(rows){return{[dir+'delta.sql']:deltaSQL(rows),[dir+'observe.sql']:observeSQL(rows),[dir+'preflight.sql']:preflightSQL(rows),[dir+'verify.sql']:preflightSQL(rows,true)};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const rows=build();for(const[path,text]of Object.entries(outputs(rows))){
  if(process.argv.includes('--check')){if(readFileSync(resolve(ROOT,path),'utf8')!==text)throw Error('GENERATED_BYTES_DRIFT:'+path);}
  else writeFileSync(resolve(ROOT,path),text);
 }
 console.log(JSON.stringify({writers:rows.length,state:'SOURCE_ONLY',SQL_EXECUTED:false}));
}
