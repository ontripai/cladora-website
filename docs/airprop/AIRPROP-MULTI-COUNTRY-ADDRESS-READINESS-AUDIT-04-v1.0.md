# AIRPROP multi-country address readiness audit 04

Status: `NOT_READY_FOR_RUNTIME_RESOLUTION`.

Baseline: `f31574555cf122487c5f184cb91d5f7a4666c293`.

This is a documentation and static-evidence package. It changes no guard, migration, runtime, grant, route, Country Pack, or activation state.

## Exact external dependency

Runtime resolution depends on Core PR #431:

- Base: `f31574555cf122487c5f184cb91d5f7a4666c293`;
- Head: `b7dece9358b8e1a0c761a9cbf7b018c342398f78`;
- Tree: `1e72a58270dd1fad5bee29b5cc61e7ecaf0bc98f`;
- Status at audit: Draft, not merged;
- Consumer dependency: current `address.structure` artifact resolution bound to an accepted property jurisdiction selection and the same Core transaction context.

No #431 content hash is registered or asserted by this package. A later task must pin the accepted final bytes before any guard or runtime change.

## Inspected address paths

| Path | Current behavior | Readiness |
| --- | --- | --- |
| `portfolio.addresses` | Historical schema created `country_code` with a Romania default; `20261015183000_core_jurisdiction_profile_v1.sql` drops that default and enforces explicit uppercase alpha-2 input | PASS for new effective-schema writes |
| Address postal text | `postal_code` is optional text; there is no unique index, table uniqueness, or platform-wide SQL pattern | PASS |
| `portfolio.properties.address_id` | Property points to the canonical address; a jurisdiction-bound property cannot switch to an address from another country | PASS fail-closed; no AIRPROP mutation path |
| Workspace/property binding | Binding identity is immutable and effective-dated; moving a property requires another forward-only binding row rather than rewriting history | PASS storage invariant; no AIRPROP move command |
| Property jurisdiction assignment | `assignment_version` is positive and unique per property; identity/country/profile are immutable after insertion | PASS storage invariant |
| Building | Address is inherited through `building.property_id -> property.address_id`; the building has no independent country or address | BLOCKED for runtime move acceptance: no reviewed AIRPROP versioned building-move contract |
| Unit | Address is inherited through `unit.building_id -> building.property_id`; the unit has no independent country or address | BLOCKED for runtime move acceptance; B2 remains fail-closed for every unit-linked output |
| Artifact B2 management read | Projection contains property ID/label and action links, but no address or `country_code` | BLOCKER: explicit country cannot yet be preserved in the read output |
| Artifact B2 HTTP gateway | Any non-null unit link returns unavailable with no view | PASS as a pre-activation safety boundary |
| AIRPROP opportunity v2 | Stores a commercial opportunity country/city snapshot and is hard-coded to `RO`; it does not create or resolve a canonical portfolio address | LEGACY ROMANIA-ONLY; not a multi-country address path |
| Valuation contract | Accepts an explicit country in a versioned resource input but has no active canonical address/Country Pack resolver integration | CONTRACT-ONLY; not address authority |
| Commercial lifecycle commands | Carry property/unit identifiers and commercial terms; they do not read or mutate canonical address fields | OUTSIDE address mutation scope |
| Building setup | Provisions building/unit structure without a canonical address contract | BLOCKED for multi-country address creation acceptance |

## Required invariants

### Explicit address country

Every new canonical address must receive `country_code` explicitly. The effective schema has no default. A caller cannot omit country and obtain Romania or a Workspace-derived value. Historical migration text containing `default 'RO'` remains immutable history and is neutralized by the later `DROP DEFAULT`; it is not evidence of current readiness by itself.

Country must not be derived from UI locale, language, display or base currency, telephone prefix, timezone, IP/geolocation, tenant, or Workspace taxonomy/default. Core's address artifact already identifies `currency`, `ip_address`, `language`, `locale`, `phone_number`, and `timezone` as forbidden inference sources. AIRPROP must pass an explicit canonical address country into future resolution.

