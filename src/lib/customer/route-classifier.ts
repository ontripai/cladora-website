export const EXPLICITLY_ALLOWED_ROUTES = [
  '/app/dashboard',
] as const;

import {
  EXPLICITLY_UNAVAILABLE_ROUTES,
  PRE_CONTEXT_ALLOWED_ROUTES,
  isPreContextRoute,
} from './access-matrix.ts';
export { EXPLICITLY_UNAVAILABLE_ROUTES, PRE_CONTEXT_ALLOWED_ROUTES, isPreContextRoute };

export interface RouteRequirement {
  pathPrefix: string;
  exactOnly?: boolean;
  permissions?: string[];
  entitlements?: string[];
  modules?: string[];
}

export const ROUTE_REQUIREMENTS: RouteRequirement[] = [
  // Accounting & Allocations
  {
    pathPrefix: '/app/accounting/allocations',
    permissions: ['finance.allocations.read'],
  },
  {
    pathPrefix: '/app/accounting',
    permissions: ['finance.ledger.read'],
    modules: ['accounting'],
  },

  // Billing & Invoices & Receivables
  {
    pathPrefix: '/app/billing',
    permissions: ['billing.receivables.read'],
    modules: ['billing'],
  },
  {
    pathPrefix: '/app/invoices',
    permissions: ['billing.receivables.read'],
    modules: ['billing'],
  },
  {
    pathPrefix: '/app/receivables',
    permissions: ['billing.receivables.read'],
    modules: ['billing'],
  },

  // Payments & Reconciliation
  {
    pathPrefix: '/app/payments',
    permissions: ['payments.reconciliation.read'],
    modules: ['payments'],
  },
  {
    pathPrefix: '/app/reconciliation',
    permissions: ['payments.reconciliation.read'],
    modules: ['payments'],
  },

  // Meters / Utilities
  {
    pathPrefix: '/app/meters',
    permissions: ['utilities.metering.read'],
    entitlements: ['module.utilities'],
  },

  // Maintenance & Assets
  {
    pathPrefix: '/app/assets',
    permissions: ['maintenance.assets.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/maintenance',
    permissions: ['maintenance.assets.read'],
    entitlements: ['module.maintenance'],
  },

  // Procurement & Vendors
  {
    pathPrefix: '/app/procurement',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/vendors',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/purchase-orders',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/vendor-contracts',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/vendor-sla',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },

  // Governance & Meetings
  {
    pathPrefix: '/app/governance',
    permissions: ['governance.meetings.read'],
    entitlements: ['module.governance'],
  },
  {
    pathPrefix: '/app/meetings',
    permissions: ['governance.meetings.read'],
    entitlements: ['module.governance'],
  },

  // Communications & Notifications
  {
    pathPrefix: '/app/communications',
    permissions: ['communications.feed.read'],
    entitlements: ['module.communications'],
  },
  {
    pathPrefix: '/app/notifications',
    permissions: ['communications.feed.read'],
    entitlements: ['module.communications'],
  },

  // Documents
  {
    pathPrefix: '/app/documents',
    permissions: ['documents.vault.read'],
    entitlements: ['module.documents'],
  },

  // Occupancy, Ownership, Residents & Leases
  {
    pathPrefix: '/app/occupancy',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },
  {
    pathPrefix: '/app/ownership',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },
  {
    pathPrefix: '/app/residents',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },
  {
    pathPrefix: '/app/leases',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },

  // Security Access, Access Logs, Credentials & Visitors
  {
    pathPrefix: '/app/security-access',
    permissions: ['security.access.read'],
    entitlements: ['module.security'],
  },
  {
    pathPrefix: '/app/access-logs',
    permissions: ['security.access.read'],
    entitlements: ['module.security'],
  },
  {
    pathPrefix: '/app/credentials',
    permissions: ['security.access.read'],
    entitlements: ['module.security'],
  },
  {
    pathPrefix: '/app/visitors',
    permissions: ['security.access.read'],
    entitlements: ['module.security'],
  },

  // Audit
  {
    pathPrefix: '/app/audit',
    permissions: ['audit.events.read'],
  },
];

export type RouteStatus =
  | 'explicitly allowed'
  | 'pre-context allowed'
  | 'permission protected'
  | 'explicitly unavailable';

export function classifyCustomerRoute(
  appPath: string
): { status: RouteStatus; requirement?: RouteRequirement } | null {
  const cleanPath = appPath === '/' ? appPath : appPath.replace(/\/$/, '');

  // 1. Check explicitly unavailable routes (mock / preview)
  if (
    EXPLICITLY_UNAVAILABLE_ROUTES.some(
      (mock) => cleanPath === mock || cleanPath.startsWith(`${mock}/`)
    )
  ) {
    return { status: 'explicitly unavailable' };
  }

  // 2. Check pre-context allowed routes (e.g. /app/onboarding exact match)
  if (isPreContextRoute(cleanPath)) {
    return { status: 'pre-context allowed' };
  }

  // 3. Check explicitly allowed routes (dashboard)
  if (
    EXPLICITLY_ALLOWED_ROUTES.some(
      (allowed) => cleanPath === allowed || cleanPath.startsWith(`${allowed}/`)
    )
  ) {
    return { status: 'explicitly allowed' };
  }

  // 3. Check permission / entitlement / module protected routes (longest prefix first)
  const sorted = [...ROUTE_REQUIREMENTS].sort(
    (a, b) => b.pathPrefix.length - a.pathPrefix.length
  );
  const matched = sorted.find((req) =>
    req.exactOnly
      ? cleanPath === req.pathPrefix
      : cleanPath === req.pathPrefix || cleanPath.startsWith(`${req.pathPrefix}/`)
  );

  if (matched) {
    return { status: 'permission protected', requirement: matched };
  }

  // Unknown route under /app -> Fail-closed
  return null;
}
