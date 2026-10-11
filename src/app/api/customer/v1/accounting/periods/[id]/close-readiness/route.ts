import { NextRequest } from 'next/server.js';
import { handleGetCloseReadiness } from './handler.ts';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  return handleGetCloseReadiness(request, rawParams);
}
