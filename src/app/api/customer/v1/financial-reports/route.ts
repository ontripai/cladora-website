import { NextRequest } from 'next/server.js';
import { handleGetFinancialReport } from './handler.ts';

export async function GET(request: NextRequest) {
  return handleGetFinancialReport(request);
}
