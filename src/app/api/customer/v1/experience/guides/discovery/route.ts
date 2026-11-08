import type {NextRequest} from 'next/server';
import {readGuideDiscoveryV1} from '@/lib/community/experience-guide-discovery-v1';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>readGuideDiscoveryV1(request);
