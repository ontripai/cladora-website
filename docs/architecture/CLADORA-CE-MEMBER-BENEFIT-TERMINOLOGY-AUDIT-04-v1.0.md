# CE member benefit terminology audit 04

Status: **static policy and public-copy correction candidate**

Canonical basis:
`CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md`
at merge commit `360df4b2a154bf188c2ad3ea5c673be64738c3e9`

Live audit baseline: `main@83a18a583fb30b8177246a60e3505e3aac634215`

Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**

CE ownership remains limited to placement, presentation, experience
orchestration and purpose-limited references to owner-issued decisions. This
package does not create a benefit definition, entitlement provider, member
allowance, redemption receipt, funding decision, ledger, route or activation.

## Audit method and inventory

The baseline scan covers all text occurrences under `src`, `docs` and `scripts`
for the English concepts `free`, `complimentary`, `included`, `sponsored`,
`benefit`, `allowance`, `zero-price`, `discount` and `promotion`, together with
their relevant Romanian and Persian forms. It includes public CE/Experience
paths, SERVICE handoff surfaces, locale dictionaries, Guides/articles,
metadata-fed source, CTA/badge/state copy, receipt/redemption contracts,
fixtures and static claims tests.

The complete path, baseline line, column, matched term, classification,
rationale and correction status for all **532** matches are stored in:

`docs/architecture/references/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-INVENTORY.json`

| Classification | Count | Meaning |
| --- | ---: | --- |
| `accepted` | 211 | Correct canonical wording, an explicit prohibition/example, a tax qualifier, or ordinary non-benefit grammar. |
| `ambiguous` | 157 | Historical/pre-owner-decision terminology or a boundary that needs an owner-led contract before public use. |
| `incorrect` | 17 | Unsupported public no-cost/free wording present on the baseline and corrected by this package. Multiple terms on one source line count separately. |
| `internal_only` | 147 | Test, schema, field name, technical adjective or non-member-facing architecture/operations text. |

The inventory is a snapshot of the live main baseline, with the canonical merge
recorded separately. The regression harness checks the corrected tree, so the
removed incorrect terms are retained in the inventory as review evidence
rather than silently disappearing.

### Public findings and corrections

| Baseline path and line | Classification | Finding | Correction |
| --- | --- | --- | --- |
| `src/components/home/PilotProgramSection.tsx:18-26` | `incorrect` | Migration was called free and parallel reconciliation claimed no additional cost/zero financial risk without a funding or commercial decision. | Describes assisted migration and the pilot reconciliation period without a price or risk claim in RO/EN/FA. |
| `src/components/home/PricingPreviewSection.tsx:29-32` | `incorrect` | RO/FA called migration free while EN described plan inclusion, creating both unsupported funding semantics and language drift. | All languages say pilot plans support assisted migration and parallel reconciliation. |
| `src/components/home/FinalCtaSection.tsx:32-36` | `incorrect` / `ambiguous` | RO called the demo free and EN used “zero-login”; FA already described access without login. | All variants describe the interactive demo and test data/access mode without a price claim. |
| `src/components/home/InteractiveProductPreview.tsx:254` | `incorrect` | The badge called the sandbox free in all three languages. | The badge is “Interactive Sandbox” / “Sandbox Interactiv” / “محیط سندباکس تعاملی”. |
| `src/components/auth/LoginForm.tsx:287-290` | `incorrect` | Login CTA called the demo free in RO/EN/FA. | CTA now says only “Launch Interactive Demo” and direct translations. |
| `src/data/guides/cluster-b-operations.ts:455` | `incorrect` | A public Guide described warranty repairs as free. | The Guide says the repairs would have been covered by warranty. |

These changes remove unsupported claims only. They do not assert that the pilot,
demo, migration or repair has a zero price, is included with membership, or is
funded by any particular source.

### Accepted and internal occurrence groups

The following repeated groups are intentionally unchanged and every individual
match is enumerated in the JSON inventory:

