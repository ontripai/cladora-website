import { NextRequest } from 'next/server';
import { createPmGateway, disabledPmAdapter } from '@/lib/platform/internal-work/gateway';
import { registerPackageCommand } from '@/lib/platform/internal-work/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const gateway = createPmGateway(disabledPmAdapter);

export function GET(request: NextRequest) {
  return gateway.list(request);
}

export function POST(request: NextRequest) {
  return gateway.mutate(request, registerPackageCommand, 'register_package_internal_v1');
}
