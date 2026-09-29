-- A customer may read and change only the display name of their own profile.
create function customer_api.my_profile_v1()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare v_profile record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select display_name, locale, timezone into v_profile
    from identity.profiles where user_id = auth.uid();
  return jsonb_build_object('display_name', v_profile.display_name,
    'locale', v_profile.locale, 'timezone', v_profile.timezone);
end;
$$;

create function customer_api.update_my_profile_v1(p_display_name text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare v_name text := btrim(p_display_name);
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  insert into identity.profiles(user_id, display_name)
    values(auth.uid(), v_name)
    on conflict(user_id) do update set display_name = excluded.display_name;
  return jsonb_build_object('display_name', v_name);
end;
$$;

revoke all on function customer_api.my_profile_v1(), customer_api.update_my_profile_v1(text) from public, anon;
grant execute on function customer_api.my_profile_v1(), customer_api.update_my_profile_v1(text) to authenticated;
