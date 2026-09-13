export const MONTHLY_CYCLE_HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export function mapMonthlyCycleError(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase();
  if (error.code === '42501' || message.includes('denied') || message.includes('mfa_required') || message.includes('dual_control')) return { status: 403, code: message.includes('mfa') ? 'MFA_REQUIRED' : 'MONTHLY_CYCLE_FORBIDDEN' };
  if (error.code === 'P0002' || message.includes('not_found')) return { status: 404, code: 'MONTHLY_CYCLE_NOT_FOUND' };
  if (error.code === '23505' || error.code === '40001' || message.includes('already')) return { status: 409, code: 'MONTHLY_CYCLE_CONFLICT' };
  if (error.code === '23514' || error.code === '55000' || message.includes('required') || message.includes('blocking')) return { status: 422, code: 'MONTHLY_CYCLE_NOT_READY' };
  return { status: 400, code: 'MONTHLY_CYCLE_REQUEST_REJECTED' };
}
