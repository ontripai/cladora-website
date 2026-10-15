# SERVICE-MULTI-COUNTRY-PAYMENT-PROFILE-01

Status: **`country_pack_payment_extensions_required`**

This is a documentation-only discovery package. It changes no implementation,
migration, adapter, route, credential, grant, payment record, Remote database,
runtime wiring, or activation.

## Reviewed baseline

The inventory was taken from live `main` at
`f6ca01378f1f56f4c4233b69777f04704db053b9` (tree
`061e5666b1be6b014494a36237757bdee6bfa515`). The governing contracts are:

| Contract | Reviewed SHA-256 | Role in this design |
| --- | --- | --- |
| `CLADORA-CORE-JURISDICTION-PROFILE-v1.0.md` | `0ab9ad406d93c7bf794b9e8cadaa441358dcef974c4e826ed81a044692357471` | Property-bound profile and payment-domain invariants |
| `CLADORA-CORE-JURISDICTION-PROFILE-SELECTOR-v1.0.md` | `e64d0e5165dcd3464065937a81ee34f9ce80cbe1126b9d1371350636e25eb262` | Transaction-scoped selection of exact domain identities and hashes |
| `AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md` | `725f9fa5161dc525790192645584c6ad004115aeaad815291801d71dc576c4cf` | Versioned country artifact source; never a credential store |

Repository presence is evidence of an inactive contract. It does not establish
an active Country Pack, Remote installation, payment-provider connectivity,
merchant onboarding, regulatory acceptance, or runtime acceptance.

The terms in this document are classified as follows:

- **Observed**: present in the repository at the reviewed baseline.
- **Required extension**: a later owner-delivered contract or implementation;
  none is created here.
- **Unavailable**: target deployment or runtime evidence not established by
  this repository review.

## Governing boundary

The property is the country source. Country must not be derived from locale,
currency, user location, Tenant, Workspace, postal code, payment method, bank
identifier, or provider. A country-sensitive payment command must consume the
current property assignment through the Core selector inside the same
serializable transaction as current authority and source locks.

The selector returns status-only metadata: assignment/profile identity and
version, country, default currency, manifest hash, and each requested domain's
contract version and artifact hash. It deliberately does not return an
artifact body. A consumer therefore cannot infer rail, exponent, rounding,
refund, settlement, invoice, or receipt policy from a hash or from
`default_currency_code`.

The minimum payment domains identified by the Core contract are:

- `payments.local_rails` for allowed currencies, rail capabilities and
  effective rail availability;
- `payments.settlement` for settlement timing, precision, rounding, refund and
  allocation constraints; and
- `payments.regulatory` for invoice/receipt evidence and blocking regulatory
  results.

If a future accepted Country Pack separates invoice or tax rules into domains
such as `accounting.invoice` or `tax.vat`, the SERVICE command must request
those exact codes as well. It must not guess an artifact from another domain.

## Current payment-path inventory

### SERVICE FIN01 contract path

**Observed.** `src/lib/customer/service-finance-v14-schema.ts` is a pure
consumer/evaluator for four actions:

| Action | Canonical source kind expected by the evaluator |
| --- | --- |
| `request_invoice` | versioned delivery acceptance |
| `apply_payment` | versioned payment |
| `request_refund` | versioned payment plus bounded reason |
| `request_provider_settlement` | versioned settlement source |

Its `service-financial-operation-receipt.v1` binds Workspace, actor authority,
Order/version, action, source identity/version, idempotency key/fingerprint,
currency, `amount_minor`, tax snapshot, rounding-policy version and payer-share
snapshot. It rejects client-owned money, tax, currency, rounding and ledger
claims. It does not create an invoice, payment, refund, settlement, allocation,
journal, receipt ledger or provider call.

**Gap.** FIN01 has no property, jurisdiction assignment/profile identity,
Country Pack domain contract/hash, currency exponent, rail identity, adapter
identity, merchant configuration reference, artifact effective time, or
historical country-binding fields. Its rounding-policy version is not proof of
a selected Country Pack artifact. It remains a contract-only SERVICE boundary.

### Customer payment-intent creation

**Observed.** `POST /api/customer/v1/payments/intents` accepts client-supplied
amount, currency, `provider_code`, payment method and invoice allocation. The
HTTP schema defaults currency to `RON`, provider to `bank_transfer`, and method
to `bank_transfer`. It calls `customer_api.create_payment_intent_v1` before any
adapter selection.

