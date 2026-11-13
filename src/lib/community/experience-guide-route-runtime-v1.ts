/** Actual Guide route consumer of Core62f3's request-local factory. */
import 'server-only';
import {createCoreGuideRequestHandlersV1,createCoreGuideRequestBindingV1} from '../core/guide-request-binding-v1';
import {GUIDE_PLATFORM_PROVIDER_V1} from '../app/guide-platform-provider-v1';
const headers={'cache-control':'no-store, private','content-type':'application/json','vary':'Cookie'};
export const guideRuntimeUnavailableV1=()=>new Response(JSON.stringify({error:{code:'CE_GUIDE_CONNECTION_NOT_READY'}}),{status:503,headers});
async function input(request:Request){const provider=GUIDE_PLATFORM_PROVIDER_V1;
 if(!provider||provider.contract!=='guide-platform-provider.v1')return null;
 return provider.resolve(request);
}
export async function resolveGuideRequestHandlersV1(request:Request){const options=await input(request);if(!options)return null;
 // Request LAST is intentional: no provider-carried request may replace the
 // original Next Request. No handler/session/pool cache across requests.
 return createCoreGuideRequestHandlersV1({...options,request}).handlers;
}
export async function resolveGuideRequestBindingV1(request:Request){const options=await input(request);if(!options)return null;
 return createCoreGuideRequestBindingV1({...options,request});
}
