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

  // Public platform marketing routes
  const publicPlatformRoutes = [
    `/${lang}/platform`,
    `/${lang}/platform/architecture`,
    `/${lang}/platform/lifecycle`,
    `/${lang}/platform/trust`,
  ];
  const isPublicPlatformRoute = pathname
    ? publicPlatformRoutes.some((route) => pathname === route || pathname.startsWith(`${route}#`))
    : false;

  // Control plane and authenticated application routes
  const isPlatformControlPlane =
    pathname && !isPublicPlatformRoute ? pathname.startsWith(`/${lang}/platform/`) : false;
  const isAppRoute =
    isPlatformControlPlane ||
    pathname?.includes(`/${lang}/app`) ||
    pathname === `/${lang}/account` ||
    pathname === `/${lang}/owner-portfolio`;
  const isDemoAppRoute = pathname === `/${lang}/demo/app` || pathname?.startsWith(`/${lang}/demo/app/`);

  // Legacy pages requiring dark compatibility shell for contrast safety (WP-03 fix)
  // In WP-10, legacy routes are consolidated/redirected and /pricing is modernized to enterprise light theme
  const legacyDarkRoutes: string[] = [];
  const isLegacyDarkRoute = pathname ? legacyDarkRoutes.includes(pathname) : false;

  const page = isAppRoute || isDemoAppRoute ? (
        <>{children}</>
      ) : (
        <div className="flex flex-col min-h-screen">
          <Header lang={lang} />
          <div className={`flex-grow ${isLegacyDarkRoute ? 'legacy-dark-shell' : ''}`}>
            {children}
          </div>
          <Footer lang={lang} />
        </div>
      );
  const isDemoRoute = pathname === `/${lang}/demo` || pathname?.startsWith(`/${lang}/demo/`);
  return isDemoRoute ? <DemoProvider>{page}</DemoProvider> : page;
};
