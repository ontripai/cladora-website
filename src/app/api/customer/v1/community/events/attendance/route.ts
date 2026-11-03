import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { attendanceReadRequestSchema, parseAttendanceReadResponse } from '@/lib/community/event-attendance-client';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers: HEADERS });

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const keys = ['context_id', 'workspace_id', 'event_id', 'occurrence_id', 'expected_event_version', 'limit', 'after_attendance_id'];
  if (Array.from(query.keys()).some(key => !keys.includes(key) || query.getAll(key).length !== 1)
    || !/^[1-9]\d*$/.test(query.get('expected_event_version') ?? '')
    || !/^[1-9]\d*$/.test(query.get('limit') ?? '')) return fail('INVALID_REQUEST', 400);
  const parsed = attendanceReadRequestSchema.safeParse({ ...Object.fromEntries(query),
    expected_event_version: Number(query.get('expected_event_version')), limit: Number(query.get('limit')),
    after_attendance_id: query.get('after_attendance_id'),
  });
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  try {
    const client = await createClient();
    const { data: claims, error: authError } = await client.auth.getClaims();
    if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
    const input = parsed.data;
    const { data, error } = await (client.schema('customer_api') as any).rpc('read_ce_event_attendance_v1', {
      p_context_id: input.context_id, p_workspace_id: input.workspace_id, p_event_id: input.event_id,
      p_occurrence_id: input.occurrence_id, p_expected_event_version: input.expected_event_version,
      p_limit: input.limit, p_after_attendance_id: input.after_attendance_id,
    });
    if (error) {
      if (['42883', 'PGRST202'].includes(error.code)) return fail('CE_ATTENDANCE_CONNECTION_NOT_READY', 503);
      if (error.code === '42501') return fail('CE_ATTENDANCE_ACCESS_DENIED', 403);
      if (error.code === 'P0002') return fail('CE_ATTENDANCE_NOT_FOUND', 404);
      if (error.code === '40001') return fail('CE_ATTENDANCE_STALE', 409);
      if (['22023', '22P02'].includes(error.code)) return fail('INVALID_REQUEST', 400);
      return fail('CE_ATTENDANCE_QUERY_FAILED', 500);
    }
    try { return NextResponse.json(parseAttendanceReadResponse(data, input), { headers: HEADERS }); }
    catch { return fail('CE_ATTENDANCE_INVALID_RESULT', 502); }
  } catch { return fail('CE_ATTENDANCE_QUERY_FAILED', 500); }
}
