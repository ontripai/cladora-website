import { NextRequest } from 'next/server.js';
import { handleGetLedger } from './handler.ts';

export async function GET(request: NextRequest) {
  return handleGetLedger(request);
}
