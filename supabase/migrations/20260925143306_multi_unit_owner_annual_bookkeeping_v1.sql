begin;
create index owner_private_cash_paid_idx on public.owner_private_cash_entries(owner_user_id,paid_on,unit_id)
  where paid_on is not null;

-- Bookkeeping totals only; no statutory tax rate, liability or deduction
-- is calculated from owner-entered data.
create function customer_api.owner_annual_bookkeeping_v1(p_year integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_summary jsonb;
begin
  if not app_private.has_multi_unit_owner_role_v1() then raise exception 'owner_role_required' using errcode='42501'; end if;
  if p_year not between 2000 and 2100 then raise exception 'invalid_year' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('unit_id',unit_id,'currency',currency,
    'kind',kind,'direction',direction,'entry_count',entry_count,'amount',amount)
    order by unit_id,currency,kind,direction),'[]'::jsonb) into v_summary
  from (
    select e.unit_id,e.currency,e.kind,e.direction,count(*) entry_count,sum(e.amount) amount
    from public.owner_private_cash_entries e
    join public.owner_private_units u on u.id=e.unit_id and u.owner_user_id=e.owner_user_id
    where e.owner_user_id=auth.uid() and e.paid_on>=make_date(p_year,1,1)
      and e.paid_on<make_date(p_year+1,1,1) and u.status='active'
    group by e.unit_id,e.currency,e.kind,e.direction
  ) v;
  return jsonb_build_object('year',p_year,'basis','self_reported_paid_on','groups',v_summary);
end $$;
revoke all on function customer_api.owner_annual_bookkeeping_v1(integer) from public;
grant execute on function customer_api.owner_annual_bookkeeping_v1(integer) to authenticated;
commit;
