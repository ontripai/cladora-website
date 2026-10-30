begin;
-- PT409 is a terminal HTTP conflict;40001 triggers transaction retries.
create or replace function customer_api.demo_update_item_v1(p_workspace_id uuid,p_item_id uuid,p_expected_version integer,p_patch jsonb)
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
notify pgrst,'reload schema';
commit;
