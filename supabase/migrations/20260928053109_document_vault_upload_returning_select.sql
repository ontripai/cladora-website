begin;

-- Hosted Storage has this operation helper, whereas some local CLI Storage
-- schemas do not. Real uploads do not require RETURNING on current Storage;
-- keep the optional metadata policy scoped to upload where supported.
do $$ begin
  if to_regprocedure('storage.allow_only_operation(text)') is not null then
    execute $policy$
      create policy document_vault_upload_returning_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'document-vault'
        and storage.allow_only_operation('object.upload')
        and documents.vault_upload_intent_allowed(name)
      )
    $policy$;
  end if;
end $$;

commit;
