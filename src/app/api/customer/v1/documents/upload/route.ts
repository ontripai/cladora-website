import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapDocumentsRpcError } from "@/lib/customer/documents-api-helper";
import { processUploadStream } from "@/lib/customer/documents-stream-handler";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from "@/lib/customer/documents-schema";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: HEADERS }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  let contextId = "";
  let intentId = "";
  let title = "";
  let documentType = "general";
  let classification = "internal";
  let propertyId: string | null = null;
  let declaredMime = "application/pdf";
  let fileStream: ReadableStream<Uint8Array> | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    contextId = (formData.get("context_id") as string) || "";
    intentId = (formData.get("intent_id") as string) || "";
    title = (formData.get("title") as string) || "";
    documentType = (formData.get("document_type") as string) || "general";
    classification = (formData.get("classification") as string) || "internal";
    propertyId = (formData.get("property_id") as string) || null;
    declaredMime = (formData.get("declared_mime") as string) || "application/pdf";

    const file = formData.get("file");
    if (file && typeof file === "object" && "stream" in file) {
      fileStream = (file as Blob).stream();
      if ((file as File).name && !title) {
        title = (file as File).name;
      }
    }
  } else {
    // Stream directly via headers
    contextId = request.headers.get("x-cladora-context-id") || "";
    intentId = request.headers.get("x-cladora-intent-id") || "";
    title = request.headers.get("x-cladora-title") || "";
    documentType = request.headers.get("x-cladora-document-type") || "general";
    classification = request.headers.get("x-cladora-classification") || "internal";
    propertyId = request.headers.get("x-cladora-property-id") || null;
    declaredMime = request.headers.get("x-cladora-declared-mime") || "application/pdf";
    fileStream = request.body;
  }

  if (!contextId || !intentId) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "context_id and intent_id are required" } },
      { status: 400, headers: HEADERS }
    );
  }

  if (!fileStream) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "File stream is missing" } },
      { status: 400, headers: HEADERS }
    );
  }

  // 1. Process bounded stream and compute server SHA-256
  let streamResult;
  let bufferedChunks: Uint8Array[];
  try {
    const processed = await processUploadStream(fileStream, declaredMime, MAX_DOCUMENT_FILE_SIZE_BYTES);
    streamResult = processed.result;
    bufferedChunks = processed.chunks;
  } catch (err: any) {
    const msg = err?.message || "Stream processing failed";
    return NextResponse.json(
      { error: { code: "STREAM_PROCESSING_ERROR", message: msg } },
      { status: 400, headers: HEADERS }
    );
  }

  // 2. Fetch upload intent to verify path and authorization
  const { data: intentData } = await (supabase.schema("documents") as any)
    .from("upload_intents")
    .select("object_path, bucket_id, status, max_size_bytes")
    .eq("id", intentId)
    .single();

  const objectPath: string = String(intentData?.object_path || `documents/${intentId}/file`);
  const bucketId: string = String(intentData?.bucket_id || "document-vault");

  // 3. Upload bytes to storage bucket using authenticated client
  // Flatten chunks into Buffer
  const totalLength = bufferedChunks.reduce((acc, c) => acc + c.length, 0);
  const fullBuffer = Buffer.alloc(totalLength);
  let offset = 0;
  for (const c of bufferedChunks) {
    fullBuffer.set(c, offset);
    offset += c.length;
  }

  const { error: storageError } = await supabase.storage
    .from(bucketId)
    .upload(objectPath, fullBuffer, {
      contentType: streamResult.detectedMime,
      upsert: false,
    });

  if (storageError && !storageError.message.includes("already exists")) {
    // If upload fails, mark intent or fail closed
    return NextResponse.json(
      { error: { code: "STORAGE_UPLOAD_FAILED", message: storageError.message } },
      { status: 500, headers: HEADERS }
    );
  }

  // 4. Finalize upload via customer_api RPC with real server-computed SHA-256
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("finalize_upload_v1", {
    p_context_id: contextId,
    p_intent_id: intentId,
    p_computed_sha256: streamResult.serverSha256,
    p_actual_size_bytes: streamResult.totalBytes,
    p_detected_mime: streamResult.detectedMime,
    p_title: title || "Untitled Document",
    p_document_type: documentType,
    p_classification: classification,
    p_property_id: propertyId,
  });

  if (error) {
    const { status, body } = mapDocumentsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
