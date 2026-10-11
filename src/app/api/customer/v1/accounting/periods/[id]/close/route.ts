import { NextRequest } from 'next/server.js';
import { handlePostClose } from './handler.ts';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  return handlePostClose(request, rawParams);
}
