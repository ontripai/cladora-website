begin;

-- Storage INSERT is evaluated as authenticated. Reading upload_intents in the
-- policy itself sees zero rows because that table intentionally has no user
-- SELECT policy. Keep intents private and verify one exact, unexpired path in
-- a narrowly scoped definer instead.
create function documents.vault_upload_intent_allowed(p_object_path text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and exists (
    select 1 from documents.upload_intents ui
    where ui.bucket_id = 'document-vault'
      and ui.object_path = p_object_path
      and ui.user_id = auth.uid()
      and ui.status in ('created', 'authorized')
      and ui.expires_at > statement_timestamp()
      and ui.consumed_at is null
  );
$$;
revoke all on function documents.vault_upload_intent_allowed(text) from public, anon;
grant execute on function documents.vault_upload_intent_allowed(text) to authenticated;

drop policy if exists document_vault_intent_insert on storage.objects;
create policy document_vault_intent_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'document-vault'
  and auth.uid() is not null
  and documents.vault_upload_intent_allowed(name)
);

commit;