| Paths/lines | Classification | Reason |
| --- | --- | --- |
| `src/components/customer/CustomerServiceCatalog.tsx:17-19`, `src/lib/customer/service-catalog-management-copy.ts:2-4`, `src/components/customer/CustomerServiceManagement.tsx:140,157`, `src/lib/customer/service-catalog-schema.ts:20,25` | `accepted` / `internal_only` | “Tax included” and the `tax_display=included` enum describe tax presentation for an independent SERVICE Offering. They never claim a CE benefit. |
| `src/app/[lang]/service/page.tsx:64-65` | `accepted` | The current SERVICE page says an included CE experience keeps independent funding, entitlement, redemption and receipt, and requires a new SERVICE identity, price, terms and consent after allowance exhaustion. |
| `src/dictionaries/{ro,en,fa}.ts:257-261,285` | `internal_only` | `included` is an internal product-domain selection flag and `benefits` is the pilot-copy array key; neither is rendered as member benefit status. |
| `src/components/platform/OperationalContractsPanel.tsx:38-42`, `src/app/[lang]/platform/(control-plane)/contracts/page.tsx:23,31` | `accepted` | Persian “سهمیه” refers to platform contract entitlements/limits, not a member allowance or redemption balance. |
| `src/dictionaries/en.ts:137`, `src/dictionaries/ro.ts:164,265`, `src/app/[lang]/pricing/page.tsx:80`, remaining Persian `شامل` occurrences | `accepted` | Ordinary grammar such as “benefits from”, “includes”, a reduction, or a descriptive list does not express funding coverage. |
| `src/lib/module-registry/taxonomy.ts:95` | `accepted` | “Reședință cu servicii incluse” is the Romanian property-type label for a serviced residence, not an entitlement or funding decision. |
| `src/app/[lang]/platform/(control-plane)/retention-operations/page.tsx:23`, `src/lib/community/experience-guide-lifecycle-http-v1.ts:336` | `internal_only` | “side-effect-free” and “write-free” are technical transaction properties. |
| Canonical funding document, all matched lines | `accepted` | Normative definitions, approved phrases, examples and explicit prohibitions. |
| Test scripts and implementation identifiers | `internal_only` | Not member-facing wording; retained only where the term has a precise technical meaning. |

### Ambiguous dependency groups

| Paths/lines | Dependency |
| --- | --- |
| CE-011 “free Event” contracts/status: `CLADORA-CE-011-EVENT-INTEREST-v0.1.md:1,5`, `CLADORA-CE-011-CORE-CONTRACTS-C01-C03-v1.0.md:11`, DW-01A v1.0/v1.1 `:140,200`, CE Phase-0 `:10`, CE status `:10`, execution plan `:226` | “Free” currently means the Event path has no payment, capacity or SERVICE command. It is internal domain shorthand, not funding proof. A future CE-011 terminology-only owner package should prefer “non-commercial Event path” or “Event with no payment path”; runtime behavior is unchanged here. |
| `CLADORA-RESIDENTIAL-LIVING-SERVICES-v1.0.md:17,127,148-149`, `CLADORA-MASTER-SYSTEM-DEFINITION-v1.0.md:62,203`, Workspace SERVICE FA documents and ADR-CLD-052 benefit passages | Benefits, discount and included-service concepts predate the current ownership decision. They remain internal discovery material and cannot be used as runtime authority or public eligibility/funding copy until `OPEN_PRODUCT_DECISION` is resolved. |
| `src/config/locales.ts:6-42` | The shared presentation config carries legacy region/currency display defaults. No CE benefit or SERVICE handoff consumer reads those fields. The harness prevents their use as funding, entitlement, country, currency, tax or accounting evidence. Removing/refactoring shared display defaults belongs to a separate Core/i18n package. |
| Benefit/redemption UI and receipts | No active public member-benefit projection, redemption receipt or allowance state was found. Any future surface remains fail-closed until owner-issued current decisions and the open ownership dependency are resolved. |

## Canonical terminology policy

The three languages express the same decision. Translation changes only the
presentation and never changes benefit identity, funding, entitlement,
Workspace, country, currency, tax or accounting treatment.