The current database path:

1. resolves the authenticated customer Context, payment permission, unit,
   property and debtor;
2. replays an existing tenant-scoped idempotency key or creates an intent;
3. chooses the latest tenant-wide allocation policy;
4. chooses an active beneficiary for the supplied currency, allowing a
   tenant-global `property_id IS NULL` beneficiary fallback;
5. snapshots beneficiary, allocation policy and invoices; and
6. stores `provider_code='unconfigured'` and the client payment method.

Only after that write does the route use the client `provider_code` to call
`getPaymentProviderAdapter`. The registry always returns the deferred adapter,
but this order still means a missing or unsupported rail does not produce
pre-write zero-write denial. The persisted intent does not record a selected
profile, artifact, rail, adapter contract or merchant configuration.

The idempotency replay conflict currently compares actor, unit, amount and
currency. It does not bind the complete invoice selection, payment method,
Country Pack revision, rail, artifact hashes, provider configuration or
adapter version. A generated timestamp key is used when the client omits the
key, so a transport retry cannot reliably recover the original command.

### Beneficiary and merchant configuration

**Observed.** `payments.beneficiary_accounts` versions approved bank
destinations and stores the full IBAN through Vault, with a masked snapshot in
the intent. Configuration can be property-specific or tenant-global and
defaults currency to `RON`. Approval uses dual control.

`payments.provider_accounts` stores configuration metadata, including
`provider_code`, `external_merchant_id`, environment, capabilities,
beneficiary, settlement currency and enabled state. Its defaults are
`unconfigured`, sandbox, `bank_transfer`, `RON`, and disabled. The current
intent function does not select this row, and the HTTP adapter does not receive
its identity or version.

Webhook secrets are read from deployment environment variables. This is the
correct separation from Country Pack data. The target credential, merchant
onboarding state, secret version, network connectivity and effective provider
account are unavailable in this review.

### Direct bank instruction and EPC

**Observed.** `generate_bank_instruction_v1` resolves an existing intent and
the HTTP handler requires a full IBAN-shaped destination. The TypeScript
builder is explicitly an EPC/SEPA implementation. It:

- treats IBAN as the universal bank destination shape;
- emits an EPC SCT payload only when currency is `EUR`;
- formats all values with `toFixed(2)`;
- falls back to `RON` when currency is absent; and
- uses a global CLADORA structured-reference format.

These are European/Romanian rail behaviors, not global payment invariants.
IBAN, EPC, SCT, two decimal places and structured-reference syntax must be
capabilities of the selected `payments.local_rails` artifact and selected
adapter. A non-IBAN country or a currency with a non-two exponent cannot safely
use this builder.

### Webhook, settlement and refund

**Observed.** The webhook route selects `provider_code` from a request header,
looks up an environment secret, then calls the database through an admin
client. If neither provider-specific nor global webhook secret exists, the
current handler skips HMAC verification. Provider event IDs fall back to a
timestamp-derived value when missing. This legacy route is not an acceptable
Country Pack rail-selection boundary and `service_role`/admin access must not
be a fallback for the proposed contract.

The database webhook function resolves a payment intent, locks it, deduplicates
`(tenant, provider_code, provider_event_id)`, records a webhook receipt, and
handles successful settlement/accounting in one database transaction. Provider
refund, chargeback and reversal events are marked deferred/requires-review;
they do not implement a country-aware refund rail. There is no profile/artifact
binding in the webhook receipt, settlement or refund record.

The customer `/refund` and `/reverse` HTTP routes currently invoke the same
`reverse_payment_v1` operation. That path restores receivables, reverses active
allocations and posts a compensating journal. It is an accounting reversal,
not proof of a provider refund, Country Pack refund eligibility, original-rail
return, receipt cancellation, or regulatory reporting.

### Invoice, receipt and allocation

**Observed.** Billing invoices and several payment/accounting tables default to
`RON`. Payment, settlement and refund values use fixed-scale numeric columns,
commonly `numeric(12,2)` or `numeric(20,4)`. Application-facing payment types
use JavaScript `number`; the EPC builder fixes two decimal places. No canonical
currency-exponent registry is consulted.

The payment-intent allocation policy is tenant-wide, versioned and snapshotted.
Its minimum partial amount is `numeric(12,2)`, and its strategies are
`oldest_due_first`, `current_period_first`, `invoice_selected` and
`proportional`. Allocation enforces currency equality and prevents
over-allocation, but the policy is not property/country/profile bound and its
rounding/remainder behavior is not obtained from a Country Pack artifact.

