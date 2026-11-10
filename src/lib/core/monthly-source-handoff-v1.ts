import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/dashboard-schema';
import { monthlyCycleActionSchema } from '@/lib/customer/monthly-cycle-schema';

// A request planner, never a stored-source reader, permission or posting receipt.
const referenceSchema = z.strictObject({
  contract_version: z.literal('monthly-source-reference-handoff.v1'),
  context_id: uuidSchema,
  cycle_id: uuidSchema,
  source_relation: z.enum([
    'utilities.provider_invoices',
    'utilities.meter_readings',
    'finance.allocation_runs',
    'maintenance.vendor_payables',
  ]),
  source_id: uuidSchema,
});

/**
 * Does not dispatch, evaluate authority, verify persistence or compute money.
 * The existing authenticated route and DB gateway must resolve every reference
 * again. Caller-supplied approval/snapshot/amount fields are intentionally absent.
 */
export function planMonthlySourceCaptureV1(input: unknown) {
  const reference = referenceSchema.parse(input);
  if (reference.source_relation === 'maintenance.vendor_payables') {
    return {
      contract_version: 'monthly-source-reference-handoff.v1' as const,
      status: 'not_ready' as const,
      dependency: 'FINANCE_MAINTENANCE_MONTHLY_SOURCE_BRIDGE_REQUIRED' as const,
      request: null,
      action_authorization: 'not_evaluated' as const,
    };
  }
  const sourceType = {
    'utilities.provider_invoices': 'provider_invoice',
    'utilities.meter_readings': 'meter_reading',
    'finance.allocation_runs': 'allocation_run',
  } as const;
  const body = monthlyCycleActionSchema.parse({
    action: 'capture-source',
    context_id: reference.context_id,
    source_type: sourceType[reference.source_relation],
    source_id: reference.source_id,
  });
  return {
    contract_version: 'monthly-source-reference-handoff.v1' as const,
    status: 'request_prepared_source_unverified' as const,
    request: {
      method: 'POST' as const,
      path: `/api/customer/v1/accounting/monthly-cycles/${reference.cycle_id}/capture-source`,
      body,
    },
    action_authorization: 'not_evaluated' as const,
  };
}
