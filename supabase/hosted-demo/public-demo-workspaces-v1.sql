begin;

-- Public sales demo only. No native tenant, membership, entitlement, money,
-- Operations dispatch, Storage object, invitation or platform role is created.
create schema demo;
revoke all on schema demo from public,anon,authenticated,service_role;

create table demo.workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(length(name) between 2 and 120),
 locale text not null default 'fa' check(locale in ('fa','en','ro')),
 seed_version integer not null default 1 check(seed_version=1),
 created_at timestamptz not null default statement_timestamp(),
 unique(id,owner_user_id)
);
create table demo.leads (
 owner_user_id uuid primary key references auth.users(id) on delete cascade,
 workspace_id uuid not null unique,
 email text not null,
 first_name text not null check(length(first_name) between 1 and 80),
 last_name text not null check(length(last_name) between 1 and 80),
 mobile_contact text not null check(mobile_contact ~ '^\+?[0-9]{8,15}$'),
 marketing_consent boolean not null default false,
 marketing_consent_at timestamptz,
 privacy_version text not null default 'demo-signup.v1' check(privacy_version='demo-signup.v1'),
 privacy_accepted_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 foreign key(workspace_id,owner_user_id) references demo.workspaces(id,owner_user_id) on delete cascade,
 check(marketing_consent=(marketing_consent_at is not null))
);
create table demo.items (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 owner_user_id uuid not null,
 parent_id uuid,
 module text not null check(module in ('properties','residents','maintenance','assets','utilities','communications','documents','bookings','services','governance')),
 kind text not null,
 title text not null check(length(title) between 1 and 180),
 status text not null,
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=12288),
 version integer not null default 1 check(version>0),
 seed_key text,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 unique(id,workspace_id,owner_user_id),
 unique(workspace_id,seed_key),
 foreign key(workspace_id,owner_user_id) references demo.workspaces(id,owner_user_id) on delete cascade,
 foreign key(parent_id,workspace_id,owner_user_id) references demo.items(id,workspace_id,owner_user_id) on delete cascade
);
create index demo_items_workspace_module_updated on demo.items(workspace_id,module,updated_at desc,id);
create index demo_items_workspace_kind_status on demo.items(workspace_id,kind,status);
create table demo.finance_samples (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 owner_user_id uuid not null,
 period date not null,
 unit_label text not null,
 category text not null,
 amount_due numeric(12,2) not null check(amount_due>=0),
 amount_paid numeric(12,2) not null check(amount_paid>=0 and amount_paid<=amount_due),
 currency text not null default 'RON' check(currency='RON'),
 unique(workspace_id,period,unit_label),
 foreign key(workspace_id,owner_user_id) references demo.workspaces(id,owner_user_id) on delete cascade
);
create index demo_finance_workspace_period on demo.finance_samples(workspace_id,period);
create table demo.activity (
 id bigint generated always as identity primary key,
 workspace_id uuid not null,
 owner_user_id uuid not null,
 item_id uuid,
 action text not null,
 created_at timestamptz not null default statement_timestamp(),
 foreign key(workspace_id,owner_user_id) references demo.workspaces(id,owner_user_id) on delete cascade
);
create index demo_activity_workspace_recent on demo.activity(workspace_id,created_at desc,id desc);
create table demo.create_receipts (
 workspace_id uuid not null,
 owner_user_id uuid not null,
 idempotency_key text not null,
 request_hash text not null,
 response jsonb not null,
 primary key(workspace_id,idempotency_key),
 foreign key(workspace_id,owner_user_id) references demo.workspaces(id,owner_user_id) on delete cascade
);

