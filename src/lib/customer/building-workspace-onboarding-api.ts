import { mapOnboardingError } from './onboarding-import-helper';
export function missingSetupPrecondition(body: unknown, approval = false) {
  return !!body && typeof body === 'object' && (!Object.hasOwn(body, 'expected_revision') || ('expected_revision' in body && body.expected_revision == null)
    || (approval && (!Object.hasOwn(body, 'expected_payload_hash') || ('expected_payload_hash' in body && body.expected_payload_hash == null))));
}
export function mapBuildingSetupError(error: { code?: string; message?: string }) {
  if (error.code === '55000' && /setup_g2_|setup_command_/.test(error.message ?? '')) return { status: 503, code: 'SETUP_PROOF_UNAVAILABLE' };
  if (error.code === '25001' && error.message?.includes('setup_checkpoint')) return { status: 503, code: 'SETUP_CHECKPOINT_UNAVAILABLE' };
  if (error.code === '23505' && error.message?.includes('setup_command_receipt_conflict')) return { status: 409, code: 'SETUP_COMMAND_CONFLICT' };
  if (error.code === '40001' || /setup_(revision|snapshot)_conflict/.test(error.message ?? '')) return { status: 409, code: 'SETUP_REVISION_CONFLICT' };
  if (error.code === '22004') return { status: 428, code: 'SETUP_PRECONDITION_REQUIRED' };
  if (error.message?.includes('setup_legacy_review_required')) return { status: 409, code: 'SETUP_LEGACY_REVIEW_REQUIRED' };
  return mapOnboardingError(error);
}

/** G2 lookup errors are never a negative execution receipt. Legacy mapping stays intact. */
export function mapBuildingSetupLookupError(error: { code?: string; message?: string }) {
  if (!['42501', 'P0002', '40001', '22023', '22004', '23505', '25001', '55000'].includes(error.code ?? '')) {
    return { status: 500, code: 'SETUP_LOOKUP_UNKNOWN' };
  }
  return mapBuildingSetupError(error);
}
