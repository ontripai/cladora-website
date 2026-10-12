# AP-PF02 candidate mapping and consumer preparation

Owner: AIRPROP test consumer. Provider: Core/Platform, accepted PR #353 revision
`4728fcce8392ebea3a13875ed19ab2895fe0f5a0`.
Gate: **accepted exact revision under AIRPROP consumer verification**.
This remains an offline contract verification; no Dynamic Resource runtime, API or
route is enabled by this test package.

The earlier candidate `50fab5737bee7687efb17efbbfd0655496896656`
passed its own 16-case preparation run while its acceptance gate was closed. That
historical result is retained in PM version 23 and is not transferred to the accepted
revision. All cases must execute again against the exact accepted pin above.

The consumer loads the unchanged provider `ap-pf02-core-companion.v1` adapter and
its real schemas from a separately checked-out exact revision. It does not copy a
Core implementation into AIRPROP or register parallel identity/authority records.

| Required semantic | Exact candidate mapping / limit |
| --- | --- |
| Resource identity/version | `canonical_reference.resource_id/resource_version`, emitted as `resource.resource_id/resource_version`; exact request match required |
| Safe official name | `canonical_reference.display_name` → `resource.display_name`; withheld on denial |
| Workspace/Context | `source.source_context_id` equals request Context; canonical/relationship/authority Workspace matches; unknown Context fails closed |
| Natural/legal owner | `relationship.party_id/party_kind` → `party`; party display name remains null until a separately authorized resolver exists |
| Representation | Explicit `relationship_kind=representation` → representation reference; expiry/revocation independently deny |
| Current authority | Current, matching `workspace-native-effective-authority.v2`; stale or denied evidence is withheld; snapshot is never command authority |
| Provenance | Source class/Context/Workspace are bounded; source and relationship evidence strings are always null in output |
| Historical compatibility | Exact existing canonical IDs/versions preserved in tests; no alias inferred, history rewritten or persisted migration |

`scripts/test-airprop-pf02-candidate.mjs` verifies the actual provider adapter:
person/company ownership, representation, Workspace/Context isolation, missing and
revoked authority, stale authority, revoked/expired relationships, offset expiry,
stale Resource/relationship versions, malformed evidence, redaction and identifier
preservation. It emits an exact-pin verification receipt with
`runtime_enabled=false` and the accepted-revision consumer gate. Passing these tests
completes the AIRPROP contract/mapping review for this pin; it does not enable a
runtime route or clear release controls.

Any later #353 revision requires fresh acceptance and verification. Core remains
owner of the installed resolver/companion handoff, authorized party-name disclosure
and any explicit historical compatibility mapping beyond canonical ID equality.

AP10 may proceed independently with authorized #351 fixture
`aa527c498467fc3cba0efddf3561424dc27bb726`. #357 metadata review at
`f22aba3738883b5effaf8ee97146bf3ad7b5cba2` is preserved and not rebuilt.
Release remains blocked by **DB-HIST-01**. No Merge, Remote migration, db push,
migration repair, Production deployment or shared Auth/configuration change occurs.