Invoices, beneficiary configuration and payment intents preserve some local
snapshots, which is useful historical evidence. They do not preserve the
jurisdiction profile and domain hashes required to prove why a currency, rail,
rounding mode, settlement rule, refund rule, receipt form or allocation policy
was selected.

### Reconciliation paths

**Observed.** Customer payment recording, bank-statement import, match,
unmatch, allocation, unallocation, reversal and reconciliation RPCs enforce
tenant/Context checks and currency equality in their respective paths. Their
HTTP schemas and SQL wrappers include `RON` defaults, fixed decimal amounts and
globally named methods such as bank transfer, card, cash and direct debit.

These paths are downstream financial operations. They are not currently
connected to the Jurisdiction Profile Selector and cannot retroactively supply
the missing rail/profile evidence for an intent. Country-aware bank statement
formats and reconciliation rails need their own future mapping; this package
does not expand that scope into an adapter implementation.

## Hidden country and global assumptions

| Surface | Observed assumption | Required disposition |
| --- | --- | --- |
| HTTP intent and payment schemas | Missing currency becomes `RON` | Remove fallback for profile-aware commands; select exact allowed currency from artifact |
| SQL intent/payment/config signatures | `p_currency` defaults/coalesces to `RON` | New versioned path must require a selected artifact; legacy v1 behavior cannot define the new contract |
| Beneficiary/provider/settlement/refund/invoice tables | `RON` defaults and fixed scale | Future durable schema must pin currency exponent and rounding artifact without rewriting old rows |
| Bank instruction | IBAN accepted as universal destination | Rail artifact chooses the destination/addressing schema |
| EPC QR | EUR-only branch and `toFixed(2)` | Adapter capability plus artifact-supplied exponent/rounding; no implicit EPC |
| Payment method | Global enum/string (`bank_transfer`, `card`, cash/direct debit elsewhere) | Exact rail capability maps to an allowed method; method alone never selects a rail |
| Allocation | Latest tenant-wide policy and decimal minimum | Property/profile compatibility and artifact-defined precision/remainder constraints required |
| Beneficiary selection | Property-specific row or tenant-global null-property fallback | Profile-aware command requires an exact property-compatible destination; no global fallback |
| Provider selection | Client header/body and deferred registry | Server selects a reviewed adapter from exact artifact capability plus deployment registry |
| Webhook credential | Environment secret, optional verification when absent | Credentials stay deployment-only; enabled rail must fail closed if exact secret/config is unavailable |
| Webhook database role | Admin client | No `service_role` fallback; later runtime requires an approved least-privilege host/profile |
| Country | Absent from payment command/receipt | Select from canonical property assignment; never infer from locale, currency or IBAN prefix |

## Required consumption contract

No new country registry or payment truth is proposed. The future SERVICE
consumer must compose existing canonical owners through a transaction-scoped
binding. A suitable contract identity for owner review is
`service-payment-jurisdiction-binding.v1`; the final name and schema require a
separate implementation package.

### Input and selection

The server command must include the exact property in
`command.provider_source_ids`, a caller-independent effective transaction
instant, the requested operation, and a client idempotency key. Inside the Core
transaction it must:

1. recheck current Core authority and Workspace/property scope;
2. call the Jurisdiction Profile Selector for the exact property and every
   domain required by the operation;
3. load typed immutable artifact bytes using the returned contract versions
   and SHA-256 hashes through a canonical artifact resolver;
4. validate artifact identity, country, version, validity interval, status and
   manifest membership;
5. derive allowed currency, exponent, rounding, rail and operation constraints
   from those artifacts; and
6. resolve one separately authorized deployment adapter and merchant
   configuration that declares support for that artifact rail.

The current selector supplies step 2 metadata but there is no observed typed
payment-artifact resolver for step 3. Hashes must never be interpreted as
payloads, and SERVICE must not copy Country Pack content into a parallel store.

### Accepted binding evidence

A committed payment intent or financial operation must preserve at least:

- property and Workspace;
- assignment ID/version;
- profile ID/code/version/country and manifest hash;
- every required domain code, contract version and artifact hash;
- effective transaction instant;
- currency code, exponent, rounding mode/increment and rule identity;
- rail capability ID/version and allowed payment method;
- adapter contract ID/version and deployment configuration reference/version;
- invoice/receipt, settlement, refund and allocation policy references used by
  that operation;
