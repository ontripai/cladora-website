import { mapOnboardingError } from './onboarding-import-helper';
export function missingSetupPrecondition(body: unknown, approval = false) {
  return !!body && typeof body === 'object' && (!Object.hasOwn(body, 'expected_revision') || ('expected_revision' in body && body.expected_revision == null)
    || (approval && (!Object.hasOwn(body, 'expected_payload_hash') || ('expected_payload_hash' in body && body.expected_payload_hash == null))));
}
export function mapBuildingSetupError(error: { code?: string; message?: string }) {
  if (error.code === '40001' || /setup_(revision|snapshot)_conflict/.test(error.message ?? '')) return { status: 409, code: 'SETUP_REVISION_CONFLICT' };
  if (error.code === '22004') return { status: 428, code: 'SETUP_PRECONDITION_REQUIRED' };
  if (error.message?.includes('setup_legacy_review_required')) return { status: 409, code: 'SETUP_LEGACY_REVIEW_REQUIRED' };
  return mapOnboardingError(error);
}
