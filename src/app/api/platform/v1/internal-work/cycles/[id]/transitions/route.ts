import { NextRequest } from 'next/server';
import { transitionCycleCommand, uuid } from '@/lib/platform/internal-work/contracts';
import { createPmGateway, disabledPmAdapter } from '@/lib/platform/internal-work/gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const gateway = createPmGateway(disabledPmAdapter);
const schema = transitionCycleCommand.extend({ cycle_id: uuid });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return gateway.mutate(request, schema, 'transition_cycle_internal_v1', { cycle_id: id });
}
