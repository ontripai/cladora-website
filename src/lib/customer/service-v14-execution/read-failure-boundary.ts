import 'server-only';
import {
  CoreFunctionalRuntimeUnavailableV1,
  coreFunctionalReadFailureV1,
} from '../../core/functional-command-runtime-v1';
import type { ServiceOfferingRequestFlowPortsV1 } from './application-flow';
import {
  serviceRequestReadAccessDeniedV1,
  serviceRequestReadAuthenticationRequiredV1,
} from './read-denial';

function own(error: unknown, key: string): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  try {
    const property = Object.getOwnPropertyDescriptor(error, key);
    return property && 'value' in property ? property.value : undefined;
  } catch { return undefined; }
}

function classify(error: unknown): 'scope_denied' | 'authentication_required' | 'unavailable' {
  if (typeof error !== 'object' || error === null) return 'unavailable';
  const evidence = coreFunctionalReadFailureV1(error);
  const settled = evidence?.settlement === 'rolled_back'
    && evidence.cleanup === 'destroy_requested'
    && evidence.rollback_error === undefined && evidence.cleanup_error === undefined;
  const code = own(error, 'code');
  try {
    if (error instanceof CoreFunctionalRuntimeUnavailableV1) {
      if ((code === 'AUTHENTICATION_REQUIRED' || code === 'ACTOR_BINDING_MISMATCH')
        && (evidence === null || settled)) return 'authentication_required';
      if (settled && (code === 'READ_SCOPE_DENIED' || code === 'SCOPE_DENIED')) return 'scope_denied';
    }
  } catch { return 'unavailable'; }
  // Only the installed canonical RAISE signatures, on a settled Core read.
  // Bare42501, messages alone, object ACL failures and unknown cleanup are not
  // enough to manufacture a caller-scope denial.
  return settled && code === '42501' && own(error, 'routine') === 'exec_stmt_raise'
    && (own(error, 'message') === 'workspace_native_context_access_denied'
      || own(error, 'message') === 'core_functional_checkpoint_denied') ? 'scope_denied' : 'unavailable';
}

export function serviceRequestReadFailureBoundaryV1(
  ports: ServiceOfferingRequestFlowPortsV1,
): ServiceOfferingRequestFlowPortsV1 {
  const read = async <T>(operation: string, call: () => Promise<T>): Promise<T> => {
    try { return await call(); }
    catch (error) {
      const decision = classify(error);
      const evidence = typeof error === 'object' && error !== null ? coreFunctionalReadFailureV1(error) : null;
      const code = own(error, 'code');
      try {
        console.error('SERVICE_REQUEST_READ_BOUNDARY', JSON.stringify({
          operation, decision,
          code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'unclassified',
          settlement: evidence?.settlement ?? 'not_observed',
          cleanup: evidence?.cleanup_error !== undefined ? 'error' : evidence?.cleanup ?? 'not_observed',
        }));
      } catch { /* A diagnostic sink must not replace the original read failure. */ }
      if (decision === 'scope_denied') throw serviceRequestReadAccessDeniedV1(error);
      if (decision === 'authentication_required') throw serviceRequestReadAuthenticationRequiredV1(error);
      throw error;
    }
  };
  return Object.freeze({
    ...ports,
    loadOffering: input => read('loadOffering', () => ports.loadOffering(input)),
    resolvePrincipal: input => read('resolvePrincipal', () => ports.resolvePrincipal(input)),
    resolveProviderAgreement: input => read('resolveProviderAgreement', () => ports.resolveProviderAgreement(input)),
    resolveCanonicalResource: input => read('resolveCanonicalResource', () => ports.resolveCanonicalResource(input)),
  });
}
