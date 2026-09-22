begin;

-- CLADORA R10 Phase 3B / Migration 110
-- A read-only, AAL2 and assignment-scoped operational projection for the
-- retention control plane. The dry-run RPC never claims work, writes rows,
-- calls Supabase Storage, or dispatches a KMS provider operation.

create or replace function app_private.can_read_retention_tenant_v1(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select app_private.has_platform_aal2() and (
    app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or exists (
      select 1
      from platform.customer_workspaces w
      where w.tenant_id = p_tenant_id
        and (
          (
            app_private.has_platform_role('PLATFORM_OPERATIONS')
            and app_private.has_customer_assignment(w.id, 'workspace')
          )
          or (
            app_private.has_platform_role('PLATFORM_AUDITOR')
            and (
              app_private.has_customer_assignment(w.id, 'audit')
              or app_private.has_customer_assignment(w.id, 'workspace')
            )
          )
        )
    )
  );
$$;

create or replace function platform.get_retention_operations_v1(
  p_section text default 'summary',
  p_tenant_id uuid default null,
  p_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_section text := coalesce(nullif(btrim(p_section), ''), 'summary');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_summary jsonb;
  v_flags jsonb;
begin
  if not app_private.has_platform_aal2() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;
  if not (
    app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')
    or app_private.has_platform_role('PLATFORM_AUDITOR')
  ) then
    raise exception using errcode = '42501', message = 'access_denied';
  end if;
  if v_section not in ('summary', 'retention', 'holds', 'disposal', 'storage', 'kms') then
    raise exception using errcode = '22023', message = 'invalid_retention_operations_section';
  end if;
  if p_status is not null and p_status !~ '^[a-z_]{1,40}$' then
    raise exception using errcode = '22023', message = 'invalid_retention_operations_status';
  end if;
  if p_tenant_id is not null and not app_private.can_read_retention_tenant_v1(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_scope_denied';
  end if;

  select coalesce(
    jsonb_object_agg(
      f.flag_name,
      jsonb_build_object(
        'enabled', f.enabled,
        'lock_version', f.lock_version,
        'updated_at', f.updated_at
      ) order by f.flag_name
    ),
    '{}'::jsonb
  )
  into v_flags
  from app_private.feature_flags f;

  select jsonb_build_object(
    'policy_versions', (
      select count(*) from app_private.retention_policy_versions v
      where (p_tenant_id is null or v.tenant_id = p_tenant_id)
        and app_private.can_read_retention_tenant_v1(v.tenant_id)
    ),
    'active_holds', (
      select count(*) from app_private.legal_holds h
      where h.status = 'active'
        and (p_tenant_id is null or h.tenant_id = p_tenant_id)
        and app_private.can_read_retention_tenant_v1(h.tenant_id)
    ),
    'open_protocols', (
      select count(*) from app_private.disposal_protocols d
      where d.status not in ('completed', 'cancelled')
        and (p_tenant_id is null or d.tenant_id = p_tenant_id)
        and app_private.can_read_retention_tenant_v1(d.tenant_id)
    ),
    'storage_attention', (
      select count(*) from app_private.disposal_purge_jobs j
      where j.status in ('outcome_unknown', 'manual_review', 'abandoned')
        and (p_tenant_id is null or j.tenant_id = p_tenant_id)
        and app_private.can_read_retention_tenant_v1(j.tenant_id)
    ),
    'kms_attention', (
      select count(*) from app_private.kms_key_requests k
      where k.status in ('failed', 'dispatch_pending')
        and (p_tenant_id is null or k.tenant_id = p_tenant_id)
        and app_private.can_read_retention_tenant_v1(k.tenant_id)
    )
  ) into v_summary;

  if v_section = 'retention' then
    select count(*) into v_total
    from app_private.retention_policy_versions v
    where (p_tenant_id is null or v.tenant_id = p_tenant_id)
      and (p_status is null or v.status = p_status)
      and app_private.can_read_retention_tenant_v1(v.tenant_id);

    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_items
    from (
      select
        v.id, v.tenant_id, v.policy_code, v.version_no, v.effective_range::text,
        v.status, v.source_register_version,
        (v.ceccar_approved_at is not null) as ceccar_approved,
        (v.legal_approved_at is not null) as legal_approved,
        v.created_at, v.lock_version,
        (select count(*) from app_private.retention_policy_rules r where r.policy_version_id = v.id) as rule_count,
        (select count(*) from app_private.document_retention_requirements dr
          join app_private.retention_policy_rules rr on rr.id = dr.policy_rule_id
          where rr.policy_version_id = v.id) as requirement_count
      from app_private.retention_policy_versions v
      where (p_tenant_id is null or v.tenant_id = p_tenant_id)
        and (p_status is null or v.status = p_status)
        and app_private.can_read_retention_tenant_v1(v.tenant_id)
      order by v.created_at desc, v.id
      limit v_limit offset v_offset
    ) q;
  elsif v_section = 'holds' then
    select count(*) into v_total
    from app_private.legal_holds h
    where (p_tenant_id is null or h.tenant_id = p_tenant_id)
      and (p_status is null or h.status = p_status)
      and app_private.can_read_retention_tenant_v1(h.tenant_id);

    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_items
    from (
      select
        h.id, h.tenant_id, h.hold_reference, h.matter_reference,
        left(h.reason, 500) as reason, h.status, h.created_at,
        h.activated_at, h.released_at, h.lock_version,
        (select count(*) from app_private.legal_hold_targets t where t.hold_id = h.id) as target_count
      from app_private.legal_holds h
      where (p_tenant_id is null or h.tenant_id = p_tenant_id)
        and (p_status is null or h.status = p_status)
        and app_private.can_read_retention_tenant_v1(h.tenant_id)
      order by h.created_at desc, h.id
      limit v_limit offset v_offset
    ) q;
  elsif v_section = 'disposal' then
    select count(*) into v_total
    from app_private.disposal_protocols d
    where (p_tenant_id is null or d.tenant_id = p_tenant_id)
      and (p_status is null or d.status = p_status)
      and app_private.can_read_retention_tenant_v1(d.tenant_id);

    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_items
    from (
      select
        d.id, d.tenant_id, d.protocol_number, d.status, d.created_at,
        d.submitted_at, d.approved_at, d.sealed_at, d.scheduled_at,
        d.manifest_sha256, d.hold_scope_epoch, d.lock_version,
        (select count(*) from app_private.disposal_protocol_documents x where x.protocol_id = d.id) as document_count,
        (select count(*) from app_private.disposal_committee_members x where x.protocol_id = d.id) as committee_count,
        (select count(*) from app_private.disposal_approval_votes x where x.protocol_id = d.id and x.decision = 'approved') as approval_count
      from app_private.disposal_protocols d
      where (p_tenant_id is null or d.tenant_id = p_tenant_id)
        and (p_status is null or d.status = p_status)
        and app_private.can_read_retention_tenant_v1(d.tenant_id)
      order by d.created_at desc, d.id
      limit v_limit offset v_offset
    ) q;
  elsif v_section = 'storage' then
    select count(*) into v_total
    from app_private.disposal_purge_jobs j
    where (p_tenant_id is null or j.tenant_id = p_tenant_id)
      and (p_status is null or j.status = p_status)
      and app_private.can_read_retention_tenant_v1(j.tenant_id);

    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_items
    from (
      select
        j.id, j.tenant_id, j.protocol_id, j.document_id, j.status,
        encode(extensions.digest(j.object_path, 'sha256'), 'hex') as object_path_fingerprint,
        j.retry_count, j.max_retries, j.next_attempt_at, j.lease_expires_at,
        j.created_at, j.updated_at, j.lock_version,
        (e.id is not null) as absence_evidence_recorded,
        o.status as outbox_status,
        o.attempt_number
      from app_private.disposal_purge_jobs j
      left join app_private.storage_deletion_evidence e on e.job_id = j.id
      left join lateral (
        select so.status, so.attempt_number
        from app_private.storage_delete_outbox so
        where so.job_id = j.id
        order by so.attempt_number desc
        limit 1
      ) o on true
      where (p_tenant_id is null or j.tenant_id = p_tenant_id)
        and (p_status is null or j.status = p_status)
        and app_private.can_read_retention_tenant_v1(j.tenant_id)
      order by j.created_at desc, j.id
      limit v_limit offset v_offset
    ) q;
  elsif v_section = 'kms' then
    select count(*) into v_total
    from app_private.kms_key_requests k
    where (p_tenant_id is null or k.tenant_id = p_tenant_id)
      and (p_status is null or k.status = p_status)
      and app_private.can_read_retention_tenant_v1(k.tenant_id);

    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_items
    from (
      select
        k.id, k.tenant_id, k.purpose, k.status,
        (k.provider_key_reference is not null) as provider_reference_recorded,
        k.expires_at, k.created_at, k.updated_at, k.lock_version,
        (select count(*) from app_private.kms_key_approvals a where a.request_id = k.id) as approval_count,
        o.status as dispatch_status, o.attempt_count
      from app_private.kms_key_requests k
      left join app_private.kms_dispatch_outbox o on o.request_id = k.id
      where (p_tenant_id is null or k.tenant_id = p_tenant_id)
        and (p_status is null or k.status = p_status)
        and app_private.can_read_retention_tenant_v1(k.tenant_id)
      order by k.created_at desc, k.id
      limit v_limit offset v_offset
    ) q;
  end if;

  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'mode', 'read_only',
    'section', v_section,
    'feature_flags', v_flags,
    'summary', v_summary,
    'items', v_items,
    'pagination', jsonb_build_object(
      'total', v_total,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + v_limit < v_total
    )
  );
end;
$$;

create or replace function platform.preview_retention_workers_v1(
  p_tenant_id uuid default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_storage_enabled boolean;
  v_kms_enabled boolean;
  v_storage jsonb;
  v_kms jsonb;
begin
  if not app_private.has_platform_aal2() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;
  if not (
    app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')
    or app_private.has_platform_role('PLATFORM_AUDITOR')
  ) then
    raise exception using errcode = '42501', message = 'access_denied';
  end if;
  if p_tenant_id is not null and not app_private.can_read_retention_tenant_v1(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_scope_denied';
  end if;

  select enabled into v_storage_enabled
  from app_private.feature_flags where flag_name = 'storage_purge_worker_enabled';
  select enabled into v_kms_enabled
  from app_private.feature_flags where flag_name = 'kms_lifecycle_enabled';

  select jsonb_build_object(
    'feature_enabled', coalesce(v_storage_enabled, false),
    'candidate_count', count(*),
    'would_claim_count', count(*) filter (
      where coalesce(v_storage_enabled, false)
        and (j.next_attempt_at is null or j.next_attempt_at <= statement_timestamp())
        and coalesce(e.epoch, 0) = j.hold_scope_epoch
    ),
    'candidates', coalesce(jsonb_agg(jsonb_build_object(
      'job_id', j.id,
      'tenant_id', j.tenant_id,
      'protocol_id', j.protocol_id,
      'document_id', j.document_id,
      'status', j.status,
      'retry_count', j.retry_count,
      'next_attempt_at', j.next_attempt_at,
      'object_path_fingerprint', encode(extensions.digest(j.object_path, 'sha256'), 'hex'),
      'would_claim', coalesce(v_storage_enabled, false)
        and (j.next_attempt_at is null or j.next_attempt_at <= statement_timestamp())
        and coalesce(e.epoch, 0) = j.hold_scope_epoch,
      'blocked_reasons', to_jsonb(array_remove(array[
        case when not coalesce(v_storage_enabled, false) then 'feature_flag_disabled' end,
        case when j.next_attempt_at is not null and j.next_attempt_at > statement_timestamp() then 'retry_not_due' end,
        case when coalesce(e.epoch, 0) <> j.hold_scope_epoch then 'hold_scope_epoch_changed' end
      ], null))
    ) order by j.created_at, j.id), '[]'::jsonb)
  ) into v_storage
  from (
    select x.*
    from app_private.disposal_purge_jobs x
    where x.status in ('purge_pending', 'retry_wait')
      and (p_tenant_id is null or x.tenant_id = p_tenant_id)
      and app_private.can_read_retention_tenant_v1(x.tenant_id)
    order by x.created_at, x.id
    limit v_limit
  ) j
  left join app_private.legal_hold_scope_epochs e on e.tenant_id = j.tenant_id;

  select jsonb_build_object(
    'feature_enabled', coalesce(v_kms_enabled, false),
    'candidate_count', count(*),
    'would_dispatch_count', count(*) filter (where coalesce(v_kms_enabled, false)),
    'candidates', coalesce(jsonb_agg(jsonb_build_object(
      'request_id', k.id,
      'tenant_id', k.tenant_id,
      'purpose', k.purpose,
      'status', k.status,
      'dispatch_status', o.status,
      'attempt_count', o.attempt_count,
      'would_dispatch', coalesce(v_kms_enabled, false),
      'blocked_reasons', case when coalesce(v_kms_enabled, false)
        then '[]'::jsonb else '["feature_flag_disabled"]'::jsonb end
    ) order by k.created_at, k.id), '[]'::jsonb)
  ) into v_kms
  from (
    select x.*
    from app_private.kms_key_requests x
    where x.status = 'dispatch_pending'
      and (p_tenant_id is null or x.tenant_id = p_tenant_id)
      and app_private.can_read_retention_tenant_v1(x.tenant_id)
    order by x.created_at, x.id
    limit v_limit
  ) k
  left join app_private.kms_dispatch_outbox o on o.request_id = k.id;

  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'mode', 'dry_run',
    'invariants', jsonb_build_object(
      'database_mutated', false,
      'storage_delete_api_called', false,
      'kms_provider_called', false,
      'claims_acquired', false
    ),
    'storage', v_storage,
    'kms', v_kms
  );
end;
$$;

-- Match the Phase 3A trust boundary: the read model is not owned by postgres.
-- Only the minimum cross-schema reads/helper executions required by these
-- side-effect-free functions are added to the restricted RPC owner.
grant select on table platform.customer_workspaces to cladora_rpc_owner;
drop policy if exists phase3b_rpc_owner_customer_workspaces on platform.customer_workspaces;
create policy phase3b_rpc_owner_customer_workspaces
  on platform.customer_workspaces for select to cladora_rpc_owner using (true);

grant execute on function app_private.has_platform_aal2() to cladora_rpc_owner;
grant execute on function app_private.has_platform_role(platform.platform_role_type) to cladora_rpc_owner;
grant execute on function app_private.has_customer_assignment(uuid,text) to cladora_rpc_owner;

grant create on schema app_private, platform to cladora_rpc_owner;
alter function app_private.can_read_retention_tenant_v1(uuid) owner to cladora_rpc_owner;
alter function platform.get_retention_operations_v1(text,uuid,text,integer,integer) owner to cladora_rpc_owner;
alter function platform.preview_retention_workers_v1(uuid,integer) owner to cladora_rpc_owner;
revoke create on schema app_private, platform from cladora_rpc_owner;

revoke all on function app_private.can_read_retention_tenant_v1(uuid) from public, anon, authenticated;
revoke all on function platform.get_retention_operations_v1(text,uuid,text,integer,integer) from public, anon;
revoke all on function platform.preview_retention_workers_v1(uuid,integer) from public, anon;

grant execute on function platform.get_retention_operations_v1(text,uuid,text,integer,integer) to authenticated, service_role;
grant execute on function platform.preview_retention_workers_v1(uuid,integer) to authenticated, service_role;

comment on function platform.get_retention_operations_v1(text,uuid,text,integer,integer)
is 'Read-only AAL2 and assignment-scoped Phase 3B retention operations projection. Storage paths and KMS provider references are not exposed.';

comment on function platform.preview_retention_workers_v1(uuid,integer)
is 'Side-effect-free worker preview. It does not claim jobs, write rows, call Storage deletion, or contact a KMS provider.';

commit;
