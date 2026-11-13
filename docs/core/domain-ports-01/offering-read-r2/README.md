# Independent Offering definitions read / R2

Consumer cf3d1e3349298c4cc4cf8f6f771c78179cc2bc52 is consumed from official
bundle blob953d66532c652a155a27e705137de67e046a2b38,26321 bytes,
SHA2568b1dc6a1cd3ecee9f6467dc362b8163ff5cc36c28e9ce69e8c96de2332a1542c.
Bundle identities/verify/import passed; publication of that commit is not assumed.

Core export: createCoreServiceOfferingReadBindingV1 in
src/lib/core/service-offering-read-binding-v1.ts, contract core-offering-read-binding.v1.
Call once in trusted request composition with admitted pool/target; bind(original
NextRequest) returns only `readDefinitions({context_id,workspace_id})`.
It structurally satisfies SERVICE's optional readDefinitions slot. The other
four optional methods are ABSENT, not fake successful implementations.

The actual canonical customer_api.list_service_definitions_v1(uuid,uuid) runs on
the existing Core C01 authenticated SERIALIZABLE scoped lease under
services.catalog.manage/services_catalog. Identity/current authority is rechecked
before/after waits by the existing proxy/checkpoint. Positive ROLLBACK, same-backend
DB completion clock and cleanup precede value return; no command reservation or
COMMIT. No SDK/browser/service_role fallback. Actual42501/40001/42883 is retained.
Exact RPC fields are definition_id/code/labels; no frontend-invented version or
active field is inserted. Empty array is valid; absent/malformed/error is not empty.

Platform still must attest presence/body/owner/ACL/RLS and narrowly admitted
EXECUTE on this exact RPC for its actual runtime principal. Source availability
is not a grant. SERVICE owns registration in its resolver, route/UI behavior and
definition mutation/provider lifecycle. No existing Request/published catalog
route is activated or changed by Core. New kind definitions is additive in the
existing closed runtime; old selections/catalog/requests meanings are unchanged.

6 new controlled producer groups passed, covering source shape/zero writes,
empty/error distinction, AAL/session/current authority, same40001, missing RPC/
privilege, foreign Workspace and hostile caller fields. SDK/PG transport is
controlled, not hosted/native proof. Existing successful SERVICE54/Quote34/Request
suites were not rerun. Quote read/create and Listing discovery are separate open
producer units; no Offering permission is represented as their authority.

Automation: نیازمند بررسی — exact fields/pins and bounded error checks are mechanical;
Platform/Coordinator admit actual role/target and SERVICE owns explicit UI effects.

Latest successor identity/Quote coupling and exact remaining S01 closure:
../successor-coupling-r2/README.md.
