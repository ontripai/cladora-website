import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const version = z.number().int().min(1).max(2147483647);
const code = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const text = z.string().trim().min(1).max(2000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
const evidence = z.array(uuid).max(32).refine(values => new Set(values).size === values.length, 'duplicate_evidence');
const checklistItem = z.discriminatedUnion('status', [
  z.strictObject({ code, status: z.literal('pending'), evidence_version_ids: evidence }),
  z.strictObject({ code, status: z.literal('satisfied'), evidence_version_ids: evidence.refine(values => values.length > 0, 'evidence_required') }),
]);
const finding = z.discriminatedUnion('status', [
  z.strictObject({ finding_id: uuid, severity: z.enum(['blocking', 'advisory']), status: z.literal('open'), summary: text, evidence_version_ids: evidence }),
  z.strictObject({ finding_id: uuid, severity: z.enum(['blocking', 'advisory']), status: z.literal('resolved'), summary: text,
    resolution: text, evidence_version_ids: evidence.refine(values => values.length > 0, 'resolution_evidence_required') }),
]);

/** Version IDs refer to immutable documents.document_versions, never object paths.
 * A server must independently authorize and verify each reference; parsing is no proof. */
export const airpropDiligenceSnapshotV1Schema = z.strictObject({
  version: z.literal(1),
  workspace_id: uuid,
  opportunity_id: uuid,
  underwriting_case_id: uuid,
  underwriting_version: version,
  revision: version,
  policy_version: version,
  checklist: z.array(checklistItem).min(1).max(64)
    .refine(items => new Set(items.map(item => item.code)).size === items.length, 'duplicate_checklist_code'),
  findings: z.array(finding).max(128)
    .refine(items => new Set(items.map(item => item.finding_id)).size === items.length, 'duplicate_finding'),
});

const policySchema = z.strictObject({
  policy_version: version,
  required_checklist_codes: z.array(code).min(1).max(64)
    .refine(values => new Set(values).size === values.length, 'duplicate_policy_code'),
});

export const submitAirpropDiligenceReviewV1Schema = z.strictObject({
  version: z.literal(1), context_id: uuid, workspace_id: uuid, opportunity_id: uuid,
  diligence_case_id: uuid,
  expected_revision: version,
  expected_underwriting_version: version,
  expected_policy_version: version,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});

export const createAirpropDiligenceDraftV1Schema = z.strictObject({
  version: z.literal(1), context_id: uuid, workspace_id: uuid, opportunity_id: uuid,
  expected_underwriting_version: version,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});

/** Pure review-readiness rules over a freshly authorized server snapshot and policy.
 * No permission, evidence access, scan verification, approval or state transition is
 * established here. Never accept the snapshot/policy from a mutation request. */
export function assessAirpropDiligenceReviewV1(snapshotInput: unknown, policyInput: unknown, currentUnderwritingVersion: unknown) {
  const snapshot = airpropDiligenceSnapshotV1Schema.parse(snapshotInput);
  const policy = policySchema.parse(policyInput);
  const current = version.parse(currentUnderwritingVersion);
  const reasons: string[] = [];
  if (snapshot.underwriting_version !== current) reasons.push('stale_underwriting_version');
  if (snapshot.policy_version !== policy.policy_version) reasons.push('stale_policy_version');
  const required = new Set(policy.required_checklist_codes);
  for (const key of Array.from(required).sort()) {
    if (!snapshot.checklist.some(item => item.code === key && item.status === 'satisfied')) reasons.push(`incomplete_check:${key}`);
  }
  for (const item of snapshot.checklist) {
    if (!required.has(item.code)) reasons.push(`unknown_check:${item.code}`);
  }
  for (const item of snapshot.findings) {
    if (item.severity === 'blocking' && item.status === 'open') reasons.push(`blocking_finding:${item.finding_id}`);
  }
  return { ready_for_review: reasons.length === 0, reasons: reasons.sort() };
}
