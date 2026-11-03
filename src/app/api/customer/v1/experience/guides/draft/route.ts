import {createCe012FunctionalHandlersV1,ce012FunctionalDependenciesV1} from '@/lib/community/experience-guide-functional-http-v1';
export const runtime='nodejs';
const handlers=createCe012FunctionalHandlersV1(ce012FunctionalDependenciesV1);
export const GET=handlers.GET;
export const POST=handlers.POST;
