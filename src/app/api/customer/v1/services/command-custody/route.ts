import { NextRequest, NextResponse } from 'next/server';
import { serviceRequestCustodyOwner } from '@/lib/customer/service-v14-execution/custody-owner';

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
export async function GET(request: NextRequest) {
  if (request.nextUrl.search) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  try {
    const owner = await serviceRequestCustodyOwner(request);
    return NextResponse.json({ contract: 'service-request-custody-owner.v1', owner }, { headers });
  } catch (error) {
    let code: unknown;
    try { code = typeof error === 'object' && error !== null ? Object.getOwnPropertyDescriptor(error, 'code')?.value : undefined; }
    catch { code = undefined; }
    const auth = code === 'AUTHENTICATION_REQUIRED' || code === 'ACTOR_BINDING_MISMATCH';
    return NextResponse.json({ error: { code: auth ? 'UNAUTHORIZED' : 'RUNTIME_BINDING_INACTIVE' } }, { status: auth ? 401 : 503, headers });
  }
}
