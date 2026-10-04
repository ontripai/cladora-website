import { z } from 'zod';
import { airpropDiligenceSnapshotV1Schema } from './diligence-contract-v1';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(v => v.toLowerCase());
const version = z.number().int().positive().max(2147483646);
const base = { version:z.literal(1), context_id:uuid, workspace_id:uuid, opportunity_id:uuid, diligence_case_id:uuid, document_context_id:uuid,
 expected_revision:version, idempotency_key:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/) };
export const diligenceContentV1Schema = airpropDiligenceSnapshotV1Schema.pick({ checklist:true, findings:true }).refine(p => p.checklist.length === 3 && p.checklist.every(i => ['legal','financial','technical'].includes(i.code)), 'fixed_policy_checklist');
export const diligenceReviewCommandV1Schema = z.discriminatedUnion('action', [
 z.strictObject({...base, action:z.literal('save'), snapshot:diligenceContentV1Schema}),
 z.strictObject({...base, action:z.literal('submit'), expected_underwriting_version:version, expected_policy_version:z.literal(1)}),
]);
export const diligenceReviewQueryV1Schema = z.strictObject({ context_id:uuid, workspace_id:uuid, opportunity_id:uuid, diligence_case_id:uuid, document_context_id:uuid.optional() });
export const diligenceEvidenceQueryV1Schema = z.strictObject({ context_id:uuid, workspace_id:uuid, opportunity_id:uuid, document_context_id:uuid });
