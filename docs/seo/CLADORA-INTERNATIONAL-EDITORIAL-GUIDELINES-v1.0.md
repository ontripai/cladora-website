# CLADORA — International Editorial Framework & Content Plan Template
## Document Version: 1.0 (WP-15B Operational Standard)
## Target Scope: Multi-Language Editorial Governance (EN / FA / Global)
## Core Principle: Locale ≠ Jurisdiction & Zero Ungrounded Statutory Claims
## Governance Status: Approved for Implementation

---

## 1. Editorial Philosophy & Standards

CLADORA creates high-fidelity technical and architectural guides for property operations. For all non-domestic (international) content in English (`en`) and Persian (`fa`), authors and contributors must strictly adhere to the following principles:

1. **Universal Engineering & Systems Modeling**:
   - Focus on physical asset truth: equipment hierarchies, meter telemetries, work order lifecycles, and cryptographic or auditable event logging.
   - Do NOT extrapolate a single nation's municipal ordinance (e.g., California Civil Code, UK Landlord and Tenant Act, or Iranian apartment ownership rules) as universal building truth.
2. **Zero Machine Translation**:
   - Direct translation of Romanian legal articles into English or Persian without a localized statutory purpose is strictly prohibited.
   - Each international guide must undergo language and domain terminology review (e.g., verifying HVAC terminology, CMMS maintenance metrics, double-entry subledger principles) without claiming unproven native expertise or professional qualifications.
3. **Claim Safety & Architectural Framing**:
   - Software capabilities must be framed through design intent and architecture: use *"is designed to support"*, *"provides a structured data model for"*, *"enforces workspace scoping"*.
   - Never use present-tense absolutes claiming active, unsupervised regulatory compliance or automated court filings.

---

## 2. Standard Guide Schema Template (TypeScript Data Format)

When proposing a new international guide for `src/data/guides/`:

```typescript
import { GuideArticleData } from './types';

export const NEW_INTERNATIONAL_GUIDE: GuideArticleData = {
  id: 'TOPIC-XX',
  lang: 'en', // 'en' | 'fa'
  slug: 'canonical-kebab-cased-slug',
  contentApplicability: { kind: 'global' }, // { kind: 'global' } | { kind: 'cross_border' } | { kind: 'country', countryCode: 'RO' }
  targetAudience: 'International real estate portfolio directors and facility managers',
  title: 'Full Descriptive Title: Subtitle Clarifying Architectural Scope',
  seoTitle: 'Clean Target Title (~50-55 chars) for ~60-65 chars with Brand',
  description:
    'Precisely calibrated meta description strictly between 145 and 165 characters explaining the core takeaway without exaggeration or promotional filler.',
  category: 'Platform Architecture', // or 'Facility Operations', 'Asset Governance'
  clusterId: 'cluster-platform',
  primaryQuery: 'exact primary keyword query matching master intent map',
  supportingQueries: ['secondary query 1', 'secondary query 2', 'secondary query 3'],
  searchIntent: 'informational', // 'informational' | 'commercial'
  publicationDate: '2026-10-16',
  datePublished: '2026-10-16',
  dateModified: '2026-10-16',
  author: 'CLADORA Research & Architecture',
  authorName: 'CLADORA Research & Architecture',
  authorUrl: '/en/resources/autori/cladora-research',
  reviewedBy: 'CLADORA Editorial & Research Team',
  schemaType: 'TechArticle',
  readTime: '10 min read',
  pillarHref: '/en/platform',
  disclaimer:
    'Mandatory disclaimer: This architectural guide analyzes data models and operational workflows across international properties. It is jurisdiction-agnostic and does not substitute for local legal, statutory, or tax advisory. Requirements of the asset\'s location country must be verified independently with current sources and qualified professional review; this article does not announce an active Country Pack or production legal compliance.',
  directAnswer:
    'A concise, self-contained 2-3 sentence direct answer providing immediate value for featured snippet evaluation and executive clarity.',
  sections: [
    {
      id: 'section-anchor-slug',
      title: 'Section Heading',
      content: [
        'Paragraph 1 discussing operational principles...',
        'Paragraph 2 expanding on the data model...',
      ],
    },
  ],
  table: {
    caption: 'Comparative Table Caption',
    headers: ['Dimension', 'Legacy PMS Approach', 'Operating Platform Model'],
    rows: [
      ['Data Hierarchy', 'Tenant lease-centric', 'Persistent asset identity'],
    ],
  },
  faqs: [
    {
      q: 'Common architectural or operational inquiry?',
      a: 'Precise, professional answer explaining platform behavior.',
    },
  ],
  bridge: {
    title: 'Contextual Platform Bridge Headline',
    description: 'Explanation of how CLADORA connects this domain to operational execution.',
    buttonText: 'Action Label',
    href: '/en/platform',
  },
  relatedGuides: [
    {
      title: 'Related Guide Title',
      slug: 'related-guide-slug',
      lang: 'en',
    },
  ],
};
```

---

## 3. Standard Mandatory Disclaimers

### English International Template:
> *"This architectural guide analyzes system models, data structures, and operational workflows across multi-stakeholder real estate environments. It is jurisdiction-agnostic and does not substitute for local legal, statutory, or tax advisory. Requirements of the asset's location country must be verified independently with current sources and qualified professional review; this article does not announce an active Country Pack or production legal compliance."*

### Persian International Template:
> *"این راهنما به تحلیل مبانی معماری، ساختار داده‌ها و حاکمیت اطلاعات در پلتفرم‌های عملیات املاک می‌پردازد و مستقل از موقعیت جغرافیایی ملک یا حوزه قضایی خاص تنظیم شده است. الزامات کشور محل ملک باید جداگانه با منابع جاری و بازبینی واجد صلاحیت تأیید شوند؛ این مقاله فعال‌بودن Country Pack یا انطباق حقوقی تولیدی را اعلام نمی‌کند."*

---

## 4. Verification & Publication Checklist

Before any new international guide can be added to the production registry:
- [ ] **No Country Assumption**: Does the article avoid assuming a single default country?
- [ ] **Exact Length Constraints**: Is the rendered title strictly 60–65 characters (including ` | CLADORA`)? Is the meta description strictly 145–165 characters?
- [ ] **Zero Duplicate Query**: Is the primary query exclusively owned by this slug according to the relevant Language Intent Map?
- [ ] **Single-Language Canonical**: Is the canonical self-referencing with zero fake alternate hreflangs?
- [ ] **Review Verification**: Is the reviewer set to `CLADORA Editorial & Research Team` (or Persian equivalent) with visible rendering in the byline?
- [ ] **Test Conformance**: Do `npm run typecheck`, `npm run lint`, and `npm run test:claims` pass with zero warnings?
