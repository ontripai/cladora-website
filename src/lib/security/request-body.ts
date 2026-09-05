import { NextRequest, NextResponse } from 'next/server.js';

export const MAX_LEAD_BODY_BYTES = 32 * 1024; // 32 KB

/**
 * Enforces that the request Content-Type is application/json (optionally with charset parameters).
 * Rejects all other Content-Types with 415 Unsupported Media Type.
 */
export function isApplicationJson(contentType: string | null): boolean {
  if (!contentType) return false;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return mime === 'application/json';
}

/**
 * Safely parses request body JSON while enforcing strict byte limits.
 * Protects against memory exhaustion and payload stuffing attacks.
 *
 * Rejects with 413 Payload Too Large if the body exceeds maxBytes.
 */
export async function parseJsonWithLimit<T>(
  request: NextRequest,
  maxBytes: number = MAX_LEAD_BODY_BYTES
): Promise<{ data?: T; errorResponse?: NextResponse }> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return {
      errorResponse: NextResponse.json(
        {
          ok: false,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size.',
        },
        { status: 413 }
      ),
    };
  }

  if (!request.body) {
    return {
      errorResponse: NextResponse.json(
        {
          ok: false,
          code: 'EMPTY_BODY',
          message: 'Request body is empty.',
        },
        { status: 400 }
      ),
    };
  }

  try {
    const reader = request.body.getReader();
    let bytesRead = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytesRead += value.length;
        if (bytesRead > maxBytes) {
          return {
            errorResponse: NextResponse.json(
              {
                ok: false,
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request payload exceeds maximum allowed size.',
              },
              { status: 413 }
            ),
          };
        }
        chunks.push(value);
      }
    }

    const totalBuffer = Buffer.concat(chunks);
    if (totalBuffer.length === 0) {
      return {
        errorResponse: NextResponse.json(
          {
            ok: false,
            code: 'EMPTY_BODY',
            message: 'Request body is empty.',
          },
          { status: 400 }
        ),
      };
    }

    const parsed = JSON.parse(totalBuffer.toString('utf8'));
    return { data: parsed as T };
  } catch (err: unknown) {
    return {
      errorResponse: NextResponse.json(
        {
          ok: false,
          code: 'INVALID_JSON',
          message: 'Malformed JSON payload.',
        },
        { status: 400 }
      ),
    };
  }
}
