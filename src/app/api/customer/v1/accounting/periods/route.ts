import { NextRequest } from 'next/server.js';
import { handleGetPeriods } from './handler.ts';

export async function GET(request: NextRequest) {
  return handleGetPeriods(request);
}
