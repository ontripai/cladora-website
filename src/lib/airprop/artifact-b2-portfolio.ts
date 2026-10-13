import { managementPortfolioQueryV1Schema, managementPortfolioResponseV1Schema } from './commercial-lifecycle-v1';

/** The existing actor-bound customer_api client; never a service-role fallback. */
export type AirpropB2PortfolioGateway = {
  rpc(name: 'read_airprop_management_portfolio_v1', parameters: { p_context_id: string; p_workspace_id: string }):
    PromiseLike<{ data: unknown; error: unknown }>;
};

/** Artifact A owns authorization and the read transaction. No cached allow or secondary authority. */
export async function readAirpropB2Portfolio(gateway: AirpropB2PortfolioGateway, queryValue: unknown) {
  const query = managementPortfolioQueryV1Schema.safeParse(queryValue);
  if (!query.success) return { status: 'denied', code: 'INVALID_REQUEST' } as const;
  try {
    const response = await gateway.rpc('read_airprop_management_portfolio_v1', {
      p_context_id: query.data.context_id, p_workspace_id: query.data.workspace_id,
    });
    if (response.error) return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' } as const;
    const view = managementPortfolioResponseV1Schema.safeParse(response.data);
    if (!view.success) return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' } as const;
    return { status: 'read', view: view.data } as const;
  } catch { return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' } as const; }
}
