import React from 'react';
import { Language } from '@/types';
import { UniversalHeroSection } from '@/components/home/UniversalHeroSection';
import { WorkspaceModelSection } from '@/components/home/WorkspaceModelSection';
import { PropertyLifecycleSection } from '@/components/home/PropertyLifecycleSection';
import { ThreeDomainsSection } from '@/components/home/ThreeDomainsSection';
import { AudienceAndTypologySection } from '@/components/home/AudienceAndTypologySection';
import { DelegationAndSuccessionSection } from '@/components/home/DelegationAndSuccessionSection';
import { TrustAndResponsibleAccessSection } from '@/components/home/TrustAndResponsibleAccessSection';
import { UniversalFaqSection } from '@/components/home/UniversalFaqSection';
import { UniversalFinalCtaSection } from '@/components/home/UniversalFinalCtaSection';

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
      {/* 1. Hero: Canonical CLADORA definition & clear action routes */}
      <UniversalHeroSection lang={lang} />

      {/* 2. Workspace Conceptual Model: Property vs Workspace vs Persons */}
      <WorkspaceModelSection lang={lang} />

      {/* 3. The 6-Stage Property Lifecycle: From Pre-sale to Operations & Succession */}
      <PropertyLifecycleSection lang={lang} />

      {/* 4. Three Interconnected Operational Domains & Shared Core Truth */}
      <ThreeDomainsSection lang={lang} />

      {/* 5. Stakeholder Audiences & Property Typologies (Residential, Commercial, Industrial, Mixed) */}
      <AudienceAndTypologySection lang={lang} />

      {/* 6. Roles, Mandate Duration & Accountable Succession */}
      <DelegationAndSuccessionSection lang={lang} />

      {/* 7. Security in Foundation, Responsible Contextual Access & Privacy */}
      <TrustAndResponsibleAccessSection lang={lang} />

      {/* 8. Practical Architecture FAQ */}
      <UniversalFaqSection lang={lang} />

      {/* 9. Final Call to Action */}
      <UniversalFinalCtaSection lang={lang} />
    </main>
  );
}