- current authority receipt identity/revision;
- normalized command fingerprint and case-sensitive idempotency binding; and
- bounded result/reason and immutable evaluation time.

Deployment configuration references may identify a reviewed configuration
record but may not contain merchant IDs intended to be private, secrets,
credential material, endpoint tokens, or raw Country Pack content. Credentials
and provider connectivity remain outside the Country Pack and receipt.

### Selection and denial semantics

The server, never the browser, chooses the rail and adapter. Selection is the
intersection of:

1. the active artifact for the exact property/country/effective instant;
2. operation, currency and method capabilities allowed by that artifact;
3. an active separately authorized deployment adapter; and
4. exact compatible merchant/beneficiary configuration for that property and
   rail.

There is no fallback to locale, profile default currency without an operation
artifact, Tenant-wide/global payment defaults, a null-property beneficiary,
the first configured provider, a generic deferred adapter, `service_role`, or
an owner connection.

Expected bounded denials are:

| Code | Meaning | Durable effect |
| --- | --- | --- |
| `PAYMENT_JURISDICTION_UNAVAILABLE` | Assignment/profile is missing, inactive, unsigned, stale or country-mismatched | Zero write |
| `PAYMENT_DOMAIN_UNAVAILABLE` | Required domain/artifact is missing, expired, inactive, wrong-version or hash-invalid | Zero write |
| `PAYMENT_CURRENCY_UNSUPPORTED` | Currency/exponent/rounding is not allowed by the selected artifacts | Zero write |
| `PAYMENT_RAIL_UNAVAILABLE` | Rail/method is missing, expired or unsupported | Zero write |
| `PAYMENT_CONFIGURATION_UNAVAILABLE` | Exact adapter, merchant, credential reference or beneficiary configuration is unavailable | Zero write |
| `PAYMENT_REGULATORY_DENIED` | Invoice, receipt, refund, settlement or regulatory requirement blocks the operation | Zero write |
| `PAYMENT_REPLAY_CONFLICT` | Same key has a different normalized command or binding | Zero write |
| `PAYMENT_OUTCOME_UNKNOWN` | Commit acknowledgement is uncertain | No speculative retry or additional write |

Normal denials must expose no alternate rail, merchant, beneficiary, profile,
artifact, property or Workspace metadata. Selection and idempotency claim must
be in the same Core transaction as the payment mutation, audit and outbox, or
all must roll back.

### Historical stability

The first validated property country is immutable under the Core contract.
Profile and domain revisions may advance only through new immutable versions.
An existing payment intent keeps its original assignment/profile/artifact,
currency, precision, rail and adapter bindings. A new profile revision,
beneficiary, merchant configuration, adapter, property address correction or
country metadata change must not rewrite it.

Retry with the same key and identical command returns the original accepted
receipt only after current authority and relevant provider state are rechecked.
A changed artifact, rail or command under the same key conflicts. A new command
may select a newer active profile; historical settlement/refund rules remain
those explicitly pinned by the original intent unless a versioned artifact
defines and records a lawful supersession operation.

Unknown COMMIT must use the existing Core transaction-host recovery contract:
return `READBACK_REQUIRED`, retain the original command and key, and perform no
blind retry with a new key. The current customer payment route does not provide
this guarantee and must not be relabelled as compliant.

## Dependency map

