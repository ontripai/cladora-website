import crypto from "node:crypto";
import { inspectMagicBytes } from "./documents-api-helper.ts";
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from "./documents-schema.ts";

export interface StreamProcessingResult {
  serverSha256: string;
  totalBytes: number;
  detectedMime: string;
}

/**
 * Reads a stream chunk-by-chunk with bounded memory (supporting Web Streams and AsyncIterables),
 * computing SHA-256 in real-time, verifying magic bytes on the first chunk,
 * and rejecting uploads exceeding max allowed bytes.
 */
export async function processUploadStream(
  stream: any,
  declaredMime: string,
  maxSizeBytes: number = MAX_DOCUMENT_FILE_SIZE_BYTES
): Promise<{
  result: StreamProcessingResult;
  chunks: Uint8Array[];
}> {
  const hash = crypto.createHash("sha256");
  let totalBytes = 0;
  const chunks: Uint8Array[] = [];

  const handleChunk = (chunk: Uint8Array) => {
    if (!chunk || chunk.length === 0) return;

    totalBytes += chunk.length;
    if (totalBytes > maxSizeBytes) {
      throw new Error("file_size_limit_exceeded");
    }

    hash.update(chunk);
    chunks.push(chunk);

  };

  if (typeof stream?.getReader === "function") {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        handleChunk(value);
      }
    } finally {
      reader.releaseLock();
    }
  } else if (stream && Symbol.asyncIterator in stream) {
    for await (const chunk of stream) {
      handleChunk(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    }
  } else {
    throw new Error("unsupported_stream_type");
  }

  if (totalBytes === 0) {
    throw new Error("zero_byte_upload_rejected");
  }

  const inspection = inspectMagicBytes(Buffer.concat(chunks), declaredMime);
  if (!inspection.success) throw new Error(`mime_inspection_failed: ${inspection.reason}`);
  if (declaredMime && inspection.mime !== declaredMime) {
    throw new Error(`mime_mismatch_detected: declared=${declaredMime}, detected=${inspection.mime}`);
  }

  const serverSha256 = hash.digest("hex");

  return {
    result: {
      serverSha256,
      totalBytes,
      detectedMime: inspection.mime,
    },
    chunks,
  };
}
