/** App-owned, server-only integration point for the official Platform handoff. */
import 'server-only';
import type {CoreGuideRequestBindingOptionsV1} from '../core/guide-request-binding-v1';
export type GuidePlatformOptionsV1=Omit<CoreGuideRequestBindingOptionsV1,'request'>;
export interface GuidePlatformProviderV1 {
 readonly contract:'guide-platform-provider.v1';
 resolve(request:Request):Promise<GuidePlatformOptionsV1|null>;
}
/** App replaces ONLY this deployment composition with Platform's accepted private
 * provider. No credentials, invented pool, SERVICE fallback, registry or env
 * discovery. NULL explicitly means native Guide is unavailable, not activated.
 */
export const GUIDE_PLATFORM_PROVIDER_V1:GuidePlatformProviderV1|null=null;
export const isGuideNativeEntrySelectedV1=()=>GUIDE_PLATFORM_PROVIDER_V1!==null;
