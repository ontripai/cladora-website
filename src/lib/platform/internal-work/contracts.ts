import { z } from 'zod';

export const uuid = z.string().uuid();
export const sha = z.string().regex(/^[0-9a-f]{40}$/);
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

const commandEnvelope = z.object({
  program_id: uuid,
  expected_version: z.number().int().min(0),
  request_id: uuid,
  idempotency_key: idempotencyKey,
});

export const listPackagesQuery = z.object({
  program_id: uuid,
  status: z.enum(['planned', 'active', 'in_review', 'accepted', 'closed', 'blocked', 'cancelled']).optional(),
  workstream_id: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor_created_at: z.string().datetime({ offset: true }).optional(),
  cursor_id: uuid.optional(),
}).refine((value) => Boolean(value.cursor_created_at) === Boolean(value.cursor_id), {
  message: 'Both cursor fields are required together',
});

export const registerPackageCommand = commandEnvelope.extend({
  expected_version: z.literal(0),
  baseline_id: uuid,
  workstream_id: uuid,
  package_key: z.string().trim().regex(/^[A-Z0-9][A-Z0-9._-]{2,95}$/),
  title: z.string().trim().min(3).max(240),
  bounded_scope: z.string().trim().min(3).max(4000),
}).strict();

export const transitionCycleCommand = commandEnvelope.extend({
  expected_version: z.number().int().positive(),
  target_state: z.enum(['ready', 'in_progress', 'in_review', 'accepted', 'blocked', 'closed', 'cancelled']),
  reason: z.string().trim().min(3).max(2000),
}).strict();

export const attachEvidenceCommand = commandEnvelope.extend({
  expected_version: z.number().int().positive(),
  commit_sha: sha,
  evidence_type: z.enum(['commit', 'pull_request', 'ci_run', 'artifact', 'document', 'deployment_observation', 'migration_observation']),
  provider: z.string().trim().min(1).max(64),
  provider_reference: z.string().trim().min(1).max(500)
    .refine((value) => !/^https?:\/\//i.test(value) && !/(token|secret|password|credential)/i.test(value)),
  result: z.enum(['not_registered', 'pending', 'passed', 'failed', 'cancelled', 'observed']),
  bounded_summary: z.string().trim().max(2000).optional(),
}).strict();

export const recordTestCommand = commandEnvelope.extend({
  expected_version: z.number().int().positive(),
  evidence_id: uuid.optional(),
  commit_sha: sha,
  provider: z.string().trim().min(1).max(64),
  check_name: z.string().trim().min(1).max(200),
  provider_run_id: z.string().trim().min(1).max(200).refine((value) => !/^https?:\/\//i.test(value)),
  status: z.enum(['not_registered', 'pending', 'running', 'passed', 'failed', 'cancelled', 'superseded']),
  bounded_summary: z.string().trim().max(2000).optional(),
  started_at: z.string().datetime({ offset: true }).optional(),
  completed_at: z.string().datetime({ offset: true }).optional(),
}).strict();

export const recordDecisionCommand = commandEnvelope.extend({
  expected_version: z.number().int().positive(),
  decision: z.enum(['accepted', 'rejected', 'changes_required']),
  criteria_snapshot: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(3).max(2000),
}).strict();

const requestChange = commandEnvelope.extend({
  action: z.literal('request'),
  expected_version: z.number().int().positive(),
  package_id: uuid,
  source_cycle_id: uuid,
  requested_scope: z.string().trim().min(3).max(4000),
  impact: z.string().trim().min(3).max(2000),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
}).strict();

const decideChange = commandEnvelope.extend({
  action: z.literal('decide'),
  expected_version: z.number().int().positive(),
  source_cycle_id: uuid.optional(),
  change_request_id: uuid,
  decision: z.enum(['approved', 'rejected']),
  decision_reason: z.string().trim().min(3).max(2000),
}).strict();

export const changeCommand = z.discriminatedUnion('action', [requestChange, decideChange]);

export type ListPackagesInput = z.infer<typeof listPackagesQuery>;
export type PmCommand = Record<string, unknown> & {
  program_id: string;
  request_id: string;
  idempotency_key: string;
};
