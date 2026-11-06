import 'server-only';
import type { ServiceOfferingRequestFlowPortsV1 } from './application-flow';
import type { ServiceOfferingRequestFlowPortResolverV1 } from './http';
import { getCore15PrivateServiceDevelopmentBindingV1 } from '../../core/private-service-development-binding-v1';
import { serviceRequestReadFailureBoundaryV1 } from './read-failure-boundary';

export const SERVICE_FUNCTIONAL_REQUEST_RUNTIME_CONTRACT_V1 =
  'service-functional-request-runtime.v1' as const;

/**
 * Exact activation seam owned jointly by Core15 and Platform12. The producer
 * must authenticate the request, bind one current server session to an owned
 * role-scoped database lease, and return request-local ports. A process-global
 * principal, client identity, service_role client, or legacy RPC is invalid.
 */
export interface ServiceFunctionalRequestRuntimeBindingV1 {
  readonly contract_version: typeof SERVICE_FUNCTIONAL_REQUEST_RUNTIME_CONTRACT_V1;
  readonly core_contract: 'core15-service-request-runtime.v1';
  readonly database_contract: 'platform12-service-request-database.v1';
  bind(request: Request): Promise<ServiceOfferingRequestFlowPortsV1 | null>;
}

/** Populated only by the accepted Core15 + Platform12 composition package. */
export const SERVICE_FUNCTIONAL_REQUEST_RUNTIME_BINDING:
  ServiceFunctionalRequestRuntimeBindingV1 | null = getCore15PrivateServiceDevelopmentBindingV1();

/**
 * Activation boundary. The application route is intentionally fail-closed until
 * Core supplies accepted S01/S02/S03 readers and the accepted transaction host
 * is installed for this exact package. No service-role or legacy RPC fallback is
 * permitted here.
 */
export function getServiceOfferingRequestRuntimeBinding(): ServiceOfferingRequestFlowPortResolverV1 {
  return async request => {
    const binding = SERVICE_FUNCTIONAL_REQUEST_RUNTIME_BINDING;
    if (binding === null
      || binding.contract_version !== SERVICE_FUNCTIONAL_REQUEST_RUNTIME_CONTRACT_V1
      || binding.core_contract !== 'core15-service-request-runtime.v1'
      || binding.database_contract !== 'platform12-service-request-database.v1') {
      return null;
    }
    const ports = await binding.bind(request);
    return ports === null ? null : serviceRequestReadFailureBoundaryV1(ports);
  };
}
