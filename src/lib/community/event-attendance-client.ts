import { z } from 'zod';
import { eventUuidKey, sameEventUuid, type EventReadItem } from './event-interest-client.ts';
import { timezoneSchema } from './event-interest-schema.ts';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const version = z.number().int().positive().max(2147483647);
export const attendanceReadRequestSchema = z.strictObject({
  context_id: uuid, workspace_id: uuid, event_id: uuid, occurrence_id: uuid,
  expected_event_version: version,
  limit: z.number().int().min(1).max(50),
  after_attendance_id: uuid.nullable(),
});
export type AttendanceReadRequest = z.infer<typeof attendanceReadRequestSchema>;

export const attendanceTargetSchema = z.strictObject({
  attendance_id: uuid, attendance_version: version, membership_id: uuid,
  display_name: z.string().trim().min(1).max(120), attended: z.boolean(),
  observed_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).refine(value => {
    const instant = Date.parse(value + 'Z');
    return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 19) === value;
  }, 'Invalid recorded local date-time'),
});
export type AttendanceTarget = z.infer<typeof attendanceTargetSchema>;

// Additive boundary. eventReadResponseSchema and the command/receipt ABI stay v1.
export const attendanceReadResponseSchema = z.strictObject({
  contract: z.literal('ce011-attendance-projection.v1'), version: z.literal(1),
  context_id: uuid, workspace_id: uuid, event_id: uuid, occurrence_id: uuid,
  event_version: version, event_status: z.enum(['published', 'cancelled']),
  timezone: timezoneSchema, can_correct: z.literal(true),
  order: z.literal('attendance_id.asc'), limit: z.number().int().min(1).max(50),
  after_attendance_id: uuid.nullable(), next_cursor: uuid.nullable(),
  targets: z.array(attendanceTargetSchema).max(50),
}).superRefine((value, ctx) => {
  let previous = value.after_attendance_id ? eventUuidKey(value.after_attendance_id)! : '';
  const members = new Set<string>();
  for (const row of value.targets) {
    const key = eventUuidKey(row.attendance_id)!, member = eventUuidKey(row.membership_id)!;
    if (key <= previous || members.has(member)) ctx.addIssue({ code: 'custom', message: 'attendance_order_or_identity_mismatch' });
    previous = key; members.add(member);
  }
  if (value.targets.length > value.limit || (value.next_cursor !== null
    && (value.targets.length !== value.limit || !sameEventUuid(value.next_cursor, value.targets.at(-1)?.attendance_id)))) {
    ctx.addIssue({ code: 'custom', message: 'attendance_cursor_mismatch' });
  }
});
export type AttendanceReadResponse = z.infer<typeof attendanceReadResponseSchema>;

export function parseAttendanceReadResponse(value: unknown, request: AttendanceReadRequest, event?: EventReadItem) {
  const response = attendanceReadResponseSchema.parse(value);
  for (const field of ['context_id', 'workspace_id', 'event_id', 'occurrence_id'] as const) {
    if (!sameEventUuid(response[field], request[field])) throw new Error('attendance_binding_mismatch');
  }
  if (response.event_version !== request.expected_event_version || response.limit !== request.limit
    || (response.after_attendance_id === null ? request.after_attendance_id !== null
      : !sameEventUuid(response.after_attendance_id, request.after_attendance_id))) throw new Error('attendance_binding_mismatch');
  if (event && (!sameEventUuid(event.event_id, response.event_id) || !sameEventUuid(event.workspace_id, response.workspace_id)
    || !sameEventUuid(event.occurrence_id, response.occurrence_id) || event.version !== response.event_version
    || event.status !== response.event_status || event.timezone !== response.timezone)) throw new Error('attendance_event_stale');
  return response;
}

export function attendanceReadUrl(request: AttendanceReadRequest) {
  const query = new URLSearchParams({
    context_id: request.context_id, workspace_id: request.workspace_id, event_id: request.event_id,
    occurrence_id: request.occurrence_id, expected_event_version: String(request.expected_event_version), limit: String(request.limit),
  });
  if (request.after_attendance_id !== null) query.set('after_attendance_id', request.after_attendance_id);
  return `/api/customer/v1/community/events/attendance?${query}`;
}
