'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DemoProvider } from '@/data/demoStore';

interface LayoutWrapperProps {
  lang: Language;
  children: React.ReactNode;
}

export const AppOrMarketingLayout: React.FC<LayoutWrapperProps> = ({ lang, children }) => {
  const pathname = usePathname();
  const isAppRoute = pathname?.includes(`/${lang}/app`) || pathname === `/${lang}/account` || pathname === `/${lang}/owner-portfolio`;

  return (
    <DemoProvider>
      {isAppRoute ? (
        <>{children}</>
      ) : (
        <div className="flex flex-col min-h-screen">
          <Header lang={lang} />
          <div className="flex-grow">{children}</div>
          <Footer lang={lang} />
        </div>
      )}
    </DemoProvider>
  );
};
