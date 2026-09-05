import 'server-only';
import { notFound } from 'next/navigation';

/**
 * Ensures internal development routes cannot be viewed in Production.
 * If running in Production (and ENABLE_INTERNAL_ROUTES is not explicitly 'true'),
 * immediately triggers Next.js notFound() (HTTP 404).
 */
export function enforceInternalRouteGate(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const allowInternal = process.env.ENABLE_INTERNAL_ROUTES === 'true';

  if (isProd && !allowInternal) {
    notFound();
  }
}
