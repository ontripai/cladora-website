/** Server-only Platform/App handoff. Official Core input, never public configuration.
 * NULL preserves the accepted reader; a selected but unusable provider fails closed.
 * Supply only admitted CE010 target/Pool/connection model, never Guide/SERVICE. */
import 'server-only';
import type {createCoreCe010RequestRuntimeV1} from '../core/ce010-request-binding-v1';
export type Ce010PlatformProviderV1=Readonly<Parameters<typeof createCoreCe010RequestRuntimeV1>[0]>;
// No env/credential discovery, setter, synthetic pool or operational admission.
export const CE010_PLATFORM_PROVIDER_V1:Ce010PlatformProviderV1|null=null;