The current opportunity form's `country_code: 'RO'` is a fixed legacy product restriction rather than locale inference. It is still unsuitable for multi-country address creation and must not be reused as canonical property country evidence.

### Postal code

`postal_code` is country-owned text. It is not a global identifier and may repeat across addresses, tenants, properties, or countries. Core must not add a global unique constraint or one universal regex, length, case, or numeric-only rule. An accepted Country Pack may apply its own bounded `address.structure` grammar after the explicit country/profile binding is resolved; postal text must never select the country or Country Pack.

### Moves and country changes

A property cannot be moved between Workspaces by rewriting an existing binding. The old binding must close and a new effective-dated assignment must be created. A jurisdiction-bound address country or property address cannot be changed to a different country in place. The current schema blocks that change and also forbids country rebinding once historical jurisdiction assignments exist.

There is no reviewed AIRPROP command that atomically coordinates a cross-country property move, a new canonical address, a new Workspace binding, and a new jurisdiction assignment/version. There is also no AIRPROP versioned building/unit move contract tied to address/jurisdiction evidence. Those are activation blockers; this audit does not design or implement them.

### Read projection and Country Pack truth

The current B2 management projection omits the canonical address and country. Omission avoids fabricating Country Pack data, but it does not satisfy country preservation. A future projection must carry the exact stored address country and must not derive it from the property currency, UI locale, Workspace, actor, or request metadata.

Country Pack fields may appear only from an accepted current #431 resolution for `address.structure`, exact-matched to the property jurisdiction selection and explicit address country. The projection must distinguish:

- stored canonical address fields;
- immutable Core profile/artifact identity and version;
- optional reviewed presentation rules from the resolved artifact.

It must not invent a country-specific postal label, required field, normalized value, profile version, or artifact hash. Absence, denial, stale assignment, hash mismatch, inactive artifact, or provider failure remains unavailable and is never replaced by a generic or Romania fallback. Core artifact output has `reusable_as_command_authority=false` and cannot authorize an AIRPROP write.

## Static acceptance matrix

| Case | Required result |
| --- | --- |
| New DE and RO addresses with the same postal text | Both accepted when each explicit country and its own applicable policy allow the text; no uniqueness collision |
| Postal values with different national shapes | No global rejection; only the exact resolved Country Pack may validate local syntax |
| Missing country | Rejected before address creation; no default or inference |
| Locale/currency/phone/timezone/IP/Workspace changes | Stored country and resolver target remain unchanged |
| Property Workspace move | Existing binding stays immutable; another effective-dated binding/assignment is required |
| Address country change on assigned property | In-place update denied; no silent profile or Country Pack switch |
| Building/unit moved to another property | No stale address/country projection; remains unavailable until a reviewed versioned move contract and current-scope proof exist |
| B2 read before integration | Property-only projections remain valid; any claimed address/Country Pack output is rejected as unsupported |
| B2 read after future integration | Exact stored country is preserved; resolved artifact identity is current and exact; unknown/inactive resolution fails closed |
| Authorized empty | Remains distinct from resolver/provider unavailable and contains no invented country defaults |
| Read effect | Zero domain, audit, outbox, idempotency, assignment, address, property, building, and unit writes |

## Activation blockers and handoff

1. Core #431 must publish and receive acceptance for one exact final head/tree; its hashes are handled only in a later guard task.
2. AIRPROP needs a reviewed canonical address create/update contract with explicit country and no fallback.
3. AIRPROP needs reviewed versioned move semantics for property, building, and unit relationships before those changes can affect address/jurisdiction output.
4. The B2 read schema and SQL need a separately reviewed version that preserves the exact address country and consumes #431 without fabricating Country Pack data.
5. Synthetic and disposable Local evidence must cover the matrix above, including repeated postal text, cross-country portfolios, stale assignments, moves, actor/Workspace switches, unavailable versus authorized empty, and zero writes.

Until all five gates pass, AIRPROP guard and runtime remain unchanged, unit-linked output remains fail-closed, and Production activation is prohibited.
