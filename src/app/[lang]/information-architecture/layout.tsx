import { enforceInternalRouteGate } from '@/lib/security/route-gate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = 'force-dynamic';

export default function InformationArchitectureLayout({ children }: { children: React.ReactNode }) {
  enforceInternalRouteGate();
  return <>{children}</>;
}
