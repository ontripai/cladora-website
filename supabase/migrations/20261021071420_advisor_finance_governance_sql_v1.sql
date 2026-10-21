begin;

-- Forward-only correction of three proven SQL defects. Preserve signatures,
-- volatility, security mode, search_path, authorization and existing ACL/owners.
-- No new domain storage, permissions, voting rules or financial mutations.

create or replace function finance.get_customer_allocations(
  p_context_id uuid,p_view text default 'runs',p_query text default null,p_status text default null,
  p_method text default null,p_from date default null,p_to date default null,p_limit integer default 25,
  p_offset integer default 0,p_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,finance,billing,identity,platform,portfolio,occupancy
as $$
declare v record; v_workspace uuid; v_party uuid; v_resident boolean; v_tenant boolean;
  v_property uuid; v_total bigint; v_rows jsonb; v_summary jsonb; v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  if p_view not in ('runs','rules','lines') or p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_query' using errcode='22023'; end if;
  if p_method is not null and p_method not in ('meter_consumption','cpi','per_person','surface_m2','direct','fixed') then raise exception 'invalid_method' using errcode='22023'; end if;
  select g.*,m.id membership_key,m.role_id,r.code role_code,r.name role_name,t.legal_name tenant_name into v
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=m.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
  if lower(v.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then raise exception 'allocation_role_denied' using errcode='42501'; end if;
  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=v.role_id and rp.effect='allow' and p.code='finance.allocations.read') then raise exception 'allocation_permission_required' using errcode='42501'; end if;
  select w.id into v_workspace from platform.customer_workspaces w where w.tenant_id=v.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;
  if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=v_workspace
    and e.entitlement_key='module.accounting' and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
    and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else e.boolean_value is true end))
    then raise exception 'allocation_entitlement_required' using errcode='42501'; end if;
  v_property:=case when v.scope_type='property' then v.property_id when v.scope_type='building' then
    (select b.property_id from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id)
    when v.scope_type='unit' then (select b.property_id from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v.unit_id and u.tenant_id=v.tenant_id) else null end;
  v_resident:=lower(v.role_code) in ('owner','tenant_resident'); v_tenant:=lower(v.role_code)='tenant_resident';
  if v_resident then
    if v.scope_type<>'unit' then raise exception 'resident_unit_context_required' using errcode='42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id=v.membership_key and mp.tenant_id=v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode='42501'; end if;
    if not v_tenant and not exists(select 1 from portfolio.ownerships o where o.tenant_id=v.tenant_id and o.unit_id=v.unit_id and o.party_id=v_party
      and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then raise exception 'ownership_required' using errcode='42501'; end if;
    if v_tenant and not exists(select 1 from occupancy.leases l where l.tenant_id=v.tenant_id and l.unit_id=v.unit_id and l.tenant_party_id=v_party
      and l.status='active' and l.starts_on<=current_date and (l.ends_on is null or l.ends_on>current_date)) then raise exception 'active_lease_required' using errcode='42501'; end if;
  end if;

  if p_view='rules' then
    with visible as (select r.*,c.code category_code,c.name category_name from finance.allocation_rules r join finance.charge_categories c on c.id=r.charge_category_id
      where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a join finance.allocation_runs ar on ar.id=a.run_id
        where ar.tenant_id=v.tenant_id and ar.property_id=v_property and (a.rule_snapshot->>'rule_id')=r.id::text
        and a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or status::text=p_status) and (p_method is null or method::text=p_method)
      and (p_from is null or valid_from>=p_from) and (p_to is null or coalesce(valid_to,'infinity'::date)<=p_to)
      and (p_query is null or trim(p_query)='' or category_code ilike '%'||trim(p_query)||'%' or category_name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by valid_from desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'category_code',category_code,'category_name',category_name,'method',method,
      'parameters',parameters,'valid_from',valid_from,'valid_to',valid_to,'version',version,'status',status) order by valid_from desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  elsif p_view='runs' then
    with visible as (select r.*,j.journal_no,
      case when v_resident then coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)),0)
        else coalesce((select sum(i.amount) from finance.allocation_inputs i where i.run_id=r.id),0) end source_amount,
      coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id
        and (not v_resident or (a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),0) allocated_amount from finance.allocation_runs r
      left join finance.journals j on j.id=r.journal_id where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or status::text=p_status)
      and (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to)
      and (p_query is null or trim(p_query)='' or coalesce(journal_no::text,'') ilike '%'||trim(p_query)||'%' or id::text ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by period_start desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'period_start',period_start,'period_end',period_end,'currency',currency,'status',status,
      'source_amount',source_amount,'allocated_amount',allocated_amount,'difference',source_amount-allocated_amount,'input_hash',input_hash,'calculated_at',calculated_at,
      'approved_at',approved_at,'journal_id',journal_id,'journal_no',journal_no) order by period_start desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  else
    with visible as (select a.*,r.period_start,r.period_end,r.currency,r.status run_status,i.amount source_amount,i.source_type,i.source_id,
      c.code category_code,c.name category_name,inv.invoice_no,
      coalesce(a.explanation_json->>'legal_debtor','shared') legal_debtor,coalesce(a.explanation_json->>'operational_payer','owner') operational_payer
      from finance.allocation_items a join finance.allocation_runs r on r.id=a.run_id and r.tenant_id=a.tenant_id
      join finance.allocation_inputs i on i.id=a.input_id and i.run_id=a.run_id join finance.charge_categories c on c.id=i.category_id
      left join billing.invoices inv on i.source_type='invoice' and inv.id=i.source_id and inv.tenant_id=i.tenant_id
      where a.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or (a.unit_id=v.unit_id and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))),
    filtered as (select * from visible where (p_id is null or id=p_id) and (p_status is null or run_status::text=p_status) and (p_method is null or method::text=p_method)
      and (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to)
      and (p_query is null or trim(p_query)='' or category_code ilike '%'||trim(p_query)||'%' or category_name ilike '%'||trim(p_query)||'%' or coalesce(invoice_no::text,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by period_start desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'run_id',run_id,'period_start',period_start,'period_end',period_end,'run_status',run_status,
      'currency',currency,'category_code',category_code,'category_name',category_name,'source_type',source_type,'source_id',source_id,'source_document',invoice_no,
      'source_amount',source_amount,'method',method,'basis_value',basis_value,'basis_total',basis_total,'share_ratio',case when basis_total>0 then basis_value/basis_total else 0 end,
      'allocated_amount',allocated_amount,'legal_debtor',legal_debtor,'operational_payer',operational_payer,'rule_snapshot',rule_snapshot,'explanation',explanation_json)
      order by period_start desc,id desc),'[]'::jsonb) into v_total,v_rows from page;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'source_amount',source_amount,'allocated_amount',allocated_amount,'difference',source_amount-allocated_amount,'run_count',run_count) order by currency),'[]'::jsonb)
  into v_summary from (select r.currency,coalesce(sum(i.source_amount),0) source_amount,coalesce(sum(i.allocated_amount),0) allocated_amount,count(*) run_count from finance.allocation_runs r
    left join lateral(select case when v_resident then coalesce((select sum(a.allocated_amount) from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
      and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)),0)
      else coalesce(sum(x.amount),0) end source_amount from finance.allocation_inputs x where x.run_id=r.id) i0 on true
    left join lateral(select coalesce(sum(x.allocated_amount),0) allocated_amount from finance.allocation_items x where x.run_id=r.id
      and (not v_resident or (x.unit_id=v.unit_id and (case when v_tenant then x.responsible_party_id=v_party and lower(coalesce(x.explanation_json->>'legal_debtor',''))='tenant'
        else lower(coalesce(x.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end)))) a0 on true
    cross join lateral(select i0.source_amount,a0.allocated_amount) i
    where r.tenant_id=v.tenant_id and (v_property is null or r.property_id=v_property)
      and (not v_resident or exists(select 1 from finance.allocation_items a where a.run_id=r.id and a.unit_id=v.unit_id
        and (case when v_tenant then a.responsible_party_id=v_party and lower(coalesce(a.explanation_json->>'legal_debtor',''))='tenant'
          else lower(coalesce(a.explanation_json->>'legal_debtor','shared')) in ('owner','shared') end))) group by r.currency) s;
  if p_id is not null then v_detail:=case when v_total=1 then v_rows->0 else null end; end if;
  return jsonb_build_object('context',jsonb_build_object('id',v.id,'tenant_name',v.tenant_name,'role_code',v.role_code,'scope_type',v.scope_type),
    'view',p_view,'total',v_total,'rows',v_rows,'summary',v_summary,'detail',v_detail,'limit',p_limit,'offset',p_offset,'read_only',true,'generated_at',statement_timestamp());
end $$;

create or replace function governance.get_customer_governance(p_context_id uuid,p_view text default 'meetings',p_query text default null,p_status text default null,p_from date default null,p_to date default null,p_limit integer default 25,p_offset integer default 0,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,governance,identity,platform,portfolio,occupancy,documents,audit
as $$
declare x record;v_workspace uuid;v_party uuid;v_resident boolean;v_tenant boolean;v_total bigint;v_rows jsonb;v_summary jsonb;v_detail jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 if p_view not in ('meetings','agenda','invitations','attendance','quorum','proxies','votes','resolutions','minutes','documents','history') or p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_query' using errcode='22023';end if;
 select g.*,m.id membership_key,m.role_id,r.code role_code,r.name role_name into x from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id join identity.roles r on r.id=m.role_id where g.id=p_context_id and m.user_id=auth.uid() and m.status='active' and m.starts_at<=statement_timestamp() and(m.ends_at is null or m.ends_at>statement_timestamp()) and g.starts_at<=statement_timestamp() and(g.ends_at is null or g.ends_at>statement_timestamp());
 if not found then raise exception 'customer_context_access_denied' using errcode='42501';end if;
 if lower(x.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then raise exception 'governance_role_denied' using errcode='42501';end if;
 if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id where rp.role_id=x.role_id and rp.effect='allow' and p.code='governance.meetings.read') then raise exception 'governance_permission_required' using errcode='42501';end if;
 select w.id into v_workspace from platform.customer_workspaces w where w.tenant_id=x.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;
 if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=v_workspace and e.entitlement_key='module.governance' and e.valid_from<=statement_timestamp() and(e.valid_until is null or e.valid_until>statement_timestamp()) and(case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else e.boolean_value is true end)) then raise exception 'governance_entitlement_required' using errcode='42501';end if;
 v_resident:=lower(x.role_code) in('owner','tenant_resident');v_tenant:=lower(x.role_code)='tenant_resident';
 if v_resident then select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id=x.membership_key and mp.tenant_id=x.tenant_id;if v_party is null or x.scope_type<>'unit' then raise exception 'resident_party_and_unit_context_required' using errcode='42501';end if;
  if not v_tenant and not exists(select 1 from portfolio.ownerships o where o.tenant_id=x.tenant_id and o.unit_id=x.unit_id and o.party_id=v_party and o.valid_from<=current_date and(o.valid_to is null or o.valid_to>current_date)) then raise exception 'ownership_required' using errcode='42501';end if;
  if v_tenant and not exists(select 1 from occupancy.leases l where l.tenant_id=x.tenant_id and l.unit_id=x.unit_id and l.tenant_party_id=v_party and l.status='active' and l.starts_on<=current_date and(l.ends_on is null or l.ends_on>current_date)) then raise exception 'active_lease_required' using errcode='42501';end if;end if;
 with allowed as(select m.* from governance.meetings m where m.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or m.tenant_visible))
 select jsonb_build_object('meetings',count(*),'scheduled',count(*)filter(where status in('announced','open')),'closed',count(*)filter(where status='closed'),'open_votes',(select count(*) from governance.votes v join allowed a on a.id=v.meeting_id where v.status='open')) into v_summary from allowed;
 if p_view='meetings' then with q as(select m.id,m.title,m.meeting_type,m.scheduled_at,m.location_text,m.status,m.quorum_rule,m.announced_at,m.opened_at,m.closed_at,m.tenant_visible,p.name property_name,count(*)over() total_count from governance.meetings m join portfolio.properties p on p.id=m.property_id where m.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or m.tenant_visible) and(p_id is null or m.id=p_id) and(p_status is null or m.status::text=p_status) and(p_from is null or m.scheduled_at::date>=p_from) and(p_to is null or m.scheduled_at::date<=p_to) and(p_query is null or trim(p_query)='' or m.title ilike '%'||trim(p_query)||'%' or p.name ilike '%'||trim(p_query)||'%') order by m.scheduled_at desc,m.id limit p_limit offset p_offset) select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]') into v_total,v_rows from q;
 elsif p_view='agenda' then with q as(select a.id,a.meeting_id,m.title meeting_title,a.sequence_no,a.title,a.description,a.decision_required,a.created_at,m.status,count(*)over() total_count from governance.agenda_items a join governance.meetings m on m.id=a.meeting_id where a.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or m.tenant_visible) and(p_id is null or a.id=p_id) and(p_query is null or a.title ilike '%'||trim(p_query)||'%') order by m.scheduled_at desc,a.sequence_no limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='invitations' then with q as(select i.id,i.meeting_id,m.title meeting_title,i.unit_id,u.code as unit_code,i.invitation_status,i.invited_at,i.responded_at,(i.evidence_document_id is not null) evidence_available,count(*)over() total_count from governance.meeting_invitations i join governance.meetings m on m.id=i.meeting_id left join portfolio.units u on u.id=i.unit_id where i.tenant_id=x.tenant_id and not v_tenant and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_resident or(i.party_id=v_party and i.unit_id=x.unit_id)) and(p_status is null or i.invitation_status=p_status) order by i.invited_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='attendance' then with q as(select a.id,a.meeting_id,m.title meeting_title,e.unit_id,u.code as unit_code,a.attendance_mode,a.checked_in_at,(a.proxy_evidence_path is not null) proxy_evidence_available,count(*)over() total_count from governance.attendance a join governance.meetings m on m.id=a.meeting_id join governance.eligibility_snapshots e on e.id=a.eligibility_id join portfolio.units u on u.id=e.unit_id where a.tenant_id=x.tenant_id and not v_tenant and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_resident or(e.party_id=v_party and e.unit_id=x.unit_id)) order by a.checked_in_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='quorum' then with q as(select m.id,m.title,m.status,m.scheduled_at,coalesce(sum(e.voting_weight)filter(where e.eligible),0) eligible_weight,coalesce(sum(e.voting_weight)filter(where e.eligible and a.id is not null),0) represented_weight,case when coalesce(sum(e.voting_weight)filter(where e.eligible),0)>0 then round(100*sum(e.voting_weight)filter(where e.eligible and a.id is not null)/sum(e.voting_weight)filter(where e.eligible),4) else 0 end quorum_percent,m.quorum_rule->>'basis' quorum_basis,m.quorum_rule->>'threshold' quorum_threshold,m.quorum_rule->>'rule_version' rule_version,statement_timestamp() calculated_at,count(*)over() total_count from governance.meetings m left join governance.eligibility_snapshots e on e.meeting_id=m.id left join governance.attendance a on a.meeting_id=m.id and a.eligibility_id=e.id where m.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or m.tenant_visible) group by m.id order by m.scheduled_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='proxies' then with q as(select p.id,p.meeting_id,m.title meeting_title,e.unit_id,u.code as unit_code,p.valid_from,p.valid_until,p.status,(p.evidence_document_id is not null) evidence_available,case when p.valid_from<=statement_timestamp() and p.valid_until>statement_timestamp() and p.status='active' then true else false end currently_valid,count(*)over() total_count from governance.proxies p join governance.meetings m on m.id=p.meeting_id join governance.eligibility_snapshots e on e.id=p.eligibility_id join portfolio.units u on u.id=e.unit_id where p.tenant_id=x.tenant_id and not v_tenant and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_resident or(p.grantor_party_id=v_party and e.unit_id=x.unit_id)) order by p.valid_from desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='votes' then with option_weights as(select o.vote_id,jsonb_object_agg(o.code,coalesce((select sum(b.voting_weight)from governance.ballots b where b.vote_id=o.vote_id and b.option_id=o.id),0)) option_totals from governance.vote_options o group by o.vote_id),cast_weights as(select b.vote_id,sum(b.voting_weight)cast_weight from governance.ballots b group by b.vote_id),totals as(select v.id,v.meeting_id,v.agenda_item_id,v.question,v.status,v.voting_method,v.secret_ballot,v.rule_version,v.opens_at,v.closes_at,m.title meeting_title,m.property_id,coalesce(c.cast_weight,0)cast_weight,coalesce(o.option_totals,'{}'::jsonb)option_totals from governance.votes v join governance.meetings m on m.id=v.meeting_id left join option_weights o on o.vote_id=v.id left join cast_weights c on c.vote_id=v.id where v.tenant_id=x.tenant_id),q as(select t.id,t.meeting_id,t.meeting_title,t.question,t.status,t.voting_method,t.secret_ballot,t.rule_version,t.opens_at,t.closes_at,t.cast_weight,t.option_totals,case when t.status='closed' then 'final' else 'provisional' end result_state,count(*)over()total_count from totals t where governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,t.property_id) and(not v_tenant or exists(select 1 from governance.meetings m where m.id=t.meeting_id and m.tenant_visible) and t.status='closed') and(p_status is null or t.status::text=p_status) and(p_query is null or t.question ilike '%'||trim(p_query)||'%') order by t.opens_at desc nulls last limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='resolutions' then with q as(select r.id,r.meeting_id,m.title meeting_title,r.resolution_no,r.title,r.text_body,r.adopted,r.result_snapshot->>'quorum_basis' quorum_basis,r.result_snapshot->>'calculation_method' calculation_method,r.result_snapshot->>'rule_version' rule_version,r.result_snapshot->>'eligible_weight' eligible_weight,r.result_snapshot->>'cast_weight' cast_weight,r.result_snapshot->>'for_weight' for_weight,r.result_snapshot->>'against_weight' against_weight,r.result_snapshot->>'abstain_weight' abstain_weight,(r.result_snapshot?'evidence_document_id')evidence_available,r.effective_on,r.tenant_visible,r.created_at,count(*)over()total_count from governance.resolutions r join governance.meetings m on m.id=r.meeting_id where r.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or(r.tenant_visible and m.tenant_visible)) and(p_query is null or r.title ilike '%'||trim(p_query)||'%' or r.resolution_no ilike '%'||trim(p_query)||'%') order by r.created_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='minutes' then with q as(select n.id,n.meeting_id,m.title meeting_title,n.version,n.sha256,n.approved_at,n.created_at,n.tenant_visible,(n.object_path is not null) document_available,count(*)over()total_count from governance.minutes n join governance.meetings m on m.id=n.meeting_id where n.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or(n.tenant_visible and m.tenant_visible)) order by n.created_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 elsif p_view='documents' then with links as(select l.document_id,l.entity_type,l.entity_id,l.entity_id meeting_id from documents.document_links l where l.entity_type='governance.meeting' union all select l.document_id,l.entity_type,l.entity_id,r.meeting_id from documents.document_links l join governance.resolutions r on l.entity_type='governance.resolution'and r.id=l.entity_id union all select l.document_id,l.entity_type,l.entity_id,n.meeting_id from documents.document_links l join governance.minutes n on l.entity_type='governance.minutes'and n.id=l.entity_id),q as(select d.id,d.title,d.document_type,d.classification,d.current_version,d.status,d.created_at,l.entity_type,l.entity_id,count(*)over()total_count from links l join documents.documents d on d.id=l.document_id join governance.meetings m on m.id=l.meeting_id where d.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or(d.classification='public' and m.tenant_visible)) order by d.created_at desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;
 else with q as(select h.id,h.meeting_id,m.title meeting_title,h.event_type,h.status_from,h.status_to,h.reason,h.rule_version,(h.evidence_json<>'{}'::jsonb)evidence_available,h.occurred_at,count(*)over()total_count from governance.meeting_history h join governance.meetings m on m.id=h.meeting_id where h.tenant_id=x.tenant_id and governance.customer_governance_scope_matches(x.scope_type::text,x.property_id,x.building_id,x.unit_id,m.property_id) and(not v_tenant or m.tenant_visible) order by h.occurred_at desc,h.id desc limit p_limit offset p_offset)select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(q)-'total_count'),'[]')into v_total,v_rows from q;end if;
 v_detail:=case when p_id is null then null else(select r from jsonb_array_elements(v_rows)r where r->>'id'=p_id::text limit 1)end;
 return jsonb_build_object('context',jsonb_build_object('id',x.id,'role',x.role_code,'scope',x.scope_type),'view',p_view,'total',coalesce(v_total,0),'rows',coalesce(v_rows,'[]'),'summary',v_summary,'detail',v_detail,'read_only',true,'secret_ballots_redacted',true,'generated_at',statement_timestamp());
