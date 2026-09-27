begin;

-- The public API wrappers call internal functions whose EXECUTE grants are
-- intentionally withheld from authenticated users. Run only these two
-- wrappers as their owner so the internal authorization checks can execute.
-- Both wrappers explicitly require auth.uid(), and the internal routines
-- resolve the signed caller's live membership, entitlement, and permission.
alter function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)
  security definer;
alter function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)
  security definer;

-- Keep direct access to privileged document routines closed.
revoke all on function documents.create_upload_intent_internal(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated;
revoke all on function documents.finalize_upload_internal(uuid, uuid, text, bigint, text, text, text, text, uuid)
  from public, anon, authenticated;

commit;