| Dependency | Canonical owner | Existing evidence | Required extension |
| --- | --- | --- | --- |
| Property jurisdiction assignment/profile | Core/Platform | Registry and selector exist as inactive foundation | Install/activate only under separate authorization; SERVICE consumes, never duplicates |
| Typed payment artifact bodies | Country Pack owner with Core registry | Contracts name domains and hashes; selector returns metadata only | Versioned schemas and a canonical hash-verified resolver for local rails, settlement and regulatory artifacts |
| Country legal/accounting acceptance | Country Pack legal/accounting owners | Signoff fields are modeled | Accepted artifacts per country/effective date; no legal claim from test fixtures |
| Currency exponent and rounding | Finance + Country Pack | FIN01 carries amount-minor and rounding version; legacy runtime fixes scale | Canonical currency/rounding rule mapped from artifact, including increment and remainder behavior |
| Invoice/receipt/refund/settlement rules | Finance + Country Pack | Legacy invoice/reversal/settlement flows exist | Exact domain mapping and immutable policy evidence per operation |
| Allocation policy | Finance | Tenant-wide versioned policy and snapshots exist | Compatibility rule with selected property/profile/artifact and precision; no global fallback |
| Rail adapter registry | Payments/Operations | Deferred adapter and provider metadata exist | Closed server-side mapping from artifact capability to reviewed adapter contract/version |
| Merchant/beneficiary configuration | Payments/Operations | Versioned beneficiary and provider metadata exist | Exact property/rail compatibility, effective version and fail-closed availability |
| Credentials/connectivity | Deployment Operations | Environment secret lookup exists; target evidence unavailable | Secret/config binding outside Country Pack, least privilege, rotation/version evidence, no secret in receipts |
| Atomic execution/recovery | Core/Platform + Payments | Core host supports replay, 40001 retry and unknown commit; legacy route does not use it | Payment composition on Core host with one idempotency/audit/outbox boundary |
| SERVICE FIN01 mapping | SERVICE | Pure receipt evaluator exists | Map accepted jurisdiction/rail evidence to FIN01 without making SERVICE the finance or provider owner |
| Runtime role/pool | Core/Platform Security | No accepted payment-specific role-bound composition identified | Separate reviewed least-privilege profile; no admin/owner/`service_role` fallback |

## Topological delivery plan

1. **Country payment artifact contracts.** Country Pack and Finance owners
   define the typed, immutable `payments.local_rails`,
   `payments.settlement` and `payments.regulatory` artifacts, including
   exponent, rounding, refund, invoice/receipt and allocation semantics.
2. **Canonical artifact resolution.** Core exposes hash-verified typed artifact
   resolution inside the existing selector transaction. This is an extension
   of the jurisdiction boundary, not a SERVICE cache.
3. **Deployment adapter contract.** Payments/Operations define the closed rail
   capability-to-adapter/configuration mapping, credential reference boundary
   and availability result. No credential enters a Country Pack.
4. **SERVICE consumer mapping.** SERVICE adds the strict jurisdiction binding
   envelope and maps it into the existing FIN01 consumer. It remains inactive
   and uses injected providers.
5. **Persistence design.** Finance/Payments review the minimal additive fields
   needed to pin historical artifact, precision, rail and adapter evidence.
   Existing intents are not silently backfilled or reinterpreted.
6. **Atomic host composition.** Core and Payments compose selector, artifact
   resolver, adapter selection, idempotency, mutation, audit and outbox with
   unknown-commit readback. No route is added in this step.
7. **Isolated runtime evidence.** After separately authorized migrations and
   role installation, use disposable PostgreSQL and provider simulators for
   DB/API/concurrency evidence.
8. **Rollout.** Credential installation, Remote apply, grants, Production
   routing and activation are separate reviewed operations.

Steps are not interchangeable: SERVICE cannot safely implement its mapping
before artifact schemas/resolution exist, and route activation cannot precede
atomic persistence, role, concurrency and unknown-commit acceptance.

## Future conformance matrix