end $$;

create or replace function governance.open_ballot(
  p_context_id uuid,
  p_agenda_item_id uuid,
  p_question text,
  p_secret_ballot boolean default false
)
returns governance.votes
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit,extensions as $$
declare
  v_actor record;
  v_agenda governance.agenda_items;
  v_meeting governance.meetings;
  v_rule governance.legal_decision_rules;
  v_vote governance.votes;
  v_all_owners jsonb;
  v_assoc_members jsonb;
  v_present_members jsonb;
  v_units_per_owner jsonb;
  v_shares jsonb;
  v_conflicted jsonb := '[]'::jsonb;
  v_officers jsonb := '[]'::jsonb;
  v_proxies jsonb := '{}'::jsonb;
  v_total_units integer := 0;
  v_total_shares numeric(20, 10) := 0;
  v_dominant_owner uuid := null;
  v_dom_share numeric(20, 10) := 0;
  v_sum_other_shares numeric(20, 10) := 0;
  v_dominant_capped boolean := false;
  v_effective_dom_weight numeric(20, 10) := null;
  v_checksum text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.administer', true);

  select * into v_agenda from governance.agenda_items where id = p_agenda_item_id and tenant_id = v_actor.tenant_id;
  if v_agenda.id is null then raise exception 'agenda_item_not_found' using errcode = '42704'; end if;

  select * into v_meeting from governance.meetings where id = v_agenda.meeting_id and tenant_id = v_actor.tenant_id for update;
  if v_meeting.status <> 'open' then raise exception 'meeting_must_be_open_to_open_ballot' using errcode = '42501'; end if;

  -- Resolve active Legal Decision Rule
  if v_agenda.legal_decision_rule_id is not null then
    select * into v_rule from governance.legal_decision_rules where id = v_agenda.legal_decision_rule_id;
  elsif v_agenda.decision_category is not null then
    select * into v_rule from governance.legal_decision_rules
    where decision_category = v_agenda.decision_category
      and effective_from <= statement_timestamp()
      and (effective_to is null or effective_to > statement_timestamp())
    order by version desc limit 1;
  else
    select * into v_rule from governance.legal_decision_rules
    where decision_category = 'ordinary_resolution'
      and effective_from <= statement_timestamp()
      and (effective_to is null or effective_to > statement_timestamp())
    order by version desc limit 1;
  end if;

  if v_rule.id is null then
    raise exception 'legal_decision_rule_unconfigured' using errcode = 'P0001';
  end if;

  -- Build immutable snapshot elements
  select coalesce(jsonb_agg(distinct e.party_id), '[]'::jsonb) into v_all_owners
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  v_assoc_members := v_all_owners;

  select coalesce(jsonb_agg(distinct e.party_id), '[]'::jsonb) into v_present_members
  from governance.eligibility_snapshots e
  join governance.attendance a on a.meeting_id = v_meeting.id and a.eligibility_id = e.id
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  -- Aggregate each eligible owner first, then build one complete owner map.
  select coalesce(jsonb_object_agg(owners.party_id, owners.unit_count), '{}'::jsonb),
         coalesce(jsonb_object_agg(owners.party_id, owners.ownership_share), '{}'::jsonb)
  into v_units_per_owner, v_shares
  from (
    select e.party_id, count(distinct e.unit_id) as unit_count,
           sum(e.ownership_share) as ownership_share
    from governance.eligibility_snapshots e
    where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
    group by e.party_id
  ) owners;

  select count(distinct e.unit_id), coalesce(sum(e.ownership_share), 0)
  into v_total_units, v_total_shares
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  -- Active proxies mapping
  select coalesce(jsonb_object_agg(p.grantor_party_id, p.representative_party_id), '{}'::jsonb) into v_proxies
  from governance.proxies p
  where p.meeting_id = v_meeting.id and p.status = 'active';

  -- Statutory officers snapshot
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'office', o.office_type, 'party_id', o.party_id)), '[]'::jsonb) into v_officers
  from governance.statutory_officers o
  where o.property_id = v_meeting.property_id and o.status = 'active';

  -- Evaluate Administrator Conflict of Interest: Art. 49 alin. (3) lit. h
  -- Administrator & family have no voting right on administrator matters
  if v_agenda.decision_category in ('administrator_discharge', 'administrator_remuneration', 'administrator_contract', 'administrator_performance') then
    select coalesce(jsonb_agg(distinct p_id), '[]'::jsonb) into v_conflicted
    from (
      select o.party_id as p_id from governance.statutory_officers o
      where o.property_id = v_meeting.property_id and o.office_type = 'legal_administrator' and o.status = 'active'
      union
      select r.related_party_id as p_id from governance.statutory_officer_relationships r
      join governance.statutory_officers o on o.id = r.officer_id
      where o.property_id = v_meeting.property_id and o.office_type = 'legal_administrator'
        and r.verification_status in ('verified', 'pending_verification')
    ) sub;
  end if;

  -- Evaluate Dynamic Dominant Owner Formula: Art. 49 alin. (3) lit. c
  if v_rule.dominant_owner_cap_applicable and v_rule.voting_basis = 'ownership_share' then
    select e.party_id, sum(e.ownership_share) into v_dominant_owner, v_dom_share
    from governance.eligibility_snapshots e
    where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
    group by e.party_id
    having sum(e.ownership_share) > (v_total_shares / 2.0)
    limit 1;

    if v_dominant_owner is not null then
      v_sum_other_shares := v_total_shares - v_dom_share;
      v_dominant_capped := true;
      v_effective_dom_weight := v_sum_other_shares;
    end if;
  end if;

  v_checksum := encode(extensions.digest(
    p_agenda_item_id::text || ':' || v_total_units::text || ':' || v_total_shares::text || ':' || v_rule.id::text,
    'sha256'
  ), 'hex');

  -- Create immutable motion electorate snapshot
  insert into governance.motion_electorate_snapshots(
    tenant_id, agenda_item_id, meeting_id, legal_decision_rule_id,
    legal_decision_rule_snapshot, all_condominium_owners_count, association_owner_members_count,
    present_eligible_members_count, total_condominium_units, total_ownership_shares,
    all_condominium_owners, association_owner_members, present_eligible_members,
    property_units_per_owner, ownership_shares, directly_affected_owners,
    conflicted_excluded_voters, active_proxies, statutory_officers_snapshot,
    snapshot_checksum, created_at
  ) values (
    v_actor.tenant_id, p_agenda_item_id, v_meeting.id, v_rule.id,
    to_jsonb(v_rule), jsonb_array_length(v_all_owners), jsonb_array_length(v_assoc_members),
    jsonb_array_length(v_present_members), v_total_units, v_total_shares,
    v_all_owners, v_assoc_members, v_present_members,
    v_units_per_owner, v_shares, v_agenda.affected_owner_parties,
    v_conflicted, v_proxies, v_officers,
    v_checksum, statement_timestamp()
  ) on conflict (agenda_item_id) do nothing;

  -- Create vote
  insert into governance.votes(
    tenant_id, meeting_id, agenda_item_id, question,
    status, voting_method, opens_at, secret_ballot, rule_version,
    voting_basis, dominant_owner_capped, dominant_owner_party_id,
    original_dominant_share, capped_dominant_weight, excluded_voter_parties, created_at
  ) values (
    v_actor.tenant_id, v_meeting.id, v_agenda.id, p_question,
    'draft', case when v_rule.voting_basis = 'unit' then 'simple' else 'weighted' end,
    null, p_secret_ballot, v_rule.version,
    v_rule.voting_basis, v_dominant_capped, v_dominant_owner,
    case when v_dominant_capped then v_dom_share else null end,
    case when v_dominant_capped then v_effective_dom_weight else null end,
    v_conflicted, statement_timestamp()
  ) returning * into v_vote;

  -- Create vote options
  insert into governance.vote_options(tenant_id, vote_id, code, label, sequence_no)
  values
    (v_actor.tenant_id, v_vote.id, 'for', 'Pentru (For)', 1),
    (v_actor.tenant_id, v_vote.id, 'against', 'Împotrivă (Against)', 2),
    (v_actor.tenant_id, v_vote.id, 'abstain', 'Abținere (Abstain)', 3);

  -- The existing option guard permits writes only while the vote is draft.
  -- Open only after all options exist, within this same atomic transaction.
  update governance.votes
  set status = 'open', opens_at = statement_timestamp()
  where id = v_vote.id and tenant_id = v_actor.tenant_id
  returning * into v_vote;

  return v_vote;
end;
$$;

commit;