-- Independent database isolation; no client table/schema privileges are granted.
do $rls$
declare t text;
begin
 foreach t in array array['workspaces','leads','items','finance_samples','activity','create_receipts'] loop
  execute format('alter table demo.%I enable row level security',t);
  execute format('alter table demo.%I force row level security',t);
  if t='finance_samples' then
   execute 'create policy own_demo_finance_read on demo.finance_samples for select to public using(owner_user_id=(select auth.uid()))';
   execute 'create policy private_demo_finance_seed on demo.finance_samples for insert to postgres with check(owner_user_id=(select auth.uid()))';
  else
   execute format('create policy own_demo_data on demo.%I for all to public using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()))',t);
  end if;
 end loop;
end;
$rls$;
revoke all on table demo.workspaces,demo.leads,demo.items,demo.finance_samples,demo.activity,demo.create_receipts
 from public,anon,authenticated,service_role;

create function demo.require_user_v1() returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users a where a.id=u and a.email_confirmed_at is not null
  and a.deleted_at is null and (a.banned_until is null or a.banned_until<=statement_timestamp())) then
  raise exception 'demo_verified_login_required' using errcode='42501';
 end if;
 return u;
end;
$$;
create function demo.require_workspace_v1(p_workspace_id uuid) returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_user_v1();
begin
 if p_workspace_id is null or not exists(select 1 from demo.workspaces w where w.id=p_workspace_id and w.owner_user_id=u) then
  raise exception 'demo_workspace_access_denied' using errcode='42501';
 end if;
 return u;
end;
$$;
create function demo.navigation_v1() returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_array(
  jsonb_build_object('key','dashboard','access','read'),
  jsonb_build_object('key','properties','access','interactive'),
  jsonb_build_object('key','residents','access','interactive'),
  jsonb_build_object('key','maintenance','access','interactive'),
  jsonb_build_object('key','assets','access','interactive'),
  jsonb_build_object('key','utilities','access','interactive'),
  jsonb_build_object('key','communications','access','interactive'),
  jsonb_build_object('key','documents','access','metadata_only'),
  jsonb_build_object('key','bookings','access','interactive'),
  jsonb_build_object('key','services','access','interactive'),
  jsonb_build_object('key','governance','access','read_only'),
  jsonb_build_object('key','finance','access','read_only'),
  jsonb_build_object('key','reports','access','read'),
  jsonb_build_object('key','activity','access','read'),
  jsonb_build_object('key','payments','access','locked'),
  jsonb_build_object('key','role_administration','access','locked')
 );
$$;
create function demo.workspace_json_v1(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);result jsonb;
begin
 select jsonb_build_object('id',w.id,'name',w.name,'locale',w.locale,'is_demo',true,'role','demo_owner',
  'seed_version',w.seed_version,'created_at',w.created_at,'navigation',demo.navigation_v1(),
  'features',jsonb_build_object('financial_write',false,'full_iban',false,'native_operations',false,
   'platform_administration',false,'role_assignment',false,'ballot_write',false,'external_notifications',false,
   'real_file_upload',false,'bulk_delete',false,'export',false),
  'profile',jsonb_build_object('first_name',l.first_name,'last_name',l.last_name,'email',l.email,
   'mobile_contact',l.mobile_contact,'mobile_verified',false,'marketing_consent',l.marketing_consent))
 into result from demo.workspaces w left join demo.leads l on l.workspace_id=w.id and l.owner_user_id=u
 where w.id=p_workspace_id and w.owner_user_id=u;
 return result;
