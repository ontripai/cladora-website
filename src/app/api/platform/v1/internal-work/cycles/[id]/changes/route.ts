import { NextRequest } from 'next/server';
import { changeCommand } from '@/lib/platform/internal-work/contracts';
import { createPmGateway, disabledPmAdapter } from '@/lib/platform/internal-work/gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const gateway = createPmGateway(disabledPmAdapter);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return gateway.mutate(request, changeCommand, 'request_change_internal_v1', { source_cycle_id: id });
}
