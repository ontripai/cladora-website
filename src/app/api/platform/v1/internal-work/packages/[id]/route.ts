import { NextRequest } from 'next/server';
import { createPmGateway, disabledPmAdapter } from '@/lib/platform/internal-work/gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const gateway = createPmGateway(disabledPmAdapter);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return gateway.get(request, id);
}
