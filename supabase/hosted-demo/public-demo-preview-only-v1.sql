begin;

-- Owner's final demo scope: see menus, sample data and initial forms, but
-- never save an item or continue an operational workflow. Signup and atomic
-- initial sample-workspace provisioning remain the only customer writes.
-- Keep the original installation files as historical evidence; apply this last.

create or replace function demo.navigation_v1() returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_array(
  jsonb_build_object('key','dashboard','access','read_only'),
  jsonb_build_object('key','properties','access','read_only'),
  jsonb_build_object('key','residents','access','read_only'),
  jsonb_build_object('key','maintenance','access','read_only'),
  jsonb_build_object('key','assets','access','read_only'),
  jsonb_build_object('key','utilities','access','read_only'),
  jsonb_build_object('key','communications','access','read_only'),
  jsonb_build_object('key','documents','access','read_only'),
  jsonb_build_object('key','bookings','access','read_only'),
  jsonb_build_object('key','services','access','read_only'),
  jsonb_build_object('key','governance','access','read_only'),
  jsonb_build_object('key','finance','access','read_only'),
  jsonb_build_object('key','reports','access','read_only'),
  jsonb_build_object('key','activity','access','read_only'),
  jsonb_build_object('key','payments','access','locked'),
  jsonb_build_object('key','role_administration','access','locked')
 );
$$;

create or replace function demo.workspace_json_v1(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);result jsonb;
begin
 select jsonb_build_object('id',w.id,'name',w.name,'locale',w.locale,'is_demo',true,'role','demo_owner',
  'demo_mode','preview_only',
  'seed_version',w.seed_version,'created_at',w.created_at,'navigation',demo.navigation_v1(),
  'features',jsonb_build_object('form_preview',true,'demo_data_write',false,'workflow_continue',false,
   'financial_write',false,'full_iban',false,'native_operations',false,
   'platform_administration',false,'role_assignment',false,'ballot_write',false,'external_notifications',false,
   'real_file_upload',false,'bulk_delete',false,'export',false),
  'profile',jsonb_build_object('first_name',l.first_name,'last_name',l.last_name,'email',l.email,
   'mobile_contact',l.mobile_contact,'mobile_verified',false,'marketing_consent',l.marketing_consent))
 into result from demo.workspaces w left join demo.leads l on l.workspace_id=w.id and l.owner_user_id=u
 where w.id=p_workspace_id and w.owner_user_id=u;
 return result;
end;
$$;

-- Preserve the signatures for an explicit terminal denial, with no write path
-- remaining even if an old caller or a future mistaken grant reaches a body.
create or replace function customer_api.demo_create_item_v1(
 p_workspace_id uuid,p_module text,p_kind text,p_title text,p_data jsonb,p_idempotency_key text,p_parent_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'demo_preview_read_only' using errcode='42501';
end;
$$;

create or replace function customer_api.demo_update_item_v1(
 p_workspace_id uuid,p_item_id uuid,p_expected_version integer,p_patch jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'demo_preview_read_only' using errcode='42501';
end;
$$;

revoke all on function
 customer_api.demo_create_item_v1(uuid,text,text,text,jsonb,text,uuid),
 customer_api.demo_update_item_v1(uuid,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;

-- Replacements retain their previous ACLs; explicitly retain helper privacy.
revoke all on function demo.navigation_v1(),demo.workspace_json_v1(uuid)
 from public,anon,authenticated,service_role;

comment on function customer_api.demo_create_item_v1(uuid,text,text,text,jsonb,text,uuid)
 is 'Preview-only customer demo: item creation disabled by owner scope; signup initialization is separate.';
comment on function customer_api.demo_update_item_v1(uuid,uuid,integer,jsonb)
 is 'Preview-only customer demo: all item edits and workflow transitions disabled by owner scope.';

notify pgrst,'reload schema';
commit;
