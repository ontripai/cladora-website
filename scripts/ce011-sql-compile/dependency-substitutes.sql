-- Harness-only minimal shared shapes. NOT canonical Core/Auth/RLS implementations.
-- No rows, active grants, tokens or permissive authority fixtures are supplied.
create schema auth; create schema identity; create schema platform;
create schema portfolio; create schema community; create schema app_private;
create schema customer_api; create schema compile_fixture;
create table platform.tenants(id uuid primary key);
create table platform.customer_workspaces(id uuid primary key);
create table auth.users(id uuid primary key);
create table portfolio.parties(id uuid primary key);
create table identity.roles(id uuid primary key,code text,tenant_id uuid);
create table identity.memberships(id uuid primary key,tenant_id uuid,user_id uuid,role_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
create table identity.membership_parties(membership_id uuid,tenant_id uuid,party_id uuid);
create table platform.workspace_roles(id uuid primary key,tenant_id uuid,customer_workspace_id uuid,code text,lifecycle_status text,valid_from timestamptz,valid_to timestamptz);
create table platform.workspace_member_roles(id uuid primary key,tenant_id uuid,customer_workspace_id uuid,membership_id uuid,workspace_role_id uuid,valid_from timestamptz,valid_to timestamptz);
create table platform.idempotency_keys(tenant_id uuid,actor_id uuid,key text,request_hash text,expires_at timestamptz,response_ref jsonb,status_code integer,primary key(tenant_id,key));
create schema audit;
create table audit.events(id uuid default gen_random_uuid(),tenant_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,request_id uuid,before_snapshot jsonb,after_snapshot jsonb,reason text);
create table platform.outbox_events(id uuid default gen_random_uuid(),tenant_id uuid,aggregate_type text,aggregate_id uuid,aggregate_version integer,event_type text,payload jsonb,trace_id uuid);
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) returns boolean language sql stable as $$select false$$;
create function app_private.resolve_workspace_native_context_v2(uuid,uuid) returns table(tenant_id uuid,membership_id uuid,role_code text) language sql stable as $$select null::uuid,null::uuid,null::text where false$$;
create function app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz) returns boolean language sql volatile as $$select false$$;
create function app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz) returns table(tenant_id uuid,membership_id uuid,role_code text) language sql volatile as $$select null::uuid,null::uuid,null::text where false$$;
create function app_private.require_request_session_current_at_v1(timestamptz) returns void language plpgsql volatile as $$begin raise exception 'compile_fixture_deny_only' using errcode='42501';end$$;
