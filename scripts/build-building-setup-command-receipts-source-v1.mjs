/** Inactive source composer. Text/hash processing only; no SQL client, parser or apply runner. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const BASE='8c8225fb3297035a2349357bd968d60779388063';
export const OWNER_DECISION='https://github.com/ontripai/cladora-website/issues/463#issuecomment-6402239373';
export const MODULE='supabase/hosted-building-slice/building-setup-command-receipts-v1.sql';
export const MANIFEST='docs/architecture/cladora-building-setup-command-receipts-v1.manifest.json';
export const MIGRATION='supabase/migrations/20261025214155_building_setup_command_receipts_v1.sql';
export const NAMING_RECEIPT={
 report:'https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403717235',
 blob:'331c7274e728e73967c093312bae7f59092bff5c',bytes:14115,
 sha256:'c523fcbf9181206f4de4fcb817174ef788bef2340a6e7f459860fdfbffb73b6c',
 cli_version:'2.121.0',invocations:1,exit:0,suffix:'building_setup_command_receipts_v1',
 original_empty_bytes:0,original_empty_sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export function identity(s){const b=Buffer.from(s);return {bytes:b.length,sha256:sha256(b),git_blob:createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')}}
export function extractFunction(source,name){
 const match=new RegExp('^create (?:or replace )?function '+name.replaceAll('.','\\.')+'\\(','m').exec(source);
 if(!match)throw Error('missing source function '+name);
 const begin=match.index,tail=source.slice(begin);const tag=/\bas\s+(\$[A-Za-z_0-9]*\$)/i.exec(tail);
 if(!tag)throw Error('unsupported pinned function framing '+name);
 const close=tail.indexOf(tag[1],tag.index+tag[0].length);if(close<0||tail[close+tag[1].length]!==';')throw Error('unclosed function '+name);
 const text=tail.slice(0,close+tag[1].length+1)+'\n';
 return {text,byte_start:Buffer.byteLength(source.slice(0,begin)),byte_length:Buffer.byteLength(text),lines:[source.slice(0,begin).split('\n').length,source.slice(0,begin+text.trimEnd().length).split('\n').length],sha256:sha256(text)};
}
export const STORE_SQL="\ncreate function app_private.building_setup_command_evidence_valid_v1(p_receipt jsonb,p_before jsonb,p_input jsonb,p_action text,\n p_expected integer,p_run uuid,p_workspace uuid,p_key text)\nreturns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $shape$\ndeclare wanted text;\nbegin\n if p_receipt is null or p_before is null or p_input is null or jsonb_typeof(p_receipt)<>'object'\n  or jsonb_typeof(p_before)<>'object' or jsonb_typeof(p_input)<>'object'\n  or (select array_agg(k order by k) from jsonb_object_keys(p_receipt) k) is distinct from\n   array['command_key','expected_revision','operation','payload_hash','property_id','revision','run_id','status','version','workspace_id']::text[]\n  or (select array_agg(k order by k) from jsonb_object_keys(p_before) k) is distinct from array['payload_hash','revision','status']::text[]\n  or (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['expected_payload_hash','units']::text[] then return false; end if;\n wanted:=case p_action when 'update' then 'draft' when 'rehearse' then 'rehearsed' when 'submit' then 'submitted' when 'approve' then 'approved' when 'provision' then 'provisioned' else null end;\n if wanted is null or not coalesce(jsonb_typeof(p_receipt->'version')='number' and (p_receipt->>'version')::integer=2\n  and jsonb_typeof(p_receipt->'revision')='number' and (p_receipt->>'revision')::integer=p_expected+1\n  and jsonb_typeof(p_receipt->'expected_revision')='number' and (p_receipt->>'expected_revision')::integer=p_expected\n  and (p_before->>'revision')::integer=p_expected and p_receipt->>'operation'=p_action and p_receipt->>'command_key'=p_key\n  and (p_receipt->>'run_id')::uuid=p_run and (p_receipt->>'workspace_id')::uuid=p_workspace\n  and p_receipt->>'status'=wanted and p_receipt->>'payload_hash' ~ '^[0-9a-f]{64}$' and p_before->>'payload_hash' ~ '^[0-9a-f]{64}$',false) then return false; end if;\n if p_action='provision' then if jsonb_typeof(p_receipt->'property_id')<>'string' or (p_receipt->>'property_id')::uuid is null then return false; end if;\n elsif p_receipt->'property_id' is distinct from 'null'::jsonb then return false; end if;\n if p_action='update' then\n  if p_before->>'status'<>'draft' then return false; end if;\n  perform app_private.validate_setup_units_v2(p_input->'units');\n elsif p_input->'units' is distinct from 'null'::jsonb or p_before->>'payload_hash' is distinct from p_receipt->>'payload_hash' then return false; end if;\n if p_action='approve' then\n  if p_before->>'status'<>'submitted' or p_input->>'expected_payload_hash' is distinct from p_before->>'payload_hash' then return false; end if;\n elsif p_input->'expected_payload_hash' is distinct from 'null'::jsonb then return false; end if;\n if (p_action='rehearse' and p_before->>'status' not in('draft','rehearsed'))\n  or (p_action='submit' and p_before->>'status'<>'rehearsed') or (p_action='provision' and p_before->>'status'<>'approved') then return false; end if;\n return true;\nexception when invalid_text_representation or numeric_value_out_of_range then return false;\nend; $shape$;\n\n-- G2.STORES: domain evidence only; no user/Auth/fixture/application-state seed.\ncreate table platform.building_setup_command_receipt_epochs (\n epoch_id text primary key check(epoch_id='building-g2-pm169-v1'),\n protocol integer not null check(protocol=1), source_contract_hash text not null check(source_contract_hash ~ '^[0-9a-f]{64}$'),\n guarantee_decision text not null check(guarantee_decision='APPROVED_SCOPED_BUILDING_FINAL_TRANSACTION_GUARANTEE'),\n retention_policy_id text check(retention_policy_id is null), pruning_enabled boolean not null check(not pruning_enabled)\n);\ncreate table platform.building_setup_command_coverage (\n run_id uuid primary key references platform.building_setup_runs(id) on delete restrict,\n tenant_id uuid not null, workspace_id uuid not null, creation_request_hash text not null check(creation_request_hash ~ '^[0-9a-f]{64}$'),\n epoch_id text not null references platform.building_setup_command_receipt_epochs(epoch_id) on delete restrict,\n from_expected_revision integer not null check(from_expected_revision=1)\n);\ncreate table platform.building_setup_command_receipts (\n tenant_id uuid not null, workspace_id uuid not null, run_id uuid not null references platform.building_setup_runs(id) on delete restrict,\n command_key text not null, actor_id uuid not null, context_id uuid not null, membership_id uuid not null,\n writer_session_id uuid not null, operation text not null check(operation in ('update','rehearse','submit','approve','provision')),\n expected_revision integer not null check(expected_revision between 1 and 2147483646),\n request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),\n input_descriptor jsonb not null check(jsonb_typeof(input_descriptor)='object' and input_descriptor ?& array['units','expected_payload_hash']),\n before_record jsonb not null check(jsonb_typeof(before_record)='object'), receipt jsonb not null check(jsonb_typeof(receipt)='object'),\n epoch_id text not null references platform.building_setup_command_receipt_epochs(epoch_id) on delete restrict,\n recorded_at timestamptz not null default clock_timestamp(),\n primary key(tenant_id,workspace_id,run_id,command_key), unique(run_id,expected_revision),\n check(command_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' and command_key like 'setup-'||run_id::text||'-r'||expected_revision::text||'-%'),\n check(app_private.building_setup_command_evidence_valid_v1(receipt,before_record,input_descriptor,operation,expected_revision,run_id,workspace_id,command_key)),\n check(coalesce((receipt->>'version')::integer=2 and receipt->>'command_key'=command_key and receipt->>'operation'=operation\n  and (receipt->>'run_id')::uuid=run_id and (receipt->>'workspace_id')::uuid=workspace_id\n  and (receipt->>'expected_revision')::integer=expected_revision and (receipt->>'revision')::integer=expected_revision+1\n  and (before_record->>'revision')::integer=expected_revision,false))\n);\nalter table platform.building_setup_command_receipt_epochs enable row level security;\nalter table platform.building_setup_command_coverage enable row level security;\nalter table platform.building_setup_command_receipts enable row level security;\ncreate function app_private.protect_building_setup_command_evidence_v1() returns trigger\nlanguage plpgsql security invoker set search_path=pg_catalog as $immutable$\nbegin\n raise exception 'setup_g2_evidence_immutable' using errcode='42501';\nend; $immutable$;\ncreate trigger building_command_epoch_immutable before update or delete or truncate on platform.building_setup_command_receipt_epochs\n for each statement execute function app_private.protect_building_setup_command_evidence_v1();\ncreate trigger building_command_coverage_immutable before update or delete or truncate on platform.building_setup_command_coverage\n for each statement execute function app_private.protect_building_setup_command_evidence_v1();\ncreate trigger building_command_receipt_immutable before update or delete or truncate on platform.building_setup_command_receipts\n for each statement execute function app_private.protect_building_setup_command_evidence_v1();\n-- Source identity, not an install receipt, historical migration ledger or retention approval.\ninsert into platform.building_setup_command_receipt_epochs\n values('building-g2-pm169-v1',1,'__SOURCE_CONTRACT__','APPROVED_SCOPED_BUILDING_FINAL_TRANSACTION_GUARANTEE',null,false);\n";
export const CHECKPOINT_SQL="\ncreate function app_private.require_building_setup_command_checkpoint_v1(p_context_id uuid,p_workspace_id uuid,p_action text)\nreturns jsonb language plpgsql volatile security definer called on null input set search_path=pg_catalog\nas $checkpoint$\ndeclare checked_at timestamptz; permission text; binding jsonb; gate record;\nbegin\n if current_setting('transaction_isolation') is distinct from 'read committed' then\n  raise exception 'setup_checkpoint_profile_mismatch' using errcode='25001'; end if;\n permission:=case when p_action in('read','recover') then 'onboarding.import.read'\n  when p_action='approve' then 'onboarding.import.approve'\n  when p_action in('create','update','rehearse','submit','provision') then 'onboarding.import.manage' else null end;\n if permission is null or p_context_id is null or p_workspace_id is null then raise exception 'setup_checkpoint_target_required' using errcode='42501'; end if;\n checked_at:=clock_timestamp();\n -- One fresh SPI query: session, time and full native domain authority share one snapshot/T.\n select app_private.require_request_session_current_at_v1(checked_at) as session_check,\n  to_jsonb(a)||jsonb_build_object('context_id',p_context_id,'session_id',(auth.jwt()->>'session_id')::uuid) as tuple\n into strict gate\n from app_private.require_building_setup_authority_at_v1(p_context_id,p_workspace_id,permission,p_action,checked_at) a;\n binding:=gate.tuple;\n if binding->>'actor_id' is distinct from auth.uid()::text or binding->>'workspace_id' is distinct from p_workspace_id::text\n  or exists(select 1 from unnest(array['tenant_id','workspace_id','membership_id','actor_id','context_id','session_id']) k where binding->>k is null) then\n  raise exception 'setup_authority_contract_invalid' using errcode='42501'; end if;\n return binding;\nend; $checkpoint$;\n\ncreate function app_private.assert_building_setup_command_checkpoint_v1(p_context_id uuid,p_workspace_id uuid,p_action text,p_original jsonb)\nreturns void language plpgsql volatile security definer set search_path=pg_catalog as $assert$\ndeclare current_tuple jsonb;\nbegin\n current_tuple:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action);\n if current_tuple is distinct from p_original then raise exception 'setup_checkpoint_tuple_changed' using errcode='42501'; end if;\nend; $assert$;\n\ncreate function app_private.assert_building_setup_g2_followon_v1() returns void\nlanguage plpgsql volatile security definer set search_path=pg_catalog as $closure$\ndeclare target oid;\nbegin\n -- These are the complete application-write relations of this domain closure.\n foreach target in array array['platform.building_setup_runs'::regclass::oid,'portfolio.properties'::regclass::oid,\n  'portfolio.buildings'::regclass::oid,'portfolio.units'::regclass::oid,'finance.accounting_periods'::regclass::oid,\n  'platform.workspace_property_bindings'::regclass::oid,'identity.context_grants'::regclass::oid,\n  'app_private.canonical_authority_revision_v1'::regclass::oid,'audit.events'::regclass::oid,\n  'platform.building_setup_command_receipts'::regclass::oid,'platform.building_setup_command_coverage'::regclass::oid,\n  'platform.building_setup_command_receipt_epochs'::regclass::oid] loop\n  if exists(select 1 from pg_constraint where conrelid=target and (condeferrable or not convalidated))\n   or exists(select 1 from pg_trigger where tgrelid=target and (tgdeferrable or tginitdeferred)) then\n   raise exception 'setup_g2_unknown_deferred_followon' using errcode='55000'; end if;\n  if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace\n   where t.tgrelid=target and t.tgenabled<>'D' and not t.tgisinternal and n.nspname||'.'||p.proname<>all(array[\n    'app_private.bind_provisioned_building_workspace_v1','app_private.protect_setup_creation_v2',\n    'finance.protect_accounting_period','finance.assert_accounting_period_no_overlap','finance.assert_accounting_period_property_tenant',\n    'app_private.set_updated_at','app_private.guard_workspace_property_binding_history_v1','app_private.guard_workspace_property_binding_v1',\n    'platform.cap_customer_context_to_membership','app_private.bump_canonical_authority_revision_v1',\n    'app_private.guard_authority_revision_v1','app_private.guard_jurisdiction_bound_property_address_v1',\n    'app_private.protect_building_setup_command_evidence_v1'])) then\n   raise exception 'setup_g2_unknown_trigger_followon' using errcode='55000'; end if;\n end loop;\nend; $closure$;\n";
export const READER_SQL="\ncreate function app_private.get_building_setup_command_receipt_v1(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,\n p_command_key text,p_operation text,p_expected_revision integer)\nreturns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $lookup$\ndeclare initial jsonb; permission_tuple jsonb; r platform.building_setup_runs%rowtype;\n e platform.building_setup_command_receipts%rowtype; coverage platform.building_setup_command_coverage%rowtype;\n epoch platform.building_setup_command_receipt_epochs%rowtype; envelope jsonb; result jsonb; covered boolean:=false;\nbegin\n initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover');\n if p_operation not in('update','rehearse','submit','approve','provision') or p_operation is null\n  or p_expected_revision is null or p_expected_revision not between 1 and 2147483646\n  or p_command_key is null or p_command_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'\n  or p_command_key not like 'setup-'||p_run_id::text||'-r'||p_expected_revision::text||'-%' then\n  raise exception 'setup_invalid_command_key' using errcode='22023'; end if;\n perform app_private.assert_building_setup_g2_followon_v1();\n select * into r from platform.building_setup_runs where id=p_run_id\n  and tenant_id=(initial->>'tenant_id')::uuid and customer_workspace_id=p_workspace_id for share;\n if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;\n perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover',initial);\n -- No full-run reader/status exception is used for the minimal own-approval reader.\n if p_operation='approve' then\n  permission_tuple:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'approve');\n  if permission_tuple is distinct from initial then raise exception 'setup_authority_contract_invalid' using errcode='42501'; end if;\n elsif r.created_by<>(initial->>'actor_id')::uuid then raise exception 'setup_actor_denied' using errcode='42501'; end if;\n select * into epoch from platform.building_setup_command_receipt_epochs where epoch_id='building-g2-pm169-v1';\n if not found or epoch.protocol<>1 or epoch.pruning_enabled or epoch.retention_policy_id is not null\n  or epoch.source_contract_hash<>'__SOURCE_CONTRACT__' then raise exception 'setup_g2_epoch_unavailable' using errcode='55000'; end if;\n select * into coverage from platform.building_setup_command_coverage where run_id=r.id;\n covered:=found and coverage.tenant_id=r.tenant_id and coverage.workspace_id=r.customer_workspace_id\n  and coverage.creation_request_hash=r.creation_request_hash and coverage.epoch_id=epoch.epoch_id\n  and coverage.from_expected_revision=1 and p_expected_revision>=coverage.from_expected_revision;\n envelope:=jsonb_build_object('version',1,'scope',initial-'session_id'||jsonb_build_object('run_id',r.id),\n  'command',jsonb_build_object('command_key',p_command_key,'operation',p_operation,'expected_revision',p_expected_revision),\n  'coverage',jsonb_build_object('status',case when covered then 'covered' else 'uncovered' end,\n   'epoch_id',case when covered then epoch.epoch_id else null end,'from_expected_revision',case when covered then 1 else null end,'checked_at',clock_timestamp()),\n  'retention',jsonb_build_object('status','activation_hold','policy_id',null));\n select * into e from platform.building_setup_command_receipts where tenant_id=r.tenant_id and workspace_id=r.customer_workspace_id\n  and run_id=r.id and command_key=p_command_key and actor_id=(initial->>'actor_id')::uuid\n  and context_id=p_context_id and membership_id=(initial->>'membership_id')::uuid;\n if found then\n  if e.actor_id<>(initial->>'actor_id')::uuid or e.context_id<>p_context_id or e.membership_id<>(initial->>'membership_id')::uuid then\n   raise exception 'setup_actor_denied' using errcode='42501'; end if;\n  if e.operation<>p_operation or e.expected_revision<>p_expected_revision then\n   result:=envelope||jsonb_build_object('outcome','conflict','reason','own_command_descriptor_mismatch');\n  else\n   if e.epoch_id<>epoch.epoch_id or e.request_hash is distinct from encode(extensions.digest(jsonb_build_object(\n    'actor',e.actor_id,'tenant',e.tenant_id,'workspace',e.workspace_id,'run',e.run_id,'operation',e.operation,\n    'expected_revision',e.expected_revision,'units',e.input_descriptor->'units',\n    'expected_payload_hash',e.input_descriptor->'expected_payload_hash')::text,'sha256'),'hex') then\n    raise exception 'setup_g2_evidence_binding_invalid' using errcode='55000'; end if;\n   result:=envelope||jsonb_build_object('outcome','complete','evidence',jsonb_build_object(\n    'request_hash',e.request_hash,'input_descriptor',e.input_descriptor,'before_record',e.before_record,\n    'receipt',e.receipt,'epoch_id',e.epoch_id,'recorded_at',e.recorded_at));\n  end if;\n elsif covered and r.revision=p_expected_revision and p_operation<>'approve' then result:=envelope||jsonb_build_object('outcome','absent');\n else result:=envelope||jsonb_build_object('outcome','unknown','reason',case when covered then 'coverage_gap' else 'legacy_uncovered' end); end if;\n perform app_private.assert_building_setup_g2_followon_v1();\n perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover',initial);\n if p_operation='approve' then perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'approve',initial); end if;\n return result;\nend; $lookup$;\ncreate function customer_api.get_building_setup_command_receipt_v1(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,\n p_command_key text,p_operation text,p_expected_revision integer)\nreturns jsonb language sql security invoker set search_path=pg_catalog as $gateway$\n select app_private.get_building_setup_command_receipt_v1(p_context_id,p_workspace_id,p_run_id,p_command_key,p_operation,p_expected_revision)\n$gateway$;\n";

export function timedAuthority(source){
 let s=extractFunction(source,'app_private.require_building_setup_authority_v2').text;
 s=s.replace('require_building_setup_authority_v2(', 'require_building_setup_authority_at_v1(')
  .replace('p_permission pg_catalog.text,p_action pg_catalog.text','p_permission pg_catalog.text,p_action pg_catalog.text,p_checked_at pg_catalog.timestamptz')
  .replace(/statement_timestamp\(\)/g,'p_checked_at')
  .replace('begin\n',"begin\n if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then raise exception 'setup_checkpoint_time_invalid' using errcode='42501'; end if;\n")
  .replace('app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id)', 'app_private.resolve_workspace_native_context_v2_at_v1(p_context_id,p_workspace_id,p_checked_at)')
  .replace("app_private.check_workspace_native_permission_v2(\n     p_context_id,p_workspace_id,p_permission,'building_setup')", "app_private.check_workspace_native_permission_v2_at_v1(\n     p_context_id,p_workspace_id,p_permission,'building_setup',p_checked_at)")
  .replace("a.id,v_permission_id,module_id,'workspace',p_workspace_id)","a.id,v_permission_id,module_id,'workspace',p_workspace_id,array[]::uuid[],p_checked_at)")
  .replace('app_private.workspace_member_role_authority_active_v1(', 'app_private.workspace_member_role_authority_active_v1_at_v1(');
 if(/statement_timestamp\(|app_private\.resolve_workspace_native_context_v2\(/.test(s))throw Error('incomplete domain time transformation');
 return s;
}
const checkpoint=(context='p_context_id',workspace='p_workspace_id',action='p_action',tuple='initial')=>` perform app_private.assert_building_setup_command_checkpoint_v1(${context},${workspace},${action},${tuple});\n`;
export function createWriter(source){
 let s=extractFunction(source,'app_private.create_building_setup_v2').text;
 s=s.replace('v_receipt jsonb;','v_receipt jsonb; initial jsonb;');
 s=s.replace('begin\n',`begin\n initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create');\n perform app_private.assert_building_setup_g2_followon_v1();\n`);
 s=s.replace(' select * into r from platform.building_setup_runs',checkpoint('p_context_id','p_workspace_id',"'create'")+' select * into r from platform.building_setup_runs');
 s=s.replace(' if found then\n',checkpoint('p_context_id','p_workspace_id',"'create'")+' if found then\n');
 // PL/pgSQL FOUND must be consumed before a checkpoint executes another SQL command.
 s=s.replace('v_receipt jsonb; initial jsonb;', 'v_receipt jsonb; initial jsonb; existing boolean;');
 s=s.replace('for update;\n'+checkpoint('p_context_id','p_workspace_id',"'create'")+' if found then','for update;\n existing:=found;\n'+checkpoint('p_context_id','p_workspace_id',"'create'")+' if existing then');
 s=s.replace('  return r.creation_receipt;',checkpoint('p_context_id','p_workspace_id',"'create'")+'  return r.creation_receipt;');
 s=s.replace(' insert into platform.building_setup_runs',checkpoint('p_context_id','p_workspace_id',"'create'")+' insert into platform.building_setup_runs');
 const end=' return v_receipt;';
 const tail=checkpoint('p_context_id','p_workspace_id',"'create'")+` insert into platform.building_setup_command_coverage(run_id,tenant_id,workspace_id,creation_request_hash,epoch_id,from_expected_revision)
 values(v_id,c.tenant_id,c.workspace_id,v_hash,'building-g2-pm169-v1',1);
`+checkpoint('p_context_id','p_workspace_id',"'create'")+` perform app_private.assert_building_setup_g2_followon_v1();\n`+checkpoint('p_context_id','p_workspace_id',"'create'")+end;
 s=s.replace(end,tail);return s;
}
export function commandWriter(source){
 let s=extractFunction(source,'app_private.command_building_setup_v2').text;
 s=s.replace('v_payload jsonb;v_status text;v_property uuid;v_building uuid;x jsonb;',
  'v_payload jsonb;v_status text;v_property uuid;v_building uuid;x jsonb; initial jsonb; e platform.building_setup_command_receipts%rowtype; before_record jsonb;');
 s=s.replace('begin\n',`begin\n initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action);\n perform app_private.assert_building_setup_g2_followon_v1();\n if (p_action<>'update' and p_units is not null) or (p_action<>'approve' and p_expected_payload_hash is not null) then raise exception 'setup_invalid_command_input' using errcode='22023'; end if;\n`);
 s=s.replace(" if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;", " if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;\n"+checkpoint());
 const last=" if r.last_command_key=p_command_key then";
 s=s.replace(last,` before_record:=jsonb_build_object('revision',r.revision,'status',r.status,'payload_hash',r.payload_hash);
 -- Exact immutable original proof precedes stale/state-specific rejection.
 select * into e from platform.building_setup_command_receipts where tenant_id=c.tenant_id and workspace_id=c.workspace_id and run_id=r.id and command_key=p_command_key;
 if found then
  if e.actor_id<>c.actor_id or e.context_id<>p_context_id or e.membership_id<>c.membership_id
   or e.operation<>p_action or e.expected_revision<>p_expected_revision or e.request_hash<>v_hash
   or e.input_descriptor is distinct from jsonb_build_object('units',p_units,'expected_payload_hash',p_expected_payload_hash)
   or e.epoch_id<>'building-g2-pm169-v1' then raise exception 'setup_revision_conflict' using errcode='40001'; end if;
`+checkpoint()+`  return e.receipt;
 end if;
`+last);
 s=s.replace('  return r.last_command_receipt;',checkpoint()+'  return r.last_command_receipt;');
 s=s.replace('  insert into portfolio.properties',checkpoint()+'  insert into portfolio.properties');
 s=s.replace('  insert into portfolio.buildings',checkpoint()+'  insert into portfolio.buildings');
 s=s.replace('  for x in select value',checkpoint()+'  for x in select value');
 s=s.replace('   insert into portfolio.units',checkpoint()+'   insert into portfolio.units');
 s=s.replace('  end loop;',checkpoint()+'  end loop;');
 s=s.replace('  insert into finance.accounting_periods',checkpoint()+'  insert into finance.accounting_periods');
 // Insert the immutable proof before the run UPDATE's AFTER trigger. It is not
 // visible outside the transaction; every later effect/check must still succeed.
 const update=' update platform.building_setup_runs set revision=r.revision+1';
 const proof=checkpoint()+` v_receipt:=jsonb_build_object('version',2,'run_id',r.id,'workspace_id',r.customer_workspace_id,'revision',r.revision+1,
 'status',v_status,'payload_hash',encode(extensions.digest(v_payload::text,'sha256'),'hex'),'expected_revision',p_expected_revision,
 'operation',p_action,'command_key',p_command_key,'property_id',v_property);
 insert into platform.building_setup_command_receipts(tenant_id,workspace_id,run_id,command_key,actor_id,context_id,membership_id,writer_session_id,
 operation,expected_revision,request_hash,input_descriptor,before_record,receipt,epoch_id)
 values(c.tenant_id,c.workspace_id,r.id,p_command_key,c.actor_id,p_context_id,c.membership_id,(initial->>'session_id')::uuid,
 p_action,p_expected_revision,v_hash,jsonb_build_object('units',p_units,'expected_payload_hash',p_expected_payload_hash),before_record,v_receipt,'building-g2-pm169-v1');
`+checkpoint();
 s=s.replace(update,proof+update);
 s=s.replace(' v_receipt:=jsonb_build_object(\'version\',2,\'run_id\',r.id,\'workspace_id\',r.customer_workspace_id,\'revision\',r.revision,',checkpoint()+" v_receipt:=jsonb_build_object('version',2,'run_id',r.id,'workspace_id',r.customer_workspace_id,'revision',r.revision,");
 s=s.replace(' update platform.building_setup_runs set last_command_key',checkpoint()+' update platform.building_setup_runs set last_command_key');
 s=s.replace(' insert into audit.events',checkpoint()+' insert into audit.events');
 s=s.replace(' return v_receipt;',checkpoint()+` perform app_private.assert_building_setup_g2_followon_v1();\n`+checkpoint()+' return v_receipt;');
 return s;
}
export function bindingTrigger(source){
 let s=extractFunction(source,'app_private.bind_provisioned_building_workspace_v1').text;
 s=s.replace('set search_path=pg_catalog,platform,identity,portfolio,audit','set search_path=pg_catalog');
 s=s.replace('v_grant uuid;', 'v_grant uuid; proof platform.building_setup_command_receipts%rowtype; initial jsonb;');
 const gate=` select * into proof from platform.building_setup_command_receipts where run_id=new.id and expected_revision=new.revision-1
  and operation='provision' and actor_id=auth.uid();
 if not found or proof.tenant_id<>new.tenant_id or proof.workspace_id<>new.customer_workspace_id
  or (proof.receipt->>'property_id')::uuid is distinct from new.property_id or proof.actor_id<>new.created_by then
  raise exception 'setup_g2_provision_frame_required' using errcode='42501'; end if;
 initial:=jsonb_build_object('tenant_id',proof.tenant_id,'workspace_id',proof.workspace_id,'membership_id',proof.membership_id,
  'actor_id',proof.actor_id,'context_id',proof.context_id,'session_id',proof.writer_session_id);
`+checkpoint('proof.context_id','proof.workspace_id',"'provision'");
 s=s.replace(" if new.status<>'provisioned' or old.status='provisioned' then return new; end if;", " if new.status<>'provisioned' or old.status='provisioned' then return new; end if;\n"+gate);
 s=s.replace('   insert into platform.workspace_property_bindings',checkpoint('proof.context_id','proof.workspace_id',"'provision'")+'   insert into platform.workspace_property_bindings');
 s=s.replace('where m.tenant_id=new.tenant_id and m.user_id=new.created_by', 'where m.id=proof.membership_id and m.tenant_id=new.tenant_id and m.user_id=new.created_by');
 s=s.replace(' select id into v_grant',checkpoint('proof.context_id','proof.workspace_id',"'provision'")+' select id into v_grant');
 s=s.replace('   insert into identity.context_grants',checkpoint('proof.context_id','proof.workspace_id',"'provision'")+'   insert into identity.context_grants');
 s=s.replace(' insert into audit.events',checkpoint('proof.context_id','proof.workspace_id',"'provision'")+' insert into audit.events');
 s=s.replace(' return new;\n',checkpoint('proof.context_id','proof.workspace_id',"'provision'")+' return new;\n');
 return s;
}
export function reviewerReader(source){
 let s=extractFunction(source,'app_private.my_pilot_setup_reviewer_v1').text;
 s=s.replace('stable security definer','volatile security definer').replace("c record;",'c record; initial jsonb;');
 // Prepared state cannot expose a private submitted run. Existing semantics retained.
 s=s.replace('begin\n', 'begin\n perform app_private.require_request_session_current_at_v1(clock_timestamp());\n');
 s=s.replace(" if v_reviewer.status='active' then", " if v_reviewer.status='active' then\n initial:=app_private.require_building_setup_command_checkpoint_v1(v_reviewer.context_grant_id,v_workspace.id,'approve');");
 s=s.replace(" return jsonb_build_object('status',v_reviewer.status", " if v_reviewer.status='active' then\n"+checkpoint('v_reviewer.context_grant_id','v_workspace.id',"'approve'")+" end if;\n perform app_private.require_request_session_current_at_v1(clock_timestamp());\n return jsonb_build_object('status',v_reviewer.status");
 return s;
}

const INPUTS=[
 ['supabase/hosted-building-slice/migrations/20261023093148_cladora_building_hosted_slice_v1.sql','13afe489318f89600fe5f2040a1ab43b567e519e7ea2cceefa34c050e45434b6'],
 ['docs/architecture/cladora-building-hosted-slice-v1.manifest.json','a6af8450f1e94a6944e07db93a048dea963944744427e899d5963cb092b29ec7'],
 ['supabase/hosted-shared-auth/authorization-checkpoint-v1.sql','1ee522349f63bed7611cb5a2b5c7cb25707a44d5dd42673825870dfb1c982097'],
 ['supabase/migrations/20261021111641_building_setup_authority_v2.sql','de18c1436ada6763358dd1a99f4874cfc0d1920eab1e34ca13e9da6b9d172e60'],
 ['supabase/migrations/20261021123054_building_setup_attempt_version_v2.sql','ce386d018fe9d5f9045739e9752a44aec1c0d4f963653b4f7d455290b4153c86'],
 ['supabase/migrations/20260926184942_bind_provisioned_building_workspace.sql','41ad65ffb009c7a04847ef088e275291e85dade5fa1ab24d1b5830329b946f08'],
];
const FOUNDATION_NAMES=[
 'customer_mfa_required_at_v1','workspace_context_covers_role_scope_v1_at_v1','workspace_role_identity_source_current_v1_at_v1',
 'workspace_member_role_authority_active_v1_at_v1','native_workspace_scope_for_membership_v2_at_v1','resolve_workspace_native_context_v2_at_v1',
 'resolve_workspace_from_customer_context_v1_at_v1','check_direct_effective_permission_v2_at_v1','check_effective_permission_v2_at_v1',
 'check_workspace_native_permission_v2_at_v1','require_request_session_current_at_v1',
];
const REPLACED=new Set(['F17','F47','F79']);
const G2_NAMES=['platform.building_setup_command_receipt_epochs','platform.building_setup_command_coverage','platform.building_setup_command_receipts'];
export const GUARD_SQL=`-- PM169 source-only; no candidate can authorize its own compiled/role/custody proof.
begin;
set local search_path=pg_catalog,pg_temp;
do $g2_inactive$
declare compiled_expected jsonb:=null; role_reference jsonb:=null; custody_reference jsonb:=null; quiescence_reference jsonb:=null;
begin
 raise exception 'building_g2_inactive_source_only' using errcode='55000';
 if compiled_expected is null or role_reference is null or custody_reference is null or quiescence_reference is null then
  raise exception 'building_g2_independent_prestate_required' using errcode='55000'; end if;
end; $g2_inactive$;
`;
function closeNewObjects(sql){
 const functions=[...sql.matchAll(/^create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)\(([^]*?)\)\s*returns /gm)].map(m=>{
  const args=m[2].split(',').map(a=>a.trim().replace(/\s+default[^]*$/i,'').split(/\s+/).slice(1).join(' ').replaceAll('pg_catalog.','')).join(',');
  return `${m[1]}(${args})`;
 });
 // Generated only from the finite source-owned object inventory, not arbitrary SQL.
 const statements=[];
 for(const sig of functions)statements.push(`revoke all privileges on function ${sig} from public,anon,authenticated,service_role;\ndo $oc1$ declare g record; begin\n for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='${sig}'::regprocedure and a.grantee<>p.proowner loop\n execute 'revoke all privileges on function ${sig} from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';\n end loop; end; $oc1$;\n`);
 for(const table of G2_NAMES)statements.push(`revoke all privileges on table ${table} from public,anon,authenticated,service_role;\ndo $oc1$ declare g record; begin\n for g in select distinct a.grantee from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='${table}'::regclass and a.grantee<>c.relowner loop\n execute 'revoke all privileges on table ${table} from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';\n end loop;\n for g in select x.attname,a.grantee,a.privilege_type from pg_attribute x, lateral aclexplode(x.attacl) a where x.attrelid='${table}'::regclass and a.grantee<>(select relowner from pg_class where oid=x.attrelid) loop\n execute format('revoke %s (%I) on table ${table} from %s restrict',g.privilege_type,g.attname,case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end);\n end loop; end; $oc1$;\n`);
 return {sql:statements.join('\n'),functions};
}
function managementSQL(){return `-- Exact F64/F80 nested owner edges; PM137 E_rpc retained, never product authority.
do $role_entry$ declare r oid; p oid; e record; begin
 select oid into strict r from pg_roles where rolname='cladora_rpc_owner' and not(rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreaterole or rolcreatedb or rolreplication);
 select oid into strict p from pg_roles where rolname='postgres';
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1 then raise exception 'setup_g2_role_entry_graph' using errcode='55000'; end if;
 select * into strict e from pg_auth_members where roleid=r and member=p and admin_option and not inherit_option and not set_option;
 perform set_config('cladora.g2.role_entry',to_jsonb(e)::text,true);
 if e.grantor=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set true granted by postgres;
 else
  grant cladora_rpc_owner to postgres with admin false,inherit false,set true granted by postgres;
 end if;
end; $role_entry$;
grant usage,create on schema app_private to cladora_rpc_owner;
grant execute on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) to cladora_rpc_owner;
alter function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) owner to cladora_rpc_owner;
set local role cladora_rpc_owner;
revoke all on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;
do $owner_close$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and a.grantee<>p.proowner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $owner_close$;
grant execute on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) to postgres;
reset role;
revoke create on schema app_private from cladora_rpc_owner restrict;
do $role_exit$ declare e jsonb:=current_setting('cladora.g2.role_entry')::jsonb; r oid:='cladora_rpc_owner'::regrole::oid; p oid:='postgres'::regrole::oid; begin
 if (e->>'grantor')::oid=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set false granted by postgres;
 else revoke cladora_rpc_owner from postgres granted by postgres restrict; end if;
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1
  or not exists(select 1 from pg_auth_members m where to_jsonb(m)=e) then raise exception 'setup_g2_role_exit_graph' using errcode='55000'; end if;
 if has_schema_privilege(r,'app_private','CREATE') then raise exception 'setup_g2_temporary_schema_right_remains' using errcode='55000'; end if;
end; $role_exit$;
`;}
export function buildSource({inputRoot=root}={}){
 const inputs=INPUTS.map(([path,expected])=>{const value=readFileSync(resolve(inputRoot,path));if(sha256(value)!==expected)throw Error('input hash mismatch '+path);return{path,value:value.toString('utf8'),...identity(value)};});
 const [building,meta,foundation,authority,process,binding]=inputs;
 const sourceMeta=JSON.parse(meta.value),objects=new Map(sourceMeta.objects.map(o=>[o.id,o]));
 const effects=sourceMeta.effects.map(e=>{const bytes=Buffer.from(building.value).subarray(e.byte_start,e.byte_start+e.byte_length);if(sha256(bytes)!==e.sha256)throw Error('input effect hash '+e.id);return{...e,text:bytes.toString('utf8')};});
 const roots=new Set(sourceMeta.objects.filter(o=>o.kind==='function'&&(/\.(?:create|get|get_.*attempt|command|update|rehearse|submit|approve|provision)_building_setup/.test(o.identity)||['N01','F15'].includes(o.id))).map(o=>o.id));
 for(const x of sourceMeta.structural_effects)if(x.id.startsWith('G'))roots.add(x.contract_row.split('|')[2]);
 const selectedFunctions=new Set(),todo=[...roots];
 while(todo.length){const id=todo.pop();if(selectedFunctions.has(id))continue;selectedFunctions.add(id);const obj=objects.get(id);if(!obj)throw Error('unknown function dependency '+id);todo.push(...String(obj.dependencies??'').match(/\b(?:F|N)\d+\b/g)??[]);
  const e=effects.find(e=>e.id===id);if(e)for(const m of e.text.matchAll(/\b(app_private|customer_api|finance|platform)\.([a-z_0-9]+)\s*\(/g)){
   const obj=sourceMeta.objects.find(o=>o.kind==='function'&&o.identity.startsWith(m[1]+'.'+m[2]+'('));if(obj&&obj.id!==id)todo.push(obj.id);
  }
 }
 for(const id of selectedFunctions)if(/fixture|claim_pilot|revoke_building|prepare_building/.test(objects.get(id).identity))throw Error('forbidden new domain root '+id);
 const sourceContract=sha256(JSON.stringify({inputs:inputs.map(({path,sha256})=>({path,sha256})),decision:OWNER_DECISION,
  templates:[STORE_SQL,CHECKPOINT_SQL,READER_SQL,createWriter.toString(),commandWriter.toString(),bindingTrigger.toString(),reviewerReader.toString(),timedAuthority.toString()],functions:[...selectedFunctions].sort(),foundation:FOUNDATION_NAMES,role:managementSQL()}));
 const generic=FOUNDATION_NAMES.map(name=>extractFunction(foundation.value,'app_private.'+name));
 let g2=STORE_SQL+generic.map(x=>x.text).join('\n')+timedAuthority(authority.value)+CHECKPOINT_SQL
  +createWriter(process.value)+commandWriter(process.value)+bindingTrigger(binding.value)+reviewerReader(process.value)
  +`\ncreate function customer_api.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null) returns jsonb language sql security invoker set search_path=pg_catalog as $reviewer$ select app_private.my_pilot_setup_reviewer_v1(p_workspace_id) $reviewer$;\n`+READER_SQL;
 g2=g2.replaceAll('__SOURCE_CONTRACT__',sourceContract);
 const closed=closeNewObjects(g2);g2+='\n-- G2.OC1: exact per-object ACLs closed in the same transaction.\n'+closed.sql;
 const chunks=[{id:'G2.GUARD',text:GUARD_SQL,origin:null,reason:'new inactive composition, independent NULL seals'}],omissions=[];
 let injected=false;
 for(const e of effects){
  const id=e.id,objectIds=id.match(/\b(?:F|N)\d+\b/g)??[];
  const omitted=(id.startsWith('TX.')||id==='ROLE2'||id==='CATALOG.CONSTRAINT_SET'||id==='CATALOG.FUNCTION_BYTES'||id==='CATALOG.STRUCTURAL_SET'||id==='CATALOG.CLOSURE'||id.startsWith('MG1.')||id.includes('.F64.AFTER_TRANSFER')||id==='CATALOG.EQUIVALENCE'
   ||(/^(?:F|N)\d+$/.test(id)&&(!selectedFunctions.has(id)||REPLACED.has(id)))
   ||(id.startsWith('OC1.')&&objectIds.some(k=>!selectedFunctions.has(k)||REPLACED.has(k))));
  if(id==='F01'&&!injected){chunks.push({id:'G2.DOMAIN',text:g2,origin:null,reason:'one canonical replacement for F17/F47/F79; new evidence/checkpoint/reader + selected foundation closure'});injected=true;}
  if(omitted){omissions.push({id,source_sha256:e.sha256,reason:REPLACED.has(id)?'explicit new G2 replacement; original source immutable':id==='ROLE2'?'fixture role not selected':id.startsWith('CATALOG.')?'old candidate-specific assertions superseded by new independent NULL reference gate':id.startsWith('MG1.')||id.includes('.F64.AFTER_TRANSFER')?'explicit PM137 grantor-sensitive F64/F80 transfer, original bodies unchanged':id.startsWith('TX.')?'single new inactive BEGIN/ROLLBACK frame':'not in Building/current-read/trigger/native closure; no fixture/claim/new public API'});continue;}
  chunks.push({id:'B.'+id,text:e.text+'\n',origin:{path:building.path,byte_start:e.byte_start,byte_length:e.byte_length,sha256:e.sha256},reason:'exact selected source effect'});
 }
 if(!injected)throw Error('missing injection point');
 chunks.push({id:'G2.ROLE',text:managementSQL(),origin:null,reason:'F64/F80 owner edge; no product permission from ADMIN'});
 const equivalence=effects.find(e=>e.id==='CATALOG.EQUIVALENCE').text;
 const terminal=equivalence.replace(" if expected is null then",` actual:=actual||jsonb_build_object(
 'schemas',(select jsonb_agg(jsonb_build_array(n.oid,n.nspname,n.nspowner,n.nspacl) order by n.oid) from pg_namespace n where n.oid=any(ns)),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c where c.relnamespace=any(ns)),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t where t.typnamespace=any(ns)),
 'routines',(select jsonb_agg((to_jsonb(p)-'prosrc'-'probin')||jsonb_build_object('body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'binary_sha256',encode(sha256(convert_to(coalesce(p.probin,''),'UTF8')),'hex')) order by p.oid) from pg_proc p where p.pronamespace=any(ns)),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d),
 'management_edges',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]') from pg_auth_members m));
 if expected is null then`);
 chunks.push({id:'G2.CATALOG',text:terminal,origin:{path:building.path,effect:'CATALOG.EQUIVALENCE',sha256:effects.find(e=>e.id==='CATALOG.EQUIVALENCE').sha256},reason:'structural projection retained; full metadata added; independent expected remains literal NULL'});
 chunks.push({id:'G2.ROLLBACK',text:'\nrollback;\n',origin:null,reason:'no installed-ledger/activation/commit'});
 let output='-- Building G2 inactive source; PM169/170. NOT an install/apply runner.\n';const mapped=[];
 for(const c of chunks){output+='\n-- COMPOSED EFFECT '+c.id+'\n';const start=Buffer.byteLength(output);output+=c.text+'\n';mapped.push({...c,text:undefined,output_byte_start:start,output_byte_length:Buffer.byteLength(c.text),output_sha256:sha256(c.text)});}
 // PM176/SR-01: remove only the framing blank line at EOF. The final effect
 // already includes its own newline; no SQL statement or mapped range changes.
 if(!output.endsWith('\n\n'))throw Error('unexpected composition EOF framing');
 output=output.slice(0,-1);
 // This is a source inventory, never compiled identity or an expected catalog.
 // Preserve exact accepted structural provenance, explicitly excluding omitted
 // definitions. Generated constraints/index/TOAST identities remain PG17 gates.
 const selectedIds=new Set(mapped.filter(x=>x.id.startsWith('B.')).map(x=>x.id.slice(2)));
 const functionNames=[...output.matchAll(/^create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)\(/gm)].map(x=>x[1]);
 const sourceFunctions=functionNames.map(name=>{const f=extractFunction(output,name),signature=closed.functions.find(x=>x.startsWith(name+'('))??sourceMeta.objects.find(x=>x.kind==='function'&&x.identity.startsWith(name+'('))?.identity;
  if(!signature)throw Error('unmapped function signature '+name);
  const header=f.text.slice(0,f.text.search(/\bas\s+\$/i));
  return {name,signature,owner:sourceMeta.objects.find(x=>x.identity===signature)?.owner??'postgres',security:/security definer/i.test(header)?'definer':'invoker',search_path:/set search_path\s*=\s*([^\n]+)/i.exec(header)?.[1]??null,...f,text:undefined,
   owner_note:'source profile only; F64 exact owner/ACL checked independently after transfer',
   qualified_source_references:[...new Set([...f.text.matchAll(/\b(?:app_private|customer_api|identity|platform|portfolio|finance|audit|auth)\.[a-z_0-9]+/g)].map(x=>x[0]))].sort()};});
 const manifest={format:'cladora.building.g2.inactive.source.v1',base:BASE,parent:'51fdf2e30916e1ff48c5567230dae9b7b6f05029',owner:'CLADORA Core / CLADORA-CORE-WORKER-01',reviewer:'CLADORA SERVICE / PM',target:'cladora-staging/ryygcqiunqqtfkpkflzf',status:'SOURCE_LOCAL_DELIVERED',review_status:'INDEPENDENT_SOURCE_REVIEW_REQUIRED',packaging_authority:'https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403801070',correction_authority:'https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403870018',installed:false,activated:false,
  authority:'https://github.com/ontripai/cladora-website/issues/463#issuecomment-6402345164',guarantee:{decision:OWNER_DECISION,contract:'APPROVED_SCOPED_BUILDING_FINAL_TRANSACTION_GUARANTEE',superseded:'before every resumed native effect; only new G2 Building closure',tentative_effects_wal_sequence_gaps:true,observed_invalidity:'whole application transaction rollback',last_checkpoint_to_commit_logout_window:true,unknown_commit:'original key/exact own lookup; neither success nor rollback'},
  inputs:inputs.map(({value,...i})=>i),source_contract_sha256:sourceContract,
  composition:{kind:'fresh selected-effect composition; not serial Building+CE bootstrap concat',prestate:'fresh empty declared app schemas; exact PG17/managed/extension/role/custody/reference inputs not observed',foundation_selection:FOUNDATION_NAMES,external_ce_air_checkpoints:false,canonical_functions:[...selectedFunctions].sort(),replaced:[...REPLACED],selected_effects:mapped,omissions,collision:'STOP; no last-definition-wins',original_inputs_immutable:true},
  objects:{new_tables:G2_NAMES,new_or_replaced_functions:closed.functions,positive_runtime_grants:[],default_acl_mutations:[],role_management:'PM137 E_rpc ADMIN retained, SET/INHERIT false; F64 owner r/F80 owner P; temp CREATE/SET cleaned'},
  source_inventory:{classification:'lexical source inventory, not compiled facts; no AST/controller/oracle',functions:sourceFunctions,
   inherited_objects:sourceMeta.objects.filter(x=>selectedIds.has(x.id)&&!REPLACED.has(x.id)),
   inherited_subobjects:sourceMeta.subobjects.filter(x=>selectedIds.has(x.parent)&&!REPLACED.has(x.parent)),
   inherited_structural_effects:sourceMeta.structural_effects.filter(x=>selectedIds.has(x.id)),
   new_structure:{effect:'G2.DOMAIN',tables:G2_NAMES,columns_constraints_indexes:'exact CREATE TABLE source within G2.DOMAIN; native PG17 generated identities remain uncompiled',rls:'enabled; no positive policies',acl:'owner only; canonical OC1 revokes including column grants; approved nested F64/F80 edges only',new_managed_auth_fk:false,sequence:'new stores use no sequence or identity; selected existing UUID defaults retained'},
   generated_edges:'PK/UNIQUE/CHECK/FK indices/triggers, composite/array/TOAST types, dependencies and policy expressions captured by terminal structural query; no identity inferred from counts',
   all_call_boundary:'qualified source references plus inherited trigger/policy contracts; dynamic native/plpgsql/builtin/catalog resolution and generated attachments require independent PG17 reference; source inventory is not proof of runtime equivalence'},
  proofs:{compiled_expected:null,role_reference:null,custody_reference:null,quiescence_reference:null,candidate_is_oracle:false,sql_execution:'NOT_RUN_NOT_PASS'},
  naming:{filename:MIGRATION.split('/').at(-1),status:'OFFICIAL_CLI_RECEIPT_VERIFIED',receipt:NAMING_RECEIPT,tool_install:false,guessed_timestamp:false,forward_sql_sha256:sha256(output),forward_prestate:'same fresh selected-effect composition as module; never a dependency-free G2 fragment'},
  migration:{path:MIGRATION,...identity(output),equivalent_to:MODULE,purpose:'inactive fresh selected-effect composition; not an upgrade recipe or executed ledger'},
  closure:{writer_tables:['platform.building_setup_runs','portfolio.properties','portfolio.buildings','portfolio.units','finance.accounting_periods','platform.workspace_property_bindings','identity.context_grants','app_private.canonical_authority_revision_v1','audit.events',...G2_NAMES],deferred:'selected T35 assignment-source FK avoided: not written; new FKs immediate; unknown reachable deferred/trigger STOP',evidence_before_run_status_update:true,trigger_rechecks:'F47 after binding/context/audit and before next controllable effect; exact private command proof frame, no caller GUC',managed_auth:'provider-validated reads only; no managed lock/write/ACL change',outbox:'no new provider dispatch/event; atomic existing closure only'},
  runtime_gates:['independent PG17 compile/catalog/normalization reference and custody/writer exclusion','actual Auth/session/REFERENCES/extension/owner and grantor profile','retention duration/legal basis/manual expiry activation HOLD','issued Auth/AAL2/HTTP/browser evidence separately authorized','no positive grants/exposure/install/activation under this source delivery'],output:{path:MODULE,...identity(output)}};
 return{sql:output,manifest,forward:output,inputSources:inputs};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--emit')throw Error('usage: node scripts/build-building-setup-command-receipts-source-v1.mjs --emit (text only)');
 const b=buildSource(),target=resolve(root,MIGRATION);
 // Consume the copied official empty skeleton, or the identical source from a
 // previous emit. Never silently replace different WIP or invoke a CLI/DB.
 if(!existsSync(target))throw Error('official named migration skeleton must be materialized first');
 const previous=readFileSync(target,'utf8');
 const knownEofOnly=identity(previous).sha256==='c963898c9782681bfc56b15eb15313f9d65b0a5cceb0cd049ec1fd2a233cf32c'&&previous===b.forward+'\n';
 if(previous!==''&&previous!==b.forward&&!knownEofOnly)throw Error('migration target contains different WIP');
 if(!existsSync(resolve(root,MODULE))||readFileSync(resolve(root,MODULE),'utf8')!==b.sql)writeFileSync(resolve(root,MODULE),b.sql);
 if(previous!==b.forward)writeFileSync(target,b.forward);
 writeFileSync(resolve(root,MANIFEST),JSON.stringify(b.manifest,null,2)+'\n');
 console.log(JSON.stringify({status:b.manifest.status,output:b.manifest.output,naming:b.manifest.naming}));
}