end;
$$;
create function demo.seed_item_v1(p_workspace_id uuid,p_parent_id uuid,p_module text,p_kind text,p_title text,p_status text,p_data jsonb,p_key text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare item_id uuid;
begin
 insert into demo.items(workspace_id,owner_user_id,parent_id,module,kind,title,status,data,seed_key)
 values(p_workspace_id,auth.uid(),p_parent_id,p_module,p_kind,p_title,p_status,p_data,p_key) returning id into item_id;
 return item_id;
end;
$$;
create function demo.seed_workspace_v1(p_workspace_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);property_id uuid;building_a uuid;building_b uuid;unit_id uuid;i integer;m integer;due numeric;
begin
 property_id:=demo.seed_item_v1(p_workspace_id,null,'properties','property','Sample condominium','active',
  '{"address":"Demo address","title_i18n":{"fa":"مجتمع نمونه","en":"Sample condominium","ro":"Condominiu demonstrativ"}}','property-1');
 building_a:=demo.seed_item_v1(p_workspace_id,property_id,'properties','building','Building A','active','{"floors":3}','building-a');
 building_b:=demo.seed_item_v1(p_workspace_id,property_id,'properties','building','Building B','active','{"floors":3}','building-b');
 for i in 1..12 loop
  unit_id:=demo.seed_item_v1(p_workspace_id,case when i<=6 then building_a else building_b end,'properties','unit','Unit '||i,'active',
   jsonb_build_object('unit_label','U'||lpad(i::text,2,'0'),'area_m2',50+i*3,'floor',(i-1)%3),'unit-'||i);
  perform demo.seed_item_v1(p_workspace_id,unit_id,'residents','resident','Sample resident '||i,'active',
   jsonb_build_object('unit_label','U'||lpad(i::text,2,'0'),'occupants',1+i%3),'resident-'||i);
  perform demo.seed_item_v1(p_workspace_id,unit_id,'utilities','meter_reading','Water reading '||i,'recorded',
   jsonb_build_object('unit_label','U'||lpad(i::text,2,'0'),'reading_value',100+i*7,'category','water'),'meter-'||i);
 end loop;
 for i in 1..6 loop
  perform demo.seed_item_v1(p_workspace_id,property_id,'maintenance','ticket','Sample maintenance request '||i,
   case when i<=2 then 'open' when i<=4 then 'in_progress' else 'closed' end,
   jsonb_build_object('priority',case when i=1 then 'high' else 'normal' end,'description','Sample workspace request'),'ticket-'||i);
 end loop;
 for i in 1..4 loop
  perform demo.seed_item_v1(p_workspace_id,property_id,'maintenance','work_order','Sample work order '||i,
   case when i=4 then 'closed' else 'open' end,jsonb_build_object('assignee','Demo technician '||i),'order-'||i);
  perform demo.seed_item_v1(p_workspace_id,property_id,'bookings','booking','Shared space booking '||i,'scheduled',
   jsonb_build_object('resource',case when i%2=0 then 'Meeting room' else 'Guest parking' end,'scheduled_on',current_date+i),'booking-'||i);
  perform demo.seed_item_v1(p_workspace_id,property_id,'services','service_request','Sample service request '||i,
   case when i=4 then 'closed' else 'open' end,jsonb_build_object('category','sample_service'),'service-'||i);
 end loop;
 for i in 1..8 loop
  perform demo.seed_item_v1(p_workspace_id,case when i<=4 then building_a else building_b end,'assets','asset','Sample equipment '||i,
   case when i=1 then 'maintenance' else 'active' end,jsonb_build_object('category',case when i%2=0 then 'pump' else 'lighting' end),'asset-'||i);
 end loop;
 for i in 1..3 loop
  perform demo.seed_item_v1(p_workspace_id,property_id,'communications','announcement','Sample notice '||i,'published',
   jsonb_build_object('description','Sample notice for this demo workspace only'),'notice-'||i);
 end loop;
 for i in 1..5 loop
  perform demo.seed_item_v1(p_workspace_id,property_id,'documents','document','Sample document '||i,'available',
   jsonb_build_object('category','sample_metadata','description','Metadata example; no real file uploaded'),'document-'||i);
 end loop;
 for i in 1..2 loop
  perform demo.seed_item_v1(p_workspace_id,property_id,'governance','meeting','Sample meeting '||i,'closed',
   jsonb_build_object('description','Read-only sample; voting actions unavailable'),'meeting-'||i);
 end loop;
 for m in 0..5 loop
  for i in 1..4 loop
   due:=180+i*25+m*10;
   insert into demo.finance_samples(workspace_id,owner_user_id,period,unit_label,category,amount_due,amount_paid)
   values(p_workspace_id,u,(date_trunc('month',current_date)-make_interval(months=>m))::date,
    'U'||lpad(i::text,2,'0'),case when i%2=0 then 'utilities' else 'maintenance' end,due,
    case when i=3 then due/2 else due end);
  end loop;
 end loop;
 insert into demo.activity(workspace_id,owner_user_id,action) values(p_workspace_id,u,'demo.workspace.seeded');
end;
$$;
create function demo.validate_data_v1(p_data jsonb) returns void
language plpgsql immutable set search_path=pg_catalog as $$
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>8192
 or exists(select 1 from jsonb_object_keys(p_data) k where k not in
  ('description','priority','assignee','scheduled_on','unit_label','building_label','category','reading_value',
   'resource','start_at','end_at','condition','address','area_m2','floors','floor','occupants')) then
  raise exception 'demo_item_data_invalid' using errcode='22023';
 end if;
 if p_data?'reading_value' and (jsonb_typeof(p_data->'reading_value')<>'number'
  or (p_data->>'reading_value')::numeric<0 or (p_data->>'reading_value')::numeric>1000000000) then
  raise exception 'demo_reading_invalid' using errcode='22023';
 end if;
 if p_data?'priority' and p_data->>'priority' not in ('low','normal','high') then
  raise exception 'demo_priority_invalid' using errcode='22023';
 end if;
end;
$$;
create function demo.valid_status_v1(p_kind text,p_status text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select case
 when p_kind in ('ticket','work_order','service_request','inspection') then p_status in ('open','in_progress','closed','cancelled')
 when p_kind='booking' then p_status in ('scheduled','done','cancelled')
 when p_kind='announcement' then p_status in ('draft','published')
 when p_kind='asset' then p_status in ('active','maintenance','retired')
 when p_kind='meter_reading' then p_status='recorded'
 when p_kind in ('property','building','unit','resident') then p_status in ('active','inactive')
 when p_kind='document' then p_status in ('available','archived') else false end;
$$;

create function customer_api.demo_get_my_workspace_v1() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_user_v1();w uuid;
begin
 select id into w from demo.workspaces where owner_user_id=u;
 if w is null then return null; end if;
 return demo.workspace_json_v1(w);
end;
$$;
create function customer_api.demo_initialize_workspace_v1(
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
  update demo.workspaces set name=btrim(p_workspace_name),locale=p_locale where id=w and owner_user_id=u;
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
create function customer_api.demo_list_items_v1(p_workspace_id uuid,p_module text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);rows jsonb;total bigint;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0
 or (p_module is not null and p_module not in ('properties','residents','maintenance','assets','utilities','communications','documents','bookings','services','governance')) then
  raise exception 'demo_list_invalid' using errcode='22023';
 end if;
 select count(*) into total from demo.items i where i.workspace_id=p_workspace_id and i.owner_user_id=u and (p_module is null or i.module=p_module);
 select coalesce(jsonb_agg(to_jsonb(q)-'owner_user_id' order by q.created_at,q.id),'[]'::jsonb) into rows from
  (select i.* from demo.items i where i.workspace_id=p_workspace_id and i.owner_user_id=u and (p_module is null or i.module=p_module)
   order by i.created_at,i.id limit p_limit offset p_offset) q;
 return jsonb_build_object('workspace_id',p_workspace_id,'is_demo',true,'items',rows,'total',total,'limit',p_limit,'offset',p_offset);
end;
$$;
create function customer_api.demo_create_item_v1(
 p_workspace_id uuid,p_module text,p_kind text,p_title text,p_data jsonb,p_idempotency_key text,p_parent_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);item demo.items%rowtype;request_hash text;receipt demo.create_receipts%rowtype;initial_status text;result jsonb;
begin
 if not coalesce((p_module='properties' and p_kind in ('property','building','unit'))
 or (p_module='residents' and p_kind='resident') or (p_module='maintenance' and p_kind in ('ticket','work_order','inspection'))
 or (p_module='assets' and p_kind='asset') or (p_module='utilities' and p_kind='meter_reading')
 or (p_module='communications' and p_kind='announcement') or (p_module='documents' and p_kind='document')
 or (p_module='bookings' and p_kind='booking') or (p_module='services' and p_kind='service_request'),false) then
  raise exception 'demo_action_unavailable' using errcode='42501';
 end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 180 or p_title ~ '[[:cntrl:]]'
 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'demo_item_invalid' using errcode='22023';
 end if;
 perform demo.validate_data_v1(p_data);
 if p_parent_id is not null and not exists(select 1 from demo.items i where i.id=p_parent_id and i.workspace_id=p_workspace_id and i.owner_user_id=u) then
  raise exception 'demo_parent_access_denied' using errcode='42501';
 end if;
 request_hash:=md5(jsonb_build_object('module',p_module,'kind',p_kind,'title',btrim(p_title),'data',p_data,'parent_id',p_parent_id)::text);
 perform pg_advisory_xact_lock(hashtextextended('cladora-demo-create/'||p_workspace_id::text||'/'||p_idempotency_key,0));
 select * into receipt from demo.create_receipts r where r.workspace_id=p_workspace_id and r.idempotency_key=p_idempotency_key;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'demo_idempotency_conflict' using errcode='22023'; end if;
  return receipt.response;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('cladora-demo-budget/'||p_workspace_id::text,0));
 if (select count(*) from demo.items i where i.workspace_id=p_workspace_id and i.owner_user_id=u)>=500 then
  raise exception 'demo_workspace_sample_limit_reached' using errcode='54000';
 end if;
 initial_status:=case when p_kind in ('ticket','work_order','inspection','service_request') then 'open'
  when p_kind='booking' then 'scheduled' when p_kind='announcement' then 'draft'
  when p_kind='meter_reading' then 'recorded' when p_kind='document' then 'available' else 'active' end;
 insert into demo.items(workspace_id,owner_user_id,parent_id,module,kind,title,status,data)
 values(p_workspace_id,u,p_parent_id,p_module,p_kind,btrim(p_title),initial_status,p_data) returning * into item;
 result:=to_jsonb(item)-'owner_user_id';
 insert into demo.create_receipts(workspace_id,owner_user_id,idempotency_key,request_hash,response) values(p_workspace_id,u,p_idempotency_key,request_hash,result);
 insert into demo.activity(workspace_id,owner_user_id,item_id,action) values(p_workspace_id,u,item.id,'demo.item.created');
 return result;
end;
$$;
create function customer_api.demo_update_item_v1(p_workspace_id uuid,p_item_id uuid,p_expected_version integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);item demo.items%rowtype;next_data jsonb;next_title text;next_status text;
begin
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>8192
 or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('title','status','data'))
 or p_expected_version is null or p_expected_version<1 then raise exception 'demo_patch_invalid' using errcode='22023'; end if;
 select * into item from demo.items i where i.id=p_item_id and i.workspace_id=p_workspace_id and i.owner_user_id=u for update;
 if not found then raise exception 'demo_item_access_denied' using errcode='42501'; end if;
 if item.module='governance' then raise exception 'demo_action_unavailable' using errcode='42501'; end if;
 if item.version<>p_expected_version then raise exception 'demo_item_version_conflict' using errcode='PT409'; end if;
 next_title:=case when p_patch?'title' then btrim(p_patch->>'title') else item.title end;
 next_status:=case when p_patch?'status' then p_patch->>'status' else item.status end;
 if next_title is null or length(next_title) not between 1 and 180 or next_title ~ '[[:cntrl:]]'
 or not coalesce(demo.valid_status_v1(item.kind,next_status),false) then raise exception 'demo_patch_value_invalid' using errcode='22023'; end if;
 if p_patch?'data' then perform demo.validate_data_v1(p_patch->'data'); end if;
 next_data:=item.data||coalesce(p_patch->'data','{}'::jsonb);
 if octet_length(next_data::text)>12288 then raise exception 'demo_item_data_too_large' using errcode='22023'; end if;
 update demo.items i set title=next_title,status=next_status,data=next_data,version=i.version+1,updated_at=statement_timestamp()
 where i.id=item.id returning * into item;
 insert into demo.activity(workspace_id,owner_user_id,item_id,action) values(p_workspace_id,u,item.id,'demo.item.updated');
 return to_jsonb(item)-'owner_user_id';
end;
$$;
create function customer_api.demo_get_reports_v1(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=demo.require_workspace_v1(p_workspace_id);counts jsonb;maintenance jsonb;monthly jsonb;financial jsonb;recent jsonb;
begin
 select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) into counts from
  (select i.kind,count(*) n from demo.items i where i.workspace_id=p_workspace_id and i.owner_user_id=u group by i.kind) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.kind,q.status),'[]'::jsonb) into maintenance from
  (select i.kind,i.status,count(*) as count from demo.items i where i.workspace_id=p_workspace_id and i.owner_user_id=u and i.module='maintenance' group by i.kind,i.status) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.period),'[]'::jsonb) into monthly from
  (select f.period,sum(f.amount_due) as invoiced,sum(f.amount_paid) as paid,sum(f.amount_due-f.amount_paid) as outstanding
   from demo.finance_samples f where f.workspace_id=p_workspace_id and f.owner_user_id=u group by f.period) q;
 select jsonb_build_object('currency','RON','read_only',true,'sample_data',true,'invoice_count',count(*),
  'invoiced',coalesce(sum(f.amount_due),0),'paid',coalesce(sum(f.amount_paid),0),'outstanding',coalesce(sum(f.amount_due-f.amount_paid),0),'monthly',monthly)
 into financial from demo.finance_samples f where f.workspace_id=p_workspace_id and f.owner_user_id=u;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into recent from
  (select a.id,a.item_id,a.action,a.created_at from demo.activity a where a.workspace_id=p_workspace_id and a.owner_user_id=u order by a.created_at desc,a.id desc limit 20) q;
 return jsonb_build_object('workspace_id',p_workspace_id,'is_demo',true,'generated_at',statement_timestamp(),
  'counts',counts,'maintenance',maintenance,'finance',financial,'activity',recent,
  'source','persisted_demo_records','native_business_data',false);
