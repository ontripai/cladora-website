import 'server-only';
import type { ServiceOfferingRequestFlowPortsV1 } from './application-flow';

/**
 * Activation boundary. The application route is intentionally fail-closed until
 * Core supplies accepted S01/S02/S03 readers and the accepted transaction host
 * is installed for this exact package. No service-role or legacy RPC fallback is
 * permitted here.
 */
export function getServiceOfferingRequestRuntimeBinding(): ServiceOfferingRequestFlowPortsV1 | null {
  return null;
}
