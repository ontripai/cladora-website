# CE locale and jurisdiction separation 02

Status: **static contract ready; no executable inference found**

Owner: Community & Experience, with canonical jurisdiction ownership retained by Core

Baseline: `main@f31574555cf122487c5f184cb91d5f7a4666c293`
(`tree b28f91c4d02872508a2c8611ee02d302008f7029`)

This package records a static boundary. It does not define a Country Pack,
legal or accounting rule, professional advice, migration, runtime wiring,
route, editor capability or activation.

## Contract

1. Locale and language are presentation inputs only. They may select translated
   UI copy, an audience label and text direction. They never select, infer or
   change a country, Country Pack, jurisdiction profile/domain, legal review or
   accounting review.
2. A translation cannot select or change a governing country, jurisdiction
   profile, profile version, domain artifact or approval. It cannot create a
   new profile/domain/artifact hash or a legal/accounting signoff. Any future
   translation hash describes translated content only.
3. Mappings such as `ro -> RO`, `fa -> IR` and `en -> default country` are
   forbidden. Language tags are not jurisdiction evidence, including when a
   region subtag is present.
4. Timezone, currency, IP address, geolocation and browser or proxy headers are
   also forbidden jurisdiction inference inputs. They cannot repair missing or
   ambiguous canonical evidence.
5. Governing country remains explicit, property-scoped canonical Core data. A
   Workspace or actor can operate across properties in several countries, so
   neither Workspace identity nor actor preferences provide a country default.
6. Country Pack artifacts and their legal/accounting review records are
   evidence owned by Core/Country Pack governance. They are never CE command
   authority and never approve Guide prose or a translation.
7. Jurisdiction-specific Guide publication remains fail-closed until a future
   owner-approved Guide content domain and exact property/profile binding exist.
   CE must not invent that domain or project another domain into Guide content.
8. Unpublish remains independent of current Country Pack availability. Removing
   Guide visibility requires current CE lifecycle authority and exact Guide
   version, but does not require current target or jurisdiction disclosure.
9. Guide visibility never grants access to a Country Pack, property, document,
   message, service or any referenced destination.
10. `commands=null` and `can_edit=false` remain the public runtime boundary.

## Findings

No executable locale-to-jurisdiction inference was found in the live CE Guide
paths. Consequently this package changes no runtime implementation.

| Path | Observed behavior | Finding |
| --- | --- | --- |
| `experience-guide-client.ts` | `lang` selects one RO/EN/FA audience label. The strict response and view contain no country/profile/domain/artifact/signoff fields. | Presentation only; editing is forced false. |
| `CustomerExperienceGuide.tsx` | `lang` selects copy and `rtl`/`ltr` direction. | Presentation only. |
| `CustomerExperienceGuidePage.tsx` | `lang` selects copy and direction; the component receives `commands={null}`. | Presentation only; no command activation. |
| Guide read route | Accepts explicit Context and Workspace IDs and optional Guide reference. It does not read locale, language, timezone, currency, IP, geolocation or browser-language headers. | No inferred jurisdiction input. |
| Guide command, adapter, bridge and lifecycle provider | Bind explicit Guide/Workspace/version/current authority. They have no locale, language or Country Pack input. | No locale-country mapping or fallback. |
| CE lifecycle provider | Documents reference validation occurs only for publish and exact publish replay. Unpublish transitions published to draft without target selection. | Unpublish remains target- and Country-Pack-independent. |
| Core jurisdiction artifact | Country source is `explicit_address_country`; currency, IP, language, locale, phone and timezone are explicitly forbidden inference sources. | Canonical fail-closed boundary. |
| Core domain inventory | Address structure, finance/tax-accounting, documents retention and payments policy are explicit domains. | No owner-approved Guide content domain exists; CE cannot fabricate one. |

The use of `localeCompare` in deterministic key sorting is not locale or country
selection. It only orders already-bound property names before hashing and does
not read a user locale.

## Static regression contract

`scripts/test-ce-locale-jurisdiction-separation-v1.mjs` scans every executable
CE Guide path and fails when it detects:

- browser-language, proxy-country, IP/geolocation, timezone or currency inputs;
- locale/language-to-country/profile/domain/Country-Pack helpers or RO/FA/EN
  country mappings;
- jurisdiction, profile, domain, artifact or signoff fields in the localized
  Guide presentation path;
- activation drift from `commands={null}` or `can_edit=false`;
- reference validation outside publish, or a Country Pack dependency in the
  unpublish provider;
- removal of Core's explicit-country source, forbidden-inference tuple,
  non-authority marker or canonical domain inventory;
- invention of a Guide content domain in the Core artifact.

The harness is deliberately standalone and is not registered in `package.json`
or a workflow. This package changes exactly this document and that harness.

## Future acceptance matrix

| Boundary | Future scenario | Required result |
| --- | --- | --- |
| Locale switching | Same Guide/property/profile viewed in RO, EN and FA | Only translated presentation and direction change; identity, scope and evidence do not. |
| Forbidden mappings | Attempts to map RO to Romania, FA to Iran or EN to a default country | Static/contract failure; no fallback country. |
| Regional hints | Locale region, timezone, currency, IP, browser/proxy headers disagree with canonical property country | Hints ignored for jurisdiction; canonical evidence remains exact. |
| Translation update | Translation text or translation hash changes | No profile/domain/artifact hash or legal/accounting review is created or changed. |
| Multi-country Workspace | One actor manages properties in different countries | Each jurisdiction operation uses its exact property binding; no Workspace/actor default. |
| Missing/ambiguous evidence | Guide has no current exact owner-approved Country Pack content binding | Publication/read eligibility fails closed with zero writes. |
| Unpublish after loss | Country Pack, target access or content evidence becomes unavailable after publish | Authorized exact-version unpublish still removes visibility without target disclosure. |
| Public boundary | Mounted RO/EN/FA Guide path before a separate activation package | `commands=null`, `can_edit=false`, no editor or command route exposure. |

Remote database installation, Production runtime behavior, HTTP/AAL2 acceptance,
Country Pack validity and legal/accounting correctness are outside this static
package and remain **NOT_RUN_NOT_PASS**.
