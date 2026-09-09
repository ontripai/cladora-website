import { z } from "zod";

export const createGovernancePolicySchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, "name_required").max(200),
  voting_basis: z.enum(["unit", "owner", "ownership_share"]).default("ownership_share"),
  notice_period_days: z.number().int().min(3).max(60).default(10),
  quorum_threshold: z.number().min(0).max(1).default(0.5000000001),
});

export const createMeetingSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid(),
  title: z.string().trim().min(1, "title_required").max(250),
  meeting_type: z.enum(["general_assembly", "extraordinary_general_assembly", "board_meeting"]).default("general_assembly"),
  scheduled_at: z.string().datetime(),
  location_text: z.string().trim().max(500).optional().nullable(),
  remote_join_url: z.string().trim().url().max(1000).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  venue: z.string().trim().max(500).optional().nullable(),
  record_date: z.string().datetime().optional().nullable(),
});

export const addAgendaItemSchema = z.object({
  context_id: z.string().uuid(),
  sequence_no: z.number().int().min(1),
  title: z.string().trim().min(1, "title_required").max(250),
  description: z.string().trim().max(4000).optional().nullable(),
  item_type: z.enum(["discussion", "motion", "information", "election"]).default("discussion"),
  voting_required: z.boolean().default(false),
  proposed_amount: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).default("RON"),
  decision_category: z.string().trim().max(100).optional().nullable(),
  affected_owner_consents_collected: z.boolean().default(false),
  required_permit_reference: z.string().trim().max(200).optional().nullable(),
});

export const electMeetingSecretarySchema = z.object({
  context_id: z.string().uuid(),
  secretary_party_id: z.string().uuid(),
  secretary_name: z.string().trim().min(1, "secretary_name_required").max(200),
});

export const recordMinutesSignatureSchema = z.object({
  context_id: z.string().uuid(),
  signature_type: z.enum(["present_member", "censor"]),
  signature_evidence_ref: z.string().trim().max(500).optional().nullable(),
});

export const publishMeetingSchema = z.object({
  context_id: z.string().uuid(),
});

export const registerAttendanceSchema = z.object({
  context_id: z.string().uuid(),
  eligibility_id: z.string().uuid(),
  attendance_mode: z.enum(["in_person", "remote", "proxy"]).default("in_person"),
  represented_by_party_id: z.string().uuid().optional().nullable(),
});

export const registerProxySchema = z.object({
  context_id: z.string().uuid(),
  eligibility_id: z.string().uuid(),
  representative_party_id: z.string().uuid(),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
});

export const openMeetingSchema = z.object({
  context_id: z.string().uuid(),
});

export const openBallotSchema = z.object({
  context_id: z.string().uuid(),
  question: z.string().trim().min(1, "question_required").max(500),
  secret_ballot: z.boolean().default(false),
});

export const castVoteSchema = z.object({
  context_id: z.string().uuid(),
  eligibility_id: z.string().uuid(),
  choice: z.enum(["for", "against", "abstain"]),
  idempotency_key: z.string().trim().max(128).optional().nullable(),
});

export const closeBallotSchema = z.object({
  context_id: z.string().uuid(),
});

export const adoptResolutionSchema = z.object({
  context_id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  agenda_item_id: z.string().uuid(),
  resolution_no: z.string().trim().min(1, "resolution_no_required").max(100),
  title: z.string().trim().min(1, "title_required").max(250),
  text_body: z.string().trim().min(1, "text_body_required").max(10000),
  responsible_actor: z.string().trim().max(200).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  financial_impact: z.number().min(0).optional().nullable(),
  maintenance_work_order_id: z.string().uuid().optional().nullable(),
});

export const completeMeetingSchema = z.object({
  context_id: z.string().uuid(),
});

export const finalizeMinutesSchema = z.object({
  context_id: z.string().uuid(),
  content_json: z.record(z.string(), z.unknown()),
});

export const createMinutesCorrectionSchema = z.object({
  context_id: z.string().uuid(),
  correction_reason: z.string().trim().min(1, "correction_reason_required").max(1000),
  content_json: z.record(z.string(), z.unknown()),
});
