import React from 'react';
import { Language } from '@/types';
import { HeroSection } from '@/components/home/HeroSection';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ThreeModesSection } from '@/components/home/ThreeModesSection';
import { RoleQuickEntry } from '@/components/home/RoleQuickEntry';
import { FinancialTruthSection } from '@/components/home/FinancialTruthSection';
import { OwnerTenantSeparationSection } from '@/components/home/OwnerTenantSeparationSection';
import { BuildingArchetypesSection } from '@/components/home/BuildingArchetypesSection';
import { MeteringAndOperationsSection } from '@/components/home/MeteringAndOperationsSection';
import { ShadowLedgerMigrationSection } from '@/components/home/ShadowLedgerMigrationSection';
import { PortfolioIntelligenceSection } from '@/components/home/PortfolioIntelligenceSection';
import { GovernanceAndCommunitySection } from '@/components/home/GovernanceAndCommunitySection';
import { SecurityAndPermissionsSection } from '@/components/home/SecurityAndPermissionsSection';
import { InteractiveProductPreview } from '@/components/home/InteractiveProductPreview';
import { PricingPreviewSection } from '@/components/home/PricingPreviewSection';
import { PilotProgramSection } from '@/components/home/PilotProgramSection';
import { FaqSection } from '@/components/home/FaqSection';
import { FinalCtaSection } from '@/components/home/FinalCtaSection';

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
      {/* 1. Hero Section with 3-OS Switcher */}
      <HeroSection lang={lang} />

      {/* 2. Trust and Outcome Strip */}
      <TrustStrip lang={lang} />

      {/* 3. One Platform, Three Operating Experiences */}
      <ThreeModesSection lang={lang} />

      {/* 4. Role-Based Quick Entry */}
      <RoleQuickEntry lang={lang} />

      {/* 5. Financial Truth & Accounting Controls */}
      <FinancialTruthSection lang={lang} />

      {/* 6. Owner vs Tenant 5D Separation */}
      <OwnerTenantSeparationSection lang={lang} />

      {/* 7. Building Archetypes (Building DNA) */}
      <BuildingArchetypesSection lang={lang} />

      {/* 8. Metering, Photo OCR & Operations */}
      <MeteringAndOperationsSection lang={lang} />

      {/* 9. Safe Migration & Shadow Ledger */}
      <ShadowLedgerMigrationSection lang={lang} />

      {/* 10. Portfolio Intelligence */}
      <PortfolioIntelligenceSection lang={lang} />

      {/* 11. Governance and Community */}
      <GovernanceAndCommunitySection lang={lang} />

      {/* 12. Security and Permissions */}
      <SecurityAndPermissionsSection lang={lang} />

      {/* 13. Interactive Product Preview */}
      <InteractiveProductPreview lang={lang} />

      {/* 14. Indicative Pricing Preview */}
      <PricingPreviewSection lang={lang} />

      {/* 15. Pilot Program */}
      <PilotProgramSection lang={lang} />

      {/* 16. Comprehensive FAQ */}
      <FaqSection lang={lang} />

      {/* 17. Final Call to Action */}
      <FinalCtaSection lang={lang} />
    </main>
  );
}
