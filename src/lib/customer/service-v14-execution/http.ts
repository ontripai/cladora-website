import { NextRequest, NextResponse } from 'next/server';
import {
  preflightServiceOfferingRequestV1,
  submitServiceOfferingRequestV1,
  type ServiceOfferingRequestFlowPortsV1,
} from './application-flow';
import {
  serviceOfferingRequestPreflightInputV1Schema,
  serviceOfferingRequestPublicInputV1Schema,
} from '../service-offering-request-flow-contract';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const MAX_BODY_BYTES = 32 * 1024;
const CORE_AUTH_FAILURE_CODES = new Set(['AUTHENTICATION_REQUIRED', 'ACTOR_BINDING_MISMATCH']);

export type ServiceOfferingRequestFlowPortResolverV1 = (
  request: NextRequest,
) => Promise<ServiceOfferingRequestFlowPortsV1 | null>;

type ServiceOfferingRequestFlowBindingV1 =
  | ServiceOfferingRequestFlowPortsV1
  | ServiceOfferingRequestFlowPortResolverV1
  | null;

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}

function resolverFailure(error: unknown) {
  let code: unknown;
  if (typeof error === 'object' && error !== null) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
      code = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    } catch {
      code = undefined;
    }
  }
  return typeof code === 'string' && CORE_AUTH_FAILURE_CODES.has(code)
    ? failure('UNAUTHORIZED', 401)
    : failure('RUNTIME_BINDING_INACTIVE', 503);
}

function preflightResponse(result: Awaited<ReturnType<typeof preflightServiceOfferingRequestV1>>) {
  if (result.status === 'ready') return NextResponse.json(result, { headers: HEADERS });
  if (result.status === 'conflict') return failure(result.code, 409);
  if (result.status === 'not_ready') return failure(result.code, 503);
  return failure(result.code, 403);
}

export function createServiceOfferingRequestFlowHandlers(
  binding: ServiceOfferingRequestFlowBindingV1,
) {
  const resolvePorts = async (request: NextRequest) => {
    if (binding === null) return null;
    return typeof binding === 'function' ? binding(request) : binding;
  };
  return {
    async GET(request: NextRequest) {
      const query = request.nextUrl.searchParams;
      if (query.getAll('context_id').length !== 1
        || query.getAll('workspace_id').length !== 1
        || query.getAll('offering_id').length !== 1
        || query.getAll('published_revision_id').length !== 1
        || Array.from(query.keys()).some(key => ![
          'context_id', 'workspace_id', 'offering_id', 'published_revision_id',
        ].includes(key))) return failure('INVALID_REQUEST', 400);
      const input = serviceOfferingRequestPreflightInputV1Schema.safeParse({
        context_id: query.get('context_id'),
        workspace_id: query.get('workspace_id'),
        offering_id: query.get('offering_id'),
        published_revision_id: query.get('published_revision_id'),
      });
      if (!input.success) return failure('INVALID_REQUEST', 400);
      let ports: ServiceOfferingRequestFlowPortsV1 | null;
      try {
        ports = await resolvePorts(request);
      } catch (error) {
        return resolverFailure(error);
      }
      if (ports === null) return failure('RUNTIME_BINDING_INACTIVE', 503);
      return preflightResponse(await preflightServiceOfferingRequestV1(input.data, ports));
    },

    async POST(request: NextRequest) {
      if (request.nextUrl.search) return failure('INVALID_REQUEST', 400);
      const origin = request.headers.get('origin');
      if (origin && origin !== request.nextUrl.origin) return failure('INVALID_ORIGIN', 403);
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return failure('INVALID_REQUEST', 400);
      }
      const declaredLength = Number(request.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return failure('REQUEST_TOO_LARGE', 413);
      }
      let text: string;
      try {
        text = await request.text();
      } catch {
        return failure('INVALID_REQUEST', 400);
      }
      if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return failure('REQUEST_TOO_LARGE', 413);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return failure('INVALID_REQUEST', 400);
      }
      const input = serviceOfferingRequestPublicInputV1Schema.safeParse(body);
      if (!input.success) return failure('INVALID_REQUEST', 400);
      let ports: ServiceOfferingRequestFlowPortsV1 | null;
      try {
        ports = await resolvePorts(request);
      } catch (error) {
        return resolverFailure(error);
      }
      if (ports === null) return failure('RUNTIME_BINDING_INACTIVE', 503);
      const result = await submitServiceOfferingRequestV1(input.data, ports);
      if (result.status === 'submitted') {
        return NextResponse.json({ request_id: result.request_id, status: 'submitted' }, { headers: HEADERS });
      }
      if (result.status === 'conflict') return failure(result.code, 409);
      if (result.status === 'not_ready' || result.status === 'unknown') return failure(result.code, 503);
      return failure(result.code, 403);
    },
  };
}
