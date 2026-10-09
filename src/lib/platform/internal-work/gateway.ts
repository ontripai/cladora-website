import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import type { PmRuntimeAdapter, PmFunctionName } from './postgres-adapter';
import { listPackagesQuery, uuid, type PmCommand } from './contracts';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export const PM01_RUNTIME_ROUTES_ENABLED = false;

type Caller = { userId: string; aal: 'aal1' | 'aal2' };
type CallerResolver = () => Promise<Caller | null>;

async function resolveCaller(): Promise<Caller | null> {
  const client = await createClient();
  const result = await client.auth.getClaims();
  const claims = result.data?.claims;
  const sub = claims?.sub;
  if (result.error || !sub) return null;
  return { userId: sub, aal: claims.aal === 'aal2' ? 'aal2' : 'aal1' };
}

function disabled() {
  return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404, headers: HEADERS });
}

function withPrivateHeaders(response: NextResponse) {
  for (const [name, value] of Object.entries(HEADERS)) response.headers.set(name, value);
  return response;
}

function errorResponse(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === '42501') return NextResponse.json({ error: { code: 'ACCESS_DENIED' } }, { status: 403, headers: HEADERS });
  if (code === '40001' || code === '23505') return NextResponse.json({ error: { code: 'CONFLICT' } }, { status: 409, headers: HEADERS });
  if (code === 'P0002') return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404, headers: HEADERS });
  if (code === '22023' || code === '22P02') return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: HEADERS });
  return NextResponse.json({ error: { code: 'PM_RUNTIME_FAILED' } }, { status: 500, headers: HEADERS });
}

export function createPmGateway(
  adapter: PmRuntimeAdapter,
  options: { enabled?: boolean; resolveCaller?: CallerResolver } = {}
) {
  const enabled = options.enabled ?? PM01_RUNTIME_ROUTES_ENABLED;
  const callerResolver = options.resolveCaller ?? resolveCaller;

  async function caller(mutation: boolean) {
    const value = await callerResolver();
    if (!value) return { response: NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS }) };
    if (mutation && value.aal !== 'aal2') {
      return { response: NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers: HEADERS }) };
    }
    return { value };
  }

  return {
    async list(request: NextRequest) {
      if (!enabled) return disabled();
      const parsed = listPackagesQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
      if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_QUERY' } }, { status: 400, headers: HEADERS });
      const auth = await caller(false);
      if ('response' in auth) return auth.response;
      try {
        return NextResponse.json(await adapter.listPackages(auth.value.userId, parsed.data), { headers: HEADERS });
      } catch (error) { return errorResponse(error); }
    },
    async get(request: NextRequest, packageId: string) {
      if (!enabled) return disabled();
      const programId = request.nextUrl.searchParams.get('program_id') ?? '';
      const parsedProgram = uuid.safeParse(programId);
      if (!parsedProgram.success || !uuid.safeParse(packageId).success) {
        return NextResponse.json({ error: { code: 'INVALID_QUERY' } }, { status: 400, headers: HEADERS });
      }
      const auth = await caller(false);
      if ('response' in auth) return auth.response;
      try {
        return NextResponse.json(await adapter.getPackage(auth.value.userId, parsedProgram.data, packageId), { headers: HEADERS });
      } catch (error) { return errorResponse(error); }
    },
    async mutate(request: NextRequest, schema: ZodType, functionName: PmFunctionName, additions: Record<string, string> = {}) {
      if (!enabled) return disabled();
      if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'BAD_ORIGIN' } }, { status: 403, headers: HEADERS });
      if (!isApplicationJson(request.headers.get('content-type'))) {
        return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, { status: 415, headers: HEADERS });
      }
      const parsedBody = await parseJsonWithLimit<unknown>(request, 16 * 1024);
      if (parsedBody.errorResponse) return withPrivateHeaders(parsedBody.errorResponse);
      const parsed = schema.safeParse({ ...(parsedBody.data as object), ...additions });
      if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: HEADERS });
      const auth = await caller(true);
      if ('response' in auth) return auth.response;
      try {
        return NextResponse.json(await adapter.execute(auth.value.userId, functionName, parsed.data as PmCommand), { headers: HEADERS });
      } catch (error) { return errorResponse(error); }
    },
  };
}

export const disabledPmAdapter: PmRuntimeAdapter = {
  async listPackages() { throw new Error('PM runtime route is disabled'); },
  async getPackage() { throw new Error('PM runtime route is disabled'); },
  async execute() { throw new Error('PM runtime route is disabled'); },
};
