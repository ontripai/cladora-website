begin;

-- A user who uploaded a deferred file must not bypass the scanner gate by
-- reading Storage directly. Signed downloads require the vault authorization
-- RPC and an independently attested clean verdict.
drop policy if exists document_vault_tenant_select on storage.objects;

commit;
