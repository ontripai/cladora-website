import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';

const timestampSchema = z.string().datetime({ offset: true });
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);

export const workspaceNativeAuthorityRequestV2Schema = z.strictObject({
  contract_version: z.literal('workspace-native-effective-authority.v2'),
  decision_id: uuidSchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  permission_code: codeSchema,
  module_code: codeSchema,
  target_scope_type: z.literal('workspace'),
  target_scope_id: uuidSchema,
  evaluation_purpose: codeSchema,
}).superRefine((value, ctx) => {
  if (value.target_scope_id !== value.workspace_id) {
    ctx.addIssue({ code: 'custom', path: ['target_scope_id'], message: 'workspace_scope_target_must_match_workspace' });
  }
});

const workspaceNativeAuthorityDecisionBaseV2Schema = z.strictObject({
  contract_version: z.literal('workspace-native-effective-authority.v2'),
  decision_id: uuidSchema,
  workspace_id: uuidSchema,
  permission_code: codeSchema,
  module_code: codeSchema,
  target_scope_type: z.literal('workspace'),
  target_scope_id: uuidSchema,
  evaluator: z.literal('app_private.check_workspace_native_permission_v2'),
  authority_policy_version: z.literal(2),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  evaluated_at: timestampSchema,
  current_authority_recheck_required: z.literal(true),
  reusable_as_command_authority: z.literal(false),
});

const workspaceNativeAuthorityAllowedV2Schema = workspaceNativeAuthorityDecisionBaseV2Schema.extend({
  decision: z.literal('allowed'),
  reason_codes: z.tuple([z.literal('current_effective_permission_allowed')]),
});

const workspaceNativeAuthorityDeniedV2Schema = workspaceNativeAuthorityDecisionBaseV2Schema.extend({
  decision: z.literal('denied'),
  reason_codes: z.tuple([z.literal('current_effective_permission_denied')]),
});

export const workspaceNativeAuthorityDecisionV2Schema = z.discriminatedUnion('decision', [
  workspaceNativeAuthorityAllowedV2Schema,
  workspaceNativeAuthorityDeniedV2Schema,
]);

export type WorkspaceNativeAuthorityRequestV2 = z.infer<typeof workspaceNativeAuthorityRequestV2Schema>;
export type WorkspaceNativeAuthorityDecisionV2 = z.infer<typeof workspaceNativeAuthorityDecisionV2Schema>;

export function describeWorkspaceNativeAuthorityDecisionV2(
  request: WorkspaceNativeAuthorityRequestV2,
  evaluatorAllowed: boolean,
  evaluatedAt: string,
): WorkspaceNativeAuthorityDecisionV2 {
  const input = workspaceNativeAuthorityRequestV2Schema.parse(request);
  return workspaceNativeAuthorityDecisionV2Schema.parse({
    contract_version: input.contract_version,
    decision_id: input.decision_id,
    workspace_id: input.workspace_id,
    permission_code: input.permission_code,
    module_code: input.module_code,
    target_scope_type: input.target_scope_type,
    target_scope_id: input.target_scope_id,
    evaluator: 'app_private.check_workspace_native_permission_v2',
    authority_policy_version: 2,
    source_disclosure: 'status_only',
    source_reference: null,
    evaluated_at: evaluatedAt,
    current_authority_recheck_required: true,
    reusable_as_command_authority: false,
    decision: evaluatorAllowed ? 'allowed' : 'denied',
    reason_codes: evaluatorAllowed
      ? ['current_effective_permission_allowed']
      : ['current_effective_permission_denied'],
  });
}
