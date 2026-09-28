begin;

-- Storage uses INSERT ... RETURNING for uploads. The returned row requires
-- SELECT RLS, scoped to the upload operation and the exact active intent.
-- No GET, list, signed URL or direct SQL SELECT is authorized by this policy.
create policy document_vault_upload_returning_select on storage.objects
for select to authenticated
using (
  bucket_id = 'document-vault'
  and storage.allow_only_operation('object.upload')
  and documents.vault_upload_intent_allowed(name)
);

commit;
