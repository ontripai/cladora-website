import type {NextRequest} from 'next/server';
import {resolveGuideRequestHandlersV1,guideRuntimeUnavailableV1} from '@/lib/community/experience-guide-route-runtime-v1';
export const runtime='nodejs';
export async function GET(request:NextRequest){try{const handlers=await resolveGuideRequestHandlersV1(request);return handlers?await handlers.GET(request):guideRuntimeUnavailableV1();}catch{return guideRuntimeUnavailableV1();}}
export async function POST(request:NextRequest){try{const handlers=await resolveGuideRequestHandlersV1(request);return handlers?await handlers.POST(request):guideRuntimeUnavailableV1();}catch{return guideRuntimeUnavailableV1();}}
