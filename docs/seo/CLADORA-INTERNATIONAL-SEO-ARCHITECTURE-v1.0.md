# CLADORA — International SEO Architecture & Policy
## Document Version: 1.0 (WP-15B Foundation)
## Scope: Multi-Language & Multi-Jurisdiction Strategy
## Governance Status: Approved for Implementation

---

## 1. Executive Summary: Decoupling Three Distinct Dimensions

In real estate technology and physical asset operations, one of the most critical structural flaws of legacy platforms is the conflation of **language (locale)** with **content applicability** and **property / runtime jurisdiction**:
- An English-speaking user is not necessarily operating an asset in the United States or the United Kingdom. They may be an international family office managing properties across Central Europe, a cross-border asset manager in Dubai, or a foreign investor holding residential units in Romania.
- A Persian-speaking user is not necessarily operating an asset in Iran. They may be a diaspora investor in the UAE, Turkey, Germany, or Canada, managing cross-border commercial or residential portfolios, or seeking international standards for building operations.
- Conversely, a physical building situated in a specific country (e.g., Romania) operates strictly under that territory's statutory regulations (e.g., Legea nr. 196/2018, ISCIR, HG 273/1994), regardless of whether the owner or tenant speaks English, Romanian, or Persian.

### The Three Independent Dimensions:

$$\text{Presentation Locale} \neq \text{Editorial Content Applicability} \neq \text{Property / Runtime Jurisdiction}$$

1. **Presentation Locale (`/ro/`, `/en/`, `/fa/`)**: Governs typography, linguistic communication, interface semantics, reading direction (LTR / RTL), and editorial presentation language.
2. **Editorial Content Applicability (`contentApplicability`)**: Closed, discriminated editorial scope tagged on each published article (`{ kind: 'global' }`, `{ kind: 'cross_border' }`, or `{ kind: 'country', countryCode: 'RO' }`). This model represents **solely editorial scope** and must never be construed as property jurisdiction, Country Pack authority, or runtime entitlement.
3. **Property / Runtime Jurisdiction**: Governs the physical asset's statutory compliance, tax rules, and legal obligations in runtime. In production, Country Pack runtime is `NOT_ACTIVE` and remote activation is `NOT_RUN_NOT_PASS`.

---

## 2. Editorial Content Applicability & Presentation Locales

### 2.1. Presentation Locales
Presentation locales define typography, text direction, and linguistic tone:
- **`ro` (Romanian)**: Domestic Romanian presentation, LTR, formal property operations terminology.
- **`en` (English)**: International lingua franca presentation, LTR, global proptech and asset architecture terminology.
- **`fa` (Persian)**: Regional & diaspora Persian presentation, RTL, international operations terminology.

### 2.2. Strict Locale Independence (`locale` never infers `countryCode` or `jurisdiction`)
- `ro` does **not** automatically generate `RO`.
- `fa` does **not** generate `IR`.
- `en` does **not** generate `US`, `UK`, or any default country.
- Language is strictly presentation, direction, and editorial language.

### 2.3. Editorial Content Applicability Contract
Every published guide article must declare an explicit, closed `contentApplicability` metadata record:
```typescript
export type GuideCountryCode = 'RO';

export type GuideContentApplicability =
  | { kind: 'global' }
  | { kind: 'cross_border' }
  | { kind: 'country'; countryCode: GuideCountryCode };
```

- **Romanian Cluster Articles (11 articles)**: Independently registered with editorial scope `{ kind: 'country', countryCode: 'RO' }`. Aceste articole sunt înregistrate independent cu domeniul de aplicabilitate editorial `RO`; `locale=ro` NU este originea acestui domeniu. (این مقاله‌ها مستقلاً با scope تحریریه RO ثبت شده‌اند؛ locale=ro منشأ این scope نیست).
- **English Platform Articles (`TOPIC-01`, `TOPIC-03`)**: Independently registered with editorial scope `{ kind: 'global' }`. Pure category architecture and data governance, country-agnostic.
- **Persian Platform Article (`TOPIC-05`)**: Independently registered with editorial scope `{ kind: 'global' }`. Focuses on building DNA, workspace boundaries, and data truth without assuming Iran as property jurisdiction.
- **Editorial `targetAudience`**: Retained purely as editorial reader-persona metadata; it possesses zero runtime authority and creates no legal jurisdiction.

