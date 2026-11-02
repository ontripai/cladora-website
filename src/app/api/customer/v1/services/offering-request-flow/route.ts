import { createServiceOfferingRequestFlowHandlers } from '@/lib/customer/service-v14-execution/http';
import { getServiceOfferingRequestRuntimeBinding } from '@/lib/customer/service-v14-execution/runtime-binding';

const handlers = createServiceOfferingRequestFlowHandlers(
  getServiceOfferingRequestRuntimeBinding(),
);

export const GET = handlers.GET;
export const POST = handlers.POST;