| ID | Layer | Case | Required result |
| --- | --- | --- | --- |
| MC-PAY-01 | Contract | Property present in `provider_source_ids`; exact Workspace/property assignment | Accepted only on exact binding |
| MC-PAY-02 | Contract | Locale, IP, user language, Tenant or Workspace suggests a different country | Ignored; canonical property country wins |
| MC-PAY-03 | Contract | Missing, multiple, inactive or unsigned assignment/profile | Bounded jurisdiction denial; zero writes |
| MC-PAY-04 | Contract | Address, assignment and profile country mismatch | Bounded jurisdiction denial; no foreign metadata |
| MC-PAY-05 | Artifact | All required domain versions/hashes active at effective instant | Exact immutable binding returned |
| MC-PAY-06 | Artifact | Missing, expired, superseded, wrong-contract or hash-mismatched domain | Bounded domain denial; zero writes |
| MC-PAY-07 | Artifact | Selector metadata supplied without typed artifact body | Denied; hash is never treated as payload |
| MC-PAY-08 | Currency | Currency/exponent/rounding increment supported | Exact minor-unit calculation; binding persisted |
| MC-PAY-09 | Currency | Zero-, two- and three-exponent fixtures | No hard-coded `toFixed(2)` or scale loss |
| MC-PAY-10 | Currency | Client currency differs from artifact | Denied before idempotency completion or intent write |
| MC-PAY-11 | Rounding | Tie, negative adjustment, tax and allocation remainder cases | Artifact rule applied deterministically; balanced totals |
| MC-PAY-12 | Rail | Exact active rail/method/adapter/configuration intersection | One server-selected adapter |
| MC-PAY-13 | Rail | Client requests a provider or rail not in artifact | Denied; client does not influence adapter choice |
| MC-PAY-14 | Rail | IBAN/EPC requested for a non-IBAN/non-EPC pack | Denied; no instruction or QR emitted |
| MC-PAY-15 | Rail | Missing/expired/disabled adapter or merchant configuration | Configuration denial; zero writes |
| MC-PAY-16 | Rail | Null-property/global beneficiary exists | Not used as profile-aware fallback |
| MC-PAY-17 | Secrets | Country Pack contains merchant ID, secret or credential material | Contract rejected |
| MC-PAY-18 | Secrets | Exact deployment credential unavailable | Denied without revealing presence or identifier |
| MC-PAY-19 | Invoice | Required invoice/receipt artifact evidence present | Receipt pins exact rule/hash |
| MC-PAY-20 | Invoice | Missing evidence, tax snapshot or mandatory receipt form | Regulatory denial; zero writes |
| MC-PAY-21 | Settlement | Settlement currency/timing/rounding matches artifact and adapter | Bound settlement result |
| MC-PAY-22 | Settlement | Provider settlement conflicts with original intent artifact | Denied or review result; no silent conversion |
| MC-PAY-23 | Refund | Refund allowed on original rail under pinned rules | Exact refund binding; original intent unchanged |
| MC-PAY-24 | Refund | Changed property profile would now choose another rail | Original pinned rail/rules retained; no rewrite |
| MC-PAY-25 | Allocation | Policy, currency, exponent and property/profile compatible | Balanced allocation with exact remainder rule |
| MC-PAY-26 | Allocation | Tenant-global policy conflicts with country artifact | Denied; global policy does not override artifact |
| MC-PAY-27 | Idempotency | Same key and identical full normalized command | Exact receipt replay; no additional writes |
| MC-PAY-28 | Idempotency | Same key with changed invoice, method, artifact, rail or configuration | Replay conflict; zero writes |
| MC-PAY-29 | Authority | Permission/entitlement revoked before replay | Denied after current-authority recheck |
| MC-PAY-30 | Concurrency | Two identical concurrent commands | One commit and one exact replay; one effect set |
| MC-PAY-31 | Concurrency | Artifact/profile suspended while selector holds locks | Serialize or `40001`; fresh attempt rechecks current state |
| MC-PAY-32 | Failure | Provider fails before commit | Full rollback of intent, ledger, audit, outbox and idempotency completion |
| MC-PAY-33 | Failure | Real serialization abort | Core retries in fresh transaction with fresh authority/artifact checks |
| MC-PAY-34 | Failure | COMMIT acknowledgement lost | `READBACK_REQUIRED`; no speculative provider call or duplicate effect |
| MC-PAY-35 | History | New profile/domain version becomes active | Existing intent/receipt bytes unchanged; new command may select new version |
| MC-PAY-36 | History | Attempted property-country reassignment | Core rejects; no payment history rewrite |
| MC-PAY-37 | Privacy | Cross-Workspace/property/merchant probe | Same bounded denial; no alternate configuration disclosure |
| MC-PAY-38 | Role | Runtime tries `service_role`, owner or generic admin fallback | Rejected before payment query |
| MC-PAY-39 | HTTP | Missing idempotency key on mutating command | Rejected; server does not synthesize a retry-unsafe timestamp key |
| MC-PAY-40 | End-to-end | Exact authorized property, accepted artifacts, adapter and configuration | DB/API/browser/concurrency evidence required before runtime acceptance |

## Explicit non-acceptance

No test was run because this PR changes documentation only. The review used
source inspection and contract mapping; it does not change an executable
dependency or fixture. Existing application behavior, including its RON/EUR,
IBAN/EPC, fixed-scale, global-policy and admin-webhook boundaries, remains
unchanged.

This package does not authorize a migration, adapter, route, credential,
grant, payment transaction, Remote database operation, runtime activation or
merge. It does not claim Country Pack legal acceptance, provider connectivity,
financial acceptance, or SERVICE runtime acceptance.
