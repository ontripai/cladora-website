import { z } from 'zod';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(value => value.toLowerCase());
const version = z.number().int().positive().max(2147483646);
const rationale = z.string().trim().min(1).max(2000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'invalid_control_character');
const target = { context_id: uuid, workspace_id: uuid, opportunity_id: uuid, diligence_case_id: uuid };
const command = { ...target, version: z.literal(1), document_context_id: uuid, rationale, idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/) };
export const acquisitionCommandV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ ...command, action: z.literal('propose'), expected_submission_id: uuid, expected_diligence_revision: version.min(2), expected_underwriting_version: version }),
  z.strictObject({ ...command, action: z.literal('decide'), proposal_id: uuid, expected_decision_revision: z.number().int().min(1).max(2), decision: z.enum(['approve', 'reject']) }),
]);
export const acquisitionQueryV1Schema = z.strictObject({ ...target, document_context_id: uuid.optional() });
const status = z.enum(['pending', 'rejected', 'internally_approved']);
const vote = z.object({ decision_revision: z.number().int().min(2).max(3), decision: z.enum(['approve', 'reject']), rationale, decided_at: z.string() });
export const acquisitionDetailV1Schema = z.object({
  version: z.literal(1), workspace_id: uuid, opportunity_id: uuid, diligence_case_id: uuid, underwriting_version: version,
  eligible: z.boolean(), can_propose: z.boolean(), can_decide: z.boolean(), reason: z.enum(['DILIGENCE_NOT_SUBMITTED', 'BASELINE_CHANGED']).nullable(),
  submission_id: uuid.optional(), diligence_revision: version.min(2).optional(),
  proposal: z.object({ proposal_id: uuid, rationale, proposed_at: z.string(), expires_at: z.string(), expired: z.boolean(),
    decision_revision: z.number().int().min(1).max(3), approval_count: z.number().int().min(0).max(2), status, decisions: z.array(vote).max(2) }).nullable(),
}).superRefine((data, ctx) => {
  if ((data.eligible || data.proposal || data.can_propose || data.can_decide) && (!data.submission_id || !data.diligence_revision)) ctx.addIssue({ code: 'custom', message: 'missing_submission' });
  if (data.can_propose && (!data.eligible || data.proposal)) ctx.addIssue({ code: 'custom', message: 'invalid_proposal_capability' });
  if (data.can_decide && (!data.eligible || !data.proposal || data.proposal.expired || data.proposal.status !== 'pending')) ctx.addIssue({ code: 'custom', message: 'invalid_decision_capability' });
  if (data.proposal) {
    const p = data.proposal;
    const approvals = p.decisions.filter(v => v.decision === 'approve').length;
    const rejected = p.decisions.some(v => v.decision === 'reject');
    if (p.decision_revision !== 1 + p.decisions.length || p.approval_count !== approvals || new Set(p.decisions.map(v => v.decision_revision)).size !== p.decisions.length
      || p.status !== (rejected ? 'rejected' : approvals === 2 ? 'internally_approved' : 'pending')) ctx.addIssue({ code: 'custom', message: 'invalid_decision_state' });
  }
});
export const acquisitionResponseV1Schema = z.object({ version: z.literal(1), workspace_id: uuid, opportunity_id: uuid, diligence_case_id: uuid,
  proposal_id: uuid, decision_revision: z.number().int().min(1).max(3), status, idempotent: z.boolean(), approval_count: z.number().int().min(0).max(2).optional() });
