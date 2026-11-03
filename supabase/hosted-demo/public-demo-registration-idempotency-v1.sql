begin;
-- Registration provisions once; repeated calls cannot edit existing demo data.
create or replace function customer_api.demo_initialize_workspace_v1(
 p_first_name text,p_last_name text,p_mobile text,p_workspace_name text,
 p_marketing_consent boolean default false,p_privacy_accepted boolean default false,p_locale text default 'fa'
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_user_v1();w uuid;new_workspace boolean;mobile text;email text;
begin
 if p_privacy_accepted is distinct from true then raise exception 'demo_privacy_acceptance_required' using errcode='22023'; end if;
 if p_first_name is null or length(btrim(p_first_name)) not between 1 and 80 or p_first_name ~ '[[:cntrl:]]'
 or p_last_name is null or length(btrim(p_last_name)) not between 1 and 80 or p_last_name ~ '[[:cntrl:]]'
 or p_workspace_name is null or length(btrim(p_workspace_name)) not between 2 and 120 or p_workspace_name ~ '[[:cntrl:]]'
 or p_mobile is null or btrim(p_mobile) !~ '^\+?[0-9 ()-]+$'
 or p_locale is null or p_locale not in ('fa','en','ro') then raise exception 'demo_signup_fields_invalid' using errcode='22023'; end if;
 mobile:=case when left(btrim(p_mobile),1)='+' then '+' else '' end||regexp_replace(p_mobile,'[^0-9]','','g');
 if mobile !~ '^\+?[0-9]{8,15}$' then raise exception 'demo_contact_number_invalid' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cladora-demo-init/'||u::text,0));
 select id into w from demo.workspaces where owner_user_id=u;
 new_workspace:=w is null;
 if new_workspace then
  insert into demo.workspaces(owner_user_id,name,locale) values(u,btrim(p_workspace_name),p_locale) returning id into w;
 else
  -- Retrying registration only reads the existing workspace. It must not
  -- become an alternate edit API for workspace/profile/consent in this demo.
  return jsonb_build_object('created',false,'workspace',demo.workspace_json_v1(w));
 end if;
 select lower(a.email) into email from auth.users a where a.id=u;
 insert into demo.leads(owner_user_id,workspace_id,email,first_name,last_name,mobile_contact,marketing_consent,marketing_consent_at)
 values(u,w,email,btrim(p_first_name),btrim(p_last_name),mobile,coalesce(p_marketing_consent,false),
  case when p_marketing_consent then statement_timestamp() else null end)
 on conflict(owner_user_id) do update set
  email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,mobile_contact=excluded.mobile_contact,
  marketing_consent=excluded.marketing_consent,marketing_consent_at=excluded.marketing_consent_at,updated_at=statement_timestamp();
 if new_workspace then perform demo.seed_workspace_v1(w); end if;
 return jsonb_build_object('created',new_workspace,'workspace',demo.workspace_json_v1(w));
end;
$$;
notify pgrst,'reload schema';
commit;
