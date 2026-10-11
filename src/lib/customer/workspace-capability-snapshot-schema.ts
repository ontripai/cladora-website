import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';

const timestampSchema = z.string().datetime({ offset: true });

// Exact Supabase RPC argument contract. Keep this two-parameter shape aligned
// with SQL, generated database types and every future HTTP consumer.
export const workspaceCapabilitySnapshotV1RpcArgsSchema = z.object({
  p_context_id: uuidSchema,
  p_workspace_id: uuidSchema,
}).strict();

export const workspaceCapabilityStateSchema = z.enum([
  'available',
  'inactive',
  'unavailable',
  'review_required',
]);

export const entitlementProvenanceSchema = z.enum([
  'contract',
  'legacy_unprovenanced',
]);

export const capabilityReferenceVisibilitySchema = z.enum([
  'full',
  'count_only',
  'withheld',
]);

export const resourceDisclosureSchema = z.discriminatedUnion('visibility', [
  z.object({
    visibility: z.literal('full'),
    visible_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
    resource_ids: z.array(uuidSchema),
  }).strict(),
  z.object({
    visibility: z.literal('count_only'),
    visible_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative().nullable(),
    resource_ids: z.array(z.never()).max(0),
  }).strict(),
  z.object({
    visibility: z.literal('withheld'),
    visible_count: z.null(),
    total_count: z.null(),
    resource_ids: z.array(z.never()).max(0),
  }).strict(),
]);

export const contractDisclosureSchema = z.discriminatedUnion('visibility', [
  z.object({
    visibility: z.literal('full'),
    contract_id: uuidSchema,
    contract_ref: z.string().min(1).max(160),
    contract_version: z.number().int().positive(),
    status: z.string().min(1).max(64),
  }).strict(),
  z.object({
    visibility: z.literal('status_only'),
    contract_id: z.null(),
    contract_ref: z.null(),
    contract_version: z.null(),
    status: z.string().min(1).max(64),
  }).strict(),
  z.object({
    visibility: z.literal('withheld'),
    contract_id: z.null(),
    contract_ref: z.null(),
    contract_version: z.null(),
    status: z.null(),
  }).strict(),
  z.object({
    visibility: z.literal('not_applicable'),
    contract_id: z.null(),
    contract_ref: z.null(),
    contract_version: z.null(),
    status: z.null(),
  }).strict(),
]);

export const workspaceCapabilitySnapshotV1Schema = z.object({
  contract_version: z.literal('workspace-capability-snapshot.v1'),
  evaluated_at: timestampSchema,
  reference_visibility: capabilityReferenceVisibilitySchema,
  workspace: z.object({
    tenant_id: uuidSchema,
    workspace_id: uuidSchema,
    lifecycle_status: z.string().min(1).max(64),
    administrative_origin_type: z.string().min(1).max(64),
    version: z.number().int().positive(),
  }).strict(),
  taxonomy: z.object({
    status: z.enum(['configured', 'not_configured']),
    assignment_id: uuidSchema.nullable(),
    property_profile_code: z.string().min(1).max(64).nullable(),
    operating_model_code: z.string().min(1).max(64).nullable(),
  }).strict(),
  resources: resourceDisclosureSchema,
  capabilities: z.array(z.object({
    capability_key: z.string().regex(/^[a-z0-9_.:-]{3,128}$/),
    workspace_state: workspaceCapabilityStateSchema,
    state_reason_codes: z.array(z.string().regex(/^[a-z0-9_.:-]{3,128}$/)),
    action_authorization: z.literal('not_evaluated'),
    module: z.object({
      definition_id: uuidSchema.nullable(),
      code: z.string().min(2).max(64),
      version: z.number().int().positive(),
      activation_id: uuidSchema.nullable(),
      activation_status: z.string().min(1).max(64),
    }).nullable(),
    entitlement: z.object({
      entitlement_id: uuidSchema.nullable(),
      key: z.string().min(1).max(160),
      provenance: entitlementProvenanceSchema,
      contract: contractDisclosureSchema,
      currently_effective: z.boolean(),
      valid_from: timestampSchema,
      valid_until: timestampSchema.nullable(),
      override_active: z.boolean(),
    }).nullable(),
    restrictions: z.array(z.object({
      kind: z.enum(['resource', 'technical', 'contract', 'policy']),
      result: z.enum(['satisfied', 'unsatisfied', 'review_required', 'not_applicable']),
      reason_code: z.string().regex(/^[a-z0-9_.:-]{3,128}$/),
      action: z.string().min(1).max(128).nullable(),
      resource_id: uuidSchema.nullable(),
      source_id: z.string().min(1).max(200).nullable(),
      source_version: z.number().int().positive().nullable(),
    }).strict()),
  }).strict()),
}).strict();

export type WorkspaceCapabilitySnapshotV1 = z.infer<typeof workspaceCapabilitySnapshotV1Schema>;
export type WorkspaceCapabilitySnapshotV1RpcArgs = z.infer<
  typeof workspaceCapabilitySnapshotV1RpcArgsSchema
>;
