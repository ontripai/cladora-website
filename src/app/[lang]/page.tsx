import React from 'react';
import { Language } from '@/types';
import { UniversalHeroSection } from '@/components/home/UniversalHeroSection';
import { OperatingModelSection } from '@/components/home/OperatingModelSection';
import { PropertyLifecycleSection } from '@/components/home/PropertyLifecycleSection';
import { ConnectedDomainsSection } from '@/components/home/ConnectedDomainsSection';
import { SharedFoundationSection } from '@/components/home/SharedFoundationSection';
import { SolutionsWhoSection } from '@/components/home/SolutionsWhoSection';
import { IndustryPreviewSection } from '@/components/home/IndustryPreviewSection';
import { WhyCladoraSection } from '@/components/home/WhyCladoraSection';
import { CladoraIntelligencePreviewSection } from '@/components/home/CladoraIntelligencePreviewSection';
import { FinalPartnershipCtaSection } from '@/components/home/FinalPartnershipCtaSection';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

interface PageProps {
  params: Promise<{
    lang: Language;
  }>;
}

export default async function HomePage(props: PageProps) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen">
      {/* SECTION 01 — HERO & ARCHITECTURAL VISUAL */}
      <UniversalHeroSection lang={lang} />

      {/* SECTION 02 — THE OPERATING MODEL: PROPERTY → WORKSPACE → PEOPLE → DOMAINS */}
      <OperatingModelSection lang={lang} />

      {/* SECTION 03 — LIFECYCLE CONTINUITY ACROSS DECADES */}
      <PropertyLifecycleSection lang={lang} />

      {/* SECTION 04 — CONNECTED DOMAINS: AIRPROP, SERVICE, OPERATIONS, COMMUNITY */}
      <ConnectedDomainsSection lang={lang} />

      {/* SECTION 05 — SHARED FOUNDATION & CANONICAL TRUTH ACROSS 10 CAPABILITIES */}
      <SharedFoundationSection lang={lang} />

      {/* SECTION 06 — SOLUTIONS / WHO USES CLADORA (6 KEY ROLES) */}
      <SolutionsWhoSection lang={lang} />

      {/* SECTION 07 — INDUSTRY PREVIEW & COMPOSABLE PRESETS */}
      <IndustryPreviewSection lang={lang} />

      {/* SECTION 08 — WHY CLADORA: 6 STRUCTURAL DIFFERENTIATORS */}
      <WhyCladoraSection lang={lang} />

      {/* SECTION 09 — CLADORA INTELLIGENCE PREVIEW (6-STAGE GOVERNED AI MODEL) */}
      <CladoraIntelligencePreviewSection lang={lang} />

      {/* SECTION 10 — FINAL ENTERPRISE PARTNERSHIP CTA */}
      <FinalPartnershipCtaSection lang={lang} />
    </main>
  );
}