end;
$$;

revoke all on function
 demo.require_user_v1(),demo.require_workspace_v1(uuid),demo.navigation_v1(),demo.workspace_json_v1(uuid),
 demo.seed_item_v1(uuid,uuid,text,text,text,text,jsonb,text),demo.seed_workspace_v1(uuid),
 demo.validate_data_v1(jsonb),demo.valid_status_v1(text,text)
 from public,anon,authenticated,service_role;
revoke all on function
 customer_api.demo_get_my_workspace_v1(),
 customer_api.demo_initialize_workspace_v1(text,text,text,text,boolean,boolean,text),
 customer_api.demo_list_items_v1(uuid,text,integer,integer),
 customer_api.demo_create_item_v1(uuid,text,text,text,jsonb,text,uuid),
 customer_api.demo_update_item_v1(uuid,uuid,integer,jsonb),
 customer_api.demo_get_reports_v1(uuid)
 from public,anon,authenticated,service_role;
grant execute on function
 customer_api.demo_get_my_workspace_v1(),
 customer_api.demo_initialize_workspace_v1(text,text,text,text,boolean,boolean,text),
 customer_api.demo_list_items_v1(uuid,text,integer,integer),
 customer_api.demo_create_item_v1(uuid,text,text,text,jsonb,text,uuid),
 customer_api.demo_update_item_v1(uuid,uuid,integer,jsonb),
 customer_api.demo_get_reports_v1(uuid)
 to authenticated;
notify pgrst,'reload schema';
commit;
