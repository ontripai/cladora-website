begin;

-- Projection-only: no quote acceptance, Order, approval or ledger write.
create function app_private.fin01_service_quote_proposal_v1(
  p_context_id uuid, p_workspace_id uuid, p_quote_id uuid,
  p_quote_version bigint, p_total_minor numeric, p_currency text,
  p_beneficiary_party_id uuid, p_published_at timestamptz, p_current boolean
)
returns jsonb
language plpgsql stable set search_path = pg_catalog
as $$
declare v_amount text; v_state text;
begin
  if p_context_id is null or p_workspace_id is null or p_quote_id is null
     or p_beneficiary_party_id is null or p_published_at is null
     or p_quote_version not between 1 and 9007199254740991
     or p_total_minor < 0 or p_total_minor <> trunc(p_total_minor)
     or p_total_minor > 999999999999999999
     or p_currency not in ('RON','EUR','GBP','USD') then
    raise exception 'fin01_service_quote_invalid' using errcode = '22023';
  end if;
  v_amount := to_char(p_total_minor / 100.0, 'FM9999999999999990.00');
  v_state := case when p_current then 'pending' else 'expired' end;
  return jsonb_build_object(
    'contract_version', 'financial-proposal-posting-receipt.v1',
    'proposal_id', p_quote_id, 'proposal_version', p_quote_version,
    'idempotency_key', 'fin01:service_quote:' || p_quote_id::text,
    'context_id', p_context_id, 'workspace_id', p_workspace_id,
    'source', jsonb_build_object(
      'source_domain', 'service', 'source_entity_type', 'service_quote',
      'source_entity_id', p_quote_id, 'source_version', p_quote_version,
      'source_reference', 'service_catalog.quote_drafts:' || p_quote_id::text || ':v' || p_quote_version::text
    ),
    'resource', null, 'proposal_kind', 'charge',
    'amounts', jsonb_build_object(
      'currency', p_currency, 'net_amount', v_amount, 'tax_amount', '0.00',
      'gross_amount', v_amount, 'tax_treatment_code', 'service_quote_tax_not_separated',
      'tax_rule_version', 1
    ),
    'payers', jsonb_build_array(jsonb_build_object(
      'party_id', p_beneficiary_party_id, 'payer_role', 'customer',
      'allocated_amount', v_amount, 'approval_state', v_state,
      'approval_reference', null
    )),
    'occurred_on', p_published_at::date, 'due_on', null,
    'approval_state', v_state, 'approval_version', 0,
    'requested_at', p_published_at, 'posting_authorization', 'not_evaluated'
  );
end;
$$;

revoke all on function app_private.fin01_service_quote_proposal_v1(
  uuid, uuid, uuid, bigint, numeric, text, uuid, timestamptz, boolean
) from public, anon, authenticated, service_role;

create or replace function customer_api.read_service_quote_publications_v1(
  p_context_id uuid, p_workspace_id uuid, p_mode text
) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare v record; v_quotes jsonb; v_can_publish boolean := false;
begin
  if p_mode is null or p_mode not in ('coordinator','recipient') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into strict v from app_private.service_request_authorize_v1(
    p_context_id, p_workspace_id,
    case when p_mode = 'coordinator' then 'services.quotes.manage' else 'services.orders.read' end
  );
  if p_mode = 'coordinator' then
    v_can_publish := app_private.check_workspace_native_permission_v2(
      p_context_id, p_workspace_id, 'services.quotes.publish', 'services_orders'
    ) is true;
  end if;
  select coalesce(jsonb_agg(x.item order by x.created_at desc, x.id), '[]') into v_quotes
  from (
    select d.id, d.created_at, jsonb_build_object(
      'quote_id', d.id, 'version', d.version, 'description', r.description,
      'scope', d.scope, 'total_minor', d.total_minor::text, 'currency', d.currency,
      'valid_until', d.valid_until, 'provider_label', p.legal_name,
      'beneficiary_label', b.legal_name, 'published_at', pub.published_at,
      'state', case
        when exists(select 1 from service_catalog.quote_drafts newer where newer.request_id=r.id and newer.version>d.version) then 'superseded'
        when d.valid_until<=clock_timestamp() then 'expired'
        when pub.quote_id is not null then 'presented' else 'draft' end,
      'financial_proposal', case when pub.quote_id is null then null else
        app_private.fin01_service_quote_proposal_v1(
          p_context_id, p_workspace_id, d.id, d.version, d.total_minor, d.currency,
          r.beneficiary_party_id, pub.published_at,
          d.valid_until>clock_timestamp() and not exists(
            select 1 from service_catalog.quote_drafts newer where newer.request_id=r.id and newer.version>d.version
          )
        ) end
    ) item
    from service_catalog.quote_drafts d
    join service_catalog.requests r on r.id=d.request_id and r.tenant_id=d.tenant_id and r.workspace_id=d.workspace_id
    join portfolio.parties b on b.id=r.beneficiary_party_id and b.tenant_id=r.tenant_id and b.archived_at is null
    join service_catalog.offerings o on o.id=r.offering_id and o.tenant_id=r.tenant_id and o.workspace_id=r.workspace_id
    join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=r.tenant_id and p.archived_at is null
    left join service_catalog.quote_publications pub on pub.quote_id=d.id
    where r.tenant_id=v.tenant_id and r.workspace_id=p_workspace_id and r.status='submitted'
      and exists(select 1 from identity.membership_parties mp where mp.membership_id=r.membership_id
        and mp.tenant_id=r.tenant_id and mp.party_id=r.beneficiary_party_id
        and mp.valid_from<=clock_timestamp() and(mp.valid_until is null or mp.valid_until>clock_timestamp()))
      and(p_mode='coordinator' or(pub.quote_id is not null and r.requester_id=auth.uid() and r.membership_id=v.membership_id))
    order by d.created_at desc,d.id limit 50
  ) x;
  return jsonb_build_object('quotes',v_quotes,'can_publish',v_can_publish);
end;
$$;

revoke all on function customer_api.read_service_quote_publications_v1(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function customer_api.read_service_quote_publications_v1(uuid,uuid,text) to authenticated;

comment on function app_private.fin01_service_quote_proposal_v1(
  uuid, uuid, uuid, bigint, numeric, text, uuid, timestamptz, boolean
) is 'FIN-01 projection-only proposal from a published SERVICE quote; payer approval and posting authority remain withheld.';

commit;