| Concept | English | Romanian | Persian | Rule |
| --- | --- | --- | --- | --- |
| `free` | free | gratuit / gratuită | رایگان / مجانی | Forbidden by default. A real use needs exact provenance and a current owner-issued funding classification; amount zero is insufficient. |
| `complimentary` | complimentary | oferit fără taxă per utilizare | بدون هزینهٔ هر بار استفاده | Not a synonym for amount zero. Use only when the owner-issued decision proves no member per-use charge and the approved public policy chooses this wording. |
| membership inclusion | Included with membership | Inclus în abonamentul de membru | مشمول عضویت شما | Requires current funding coverage and membership/program eligibility for the exact benefit revision. |
| Workspace inclusion | Included in your Workspace benefits | Inclus în beneficiile Workspace-ului tău | مشمول مزایای فضای کاری شما | Requires a current local Workspace decision; exposes no tier or funding details. |
| occupancy inclusion | Included with your occupancy benefits | Inclus în beneficiile aferente ocupării tale | مشمول مزایای سکونت شما | Requires a current canonical relationship decision; rent and agreement composition remain private. |
| sponsorship | Sponsored by `[approved public label]` | Sponsorizat de `[etichetă publică aprobată]` | با حمایت `[برچسب عمومی تأییدشده]` | Only the approved public label is shown. Contract, amount, budget and private conditions stay hidden. |
| limited promotion | Included as a limited-time benefit | Inclus ca beneficiu pe perioadă limitată | مشمول به‌عنوان مزیت مدت‌دار | Requires current promotional funding, eligibility and a safe expiry. Promotion does not bypass quota or capacity. |
| benefit | benefit | beneficiu | مزیت | A candidate owner-defined item. CE presents/orchestrates it and does not own its definition. |
| allowance | allowance available/used/unavailable | alocație disponibilă/utilizată/indisponibilă | سهمیهٔ قابل‌استفاده/مصرف‌شده/ناموجود | Display only from the current owner-issued bounded decision. Never expose private tier, reason or group budget. |
| zero price | price is 0 | prețul este 0 | مبلغ صفر است | A numeric SERVICE fact only; it proves neither funding coverage nor benefit eligibility. |
| discount | discount | reducere | تخفیف | A commercial term owned by the Offering/commerce owner; it is not an included benefit or allowance. |
| promotion | promotion | promoție | پیشنهاد ترویجی | A campaign context only. Current funding and eligibility are still required for included wording. |

## SERVICE and CE handoff

SERVICE retains independent Offering, Request, Quote, Order, terms, consent,
price, cancellation and acceptance. A SERVICE amount of zero, missing price,
waived invoice or discount cannot produce an included-benefit label.

CE may present a separately published SERVICE Offering only after an allowance
is reported unavailable. The member must explicitly enter the separate SERVICE
flow. CE cannot create an Order, authorize a charge or carry benefit consent
into SERVICE. SERVICE cannot relabel its Offering as a CE benefit without the
future owner-issued funding and eligibility decisions.

## Privacy and sponsor boundary

Public benefit presentation may expose only approved labels, bounded current
outcomes and safe expiry/remaining allowance when the future owner contract
permits it. It must not expose internal tier names, membership IDs, eligibility
reasons, rent or service-charge composition, budget balance, sponsor contract
or amount, accounting code, other participants or another Workspace.

Denied, unknown, stale, expired, revoked or unavailable decisions produce no
positive claim. Missing provenance is fail-closed and creates no automatic
SERVICE Order, charge, receipt or redemption.

## Static regression

`scripts/test-ce-member-benefit-terminology-audit-v1.mjs` enforces:

- no public `free`/`gratuit`/`رایگان`/`مجانی`/`complimentary` claim in `src`;
- only allowlisted technical “write-free” and “side-effect-free” uses remain;
- exact RO/EN/FA replacement parity for the corrected public surfaces;
- no amount/price/zero/missing value mapping to free, complimentary or included;
- no SERVICE presentation mapping to a member benefit or allowance;
- no locale/language mapping to funding, entitlement, country, currency, tax or
  accounting in CE benefit/SERVICE handoff paths;
- no private funding, tier, membership or sponsor fields in CE public
  presentation;
- canonical open ownership, CE scope, SERVICE handoff and sponsor privacy;
- inventory completeness and all four required classifications;
- Persian `rtl` direction through the shared localized layout.

## Future acceptance matrix

| Scenario | Required result |
| --- | --- |
| `amount=0`, absent price, waived invoice or discount | No free/included/complimentary wording; SERVICE fact remains independent. |
| Current coverage plus eligible member | Only the owner-approved RO/EN/FA phrase for the exact current decision is shown. |
| Stale, revoked, missing or ambiguous decision | Fail closed; no positive badge, receipt, allowance mutation or SERVICE Order. |
| Exhausted allowance | Show bounded unavailable wording and, when present, an explicit link to a separate SERVICE Offering. No automatic purchase. |
| Sponsor-funded benefit | Show only the approved public sponsor label; withhold contract, amount, budget and conditions. |
| Locale switch RO/EN/FA | Change wording and direction only; retain identical owner decision, funding classification, country, currency, tax and accounting facts. |
| Persian presentation | Use `rtl`; preserve identifiers/numbers with their explicit direction and do not reveal private eligibility facts. |
| Future receipt/redemption copy | Consume owner-issued candidate contracts only after ownership acceptance; CE creates no parallel ledger or receipt. |

Runtime benefit providers, entitlement evaluation, allowance persistence,
redemption, payment, Remote DB state and Production activation remain
**NOT_IMPLEMENTED / NOT_RUN_NOT_PASS**.
