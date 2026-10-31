import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().date();
const money = z.number().finite();

const period = z.strictObject({ starts_on: date, ends_on: date, expense_total: money });
const category = z.strictObject({
  account_code: z.string().min(1).max(120),
  account_name: z.string().min(1).max(240),
  current_amount: money,
  previous_amount: money,
  delta_amount: money,
  delta_percent: money.nullable(),
});

export const workspaceCostBenchmarkV1Schema = z.strictObject({
  contract_version: z.literal('workspace-cost-benchmark.v1'),
  workspace_id: uuid,
  comparison_kind: z.literal('workspace_prior_period'),
  currency: z.string().regex(/^[A-Z]{3}$/),
  current_period: period,
  previous_period: period,
  delta_amount: money,
  delta_percent: money.nullable(),
  categories: z.array(category).max(500),
  property_count: z.number().int().positive(),
  source: z.strictObject({
    system: z.literal('finance.journals'),
    account_type: z.literal('expense'),
    journal_states: z.tuple([z.literal('posted'), z.literal('reversed')]),
  }),
  external_benchmark: z.strictObject({
    status: z.literal('withheld'),
    reason_code: z.literal('approved_regional_dataset_unavailable'),
  }),
  generated_at: z.string().datetime({ offset: true }),
  read_only_projection: z.literal(true),
});

export type WorkspaceCostBenchmarkV1 = z.infer<typeof workspaceCostBenchmarkV1Schema>;