---

## 3. Inactive Country Pack Truth & Editorial Compliance Policy

### 3.1. Current Runtime Reality
- **Country Pack Runtime**: `NOT_ACTIVE`
- **Remote Installation / Activation**: `NOT_RUN_NOT_PASS`
- **Scope of PR**: This PR establishes solely the SEO contract and editorial applicability metadata. No runtime wiring, database migrations, Country Pack activation, or automatic statutory enforcement is introduced.
- **Independent Verification Requirement**: All country-specific operational or statutory considerations must be verified independently against current official legislative sources and evaluated by a qualified professional.

### 3.2. Editorial Policy for Country-Scoped Content
To ensure complete accuracy and prevent misleading claims:
1. **Official Sources Required**: Any article with `{ kind: 'country', countryCode: 'RO' }` must provide verified citations from official legislative portals (e.g., `legislatie.just.ro`).
2. **Prominent Disclaimers**: Country-scoped guides must include visible disclaimers confirming that the material is informative and operational, not a substitute for professional legal or accounting advisory.
3. **No Active Pack or Compliance Claims**: Global and cross-border articles must explicitly disclaim active Country Packs and production compliance. Under no circumstances may marketing copy or educational articles claim that a Country Pack is active in runtime or that production legal compliance is automatically enforced.

---

## 4. Technical SEO Architecture: Canonicalization, Hreflang & Sitemap

### 4.1. Single-Language Market-Fit Canonicalization
For editorial and resource guides that address jurisdiction-specific or localized themes:
- Each guide possesses a **self-referencing canonical URL**:
  ```html
  <link rel="canonical" href="https://cladora.ro/{lang}/resources/guides/{slug}" />
  ```
- **Zero Fake Alternate Hreflang Tags**: If a guide exists only in Romanian (e.g., `program-calcul-intretinere-bloc`) or only in English (e.g., `what-is-property-operating-platform`), it must NOT output fake alternate `hreflang` tags pointing to non-existent translations or unrelated pages in other languages. This avoids severe crawl waste and indexing penalties.

### 4.2. Core Platform Pages (True Tri-Lingual Hreflang)
For the 32 core platform pages that exist symmetrically in all three languages (`/`, `/platform`, `/solutions/*`, `/pricing`, `/trust`, `/contact`, etc.):
- Symmetrical bidirectional `hreflang` annotations are emitted:
  - `hreflang="ro"` -> `https://cladora.ro/ro/...`
  - `hreflang="en"` -> `https://cladora.ro/en/...`
  - `hreflang="fa"` -> `https://cladora.ro/fa/...`
  - `hreflang="x-default"` -> `https://cladora.ro/ro/...`

### 4.3. Sitemap Integrity
The dynamic sitemap generator (`src/app/sitemap.ts`) maps exactly the verified public routes:
- 32 core public routes × 3 languages = 96 URLs
- Author transparency pages × 3 languages = 3 URLs
- Verified dynamic canonical guide articles = 14 URLs (11 RO + 2 EN + 1 FA)
- **Total Sitemap Count:** Exactly **113 unique URLs**.

---

## 5. Editorial Tone, Authorship & Claim Safety

1. **Authorship Transparency**:
   - `authorName`: `CLADORA Research & Architecture` (EN) / `Echipa de Cercetare & Arhitectură CLADORA` (RO) / `گروه پژوهش و معماری سیستم‌های کلادورا` (FA).
   - Author profile URL points directly to `/resources/autori/cladora-research`.
2. **Review Transparency**:
   - `reviewedBy`: `CLADORA Editorial & Research Team` (EN) / `Echipa Editorială & de Cercetare CLADORA` (RO) / `شورای پژوهش و ویرایش کلادورا` (FA).
   - Visible on the article page alongside the author byline.
3. **Structured Data Guard**:
   - Valid Schema.org `Article` / `TechArticle`.
   - Never inject unrecognized properties (such as `reviewedBy` on Article) into JSON-LD.
4. **Machine Translation Prohibition**:
   - Every international guide must undergo language and domain terminology review, respecting professional terminology in facility management and real estate operations without claiming unproven native expertise or legal qualifications.
