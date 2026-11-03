import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { createClient } from '../supabase/server';
import {
  coreTransactionReceiptV1Schema, type CoreTransactionCommandV1,
  type CoreTransactionHostV1, type CoreTransactionResultV1,
} from '../core/postgres-transaction-host-v1';
import { createDocumentsFunctionalCommandsV1 } from './documents-functional-commands-v1';
import {
  buildDocumentsNewDocumentIntentCommandV1, buildDocumentsInitialVersionCommandV1,
  documentsNewDocumentIntentV1Schema, documentsInitialVersionV1Schema,
  verifyDocumentsStoredObjectBeforeTransactionV1, requireVerifiedDocumentsStoredObjectV1,
  type DocumentsStoredObjectVerifierV1, type DocumentsNewDocumentIntentV1, type DocumentsInitialVersionV1,
} from './documents-workspace-binding-writer-v1';
import { documentsUploadIntentAckV1Schema, documentsUploadFinalizationAckV1Schema } from './documents-upload-ui-contract-v1';
import { documentsUploadIntentRequestV1Schema, documentsUploadFinalizationRequestV1Schema,
  documentsUploadRequestSnapshotV1, serializeDocumentsUploadSnapshotV1, type DocumentsUploadSnapshotV1 } from './documents-upload-snapshot-v1';

type WriterContext = Parameters<typeof buildDocumentsNewDocumentIntentCommandV1>[1];
type ServerContext = Omit<WriterContext, 'actor_id'>;
type ServerSessionClient = Pick<Awaited<ReturnType<typeof createClient>>, 'auth'>;
const sessionSchema = z.strictObject({ actor_id: z.string().uuid(), session_id: z.string().uuid(),
  expires_at: z.number().int().positive(), aal: z.literal('aal2') });
// These are private composition arguments, NEVER parsed from a browser request.
export type DocumentsCanonicalUploadIntentPlanV1 = Readonly<{
  input: DocumentsNewDocumentIntentV1; context: ServerContext;
  snapshot: Readonly<DocumentsUploadSnapshotV1>;
}>;
export type DocumentsCanonicalUploadFinalizationPlanV1 = Readonly<{
  input: DocumentsInitialVersionV1; context: ServerContext;
}>;
const failure = (status: 'UNKNOWN' | 'NOT_READY' | 'DENIED') => Object.freeze({ status, ack: null });

function matchedReceipt(result: CoreTransactionResultV1, command: CoreTransactionCommandV1, mutationId: string) {
  if (result.status !== 'committed' && result.status !== 'exact_replay') return null;
  const parsed = coreTransactionReceiptV1Schema.safeParse(result.receipt);
  if (!parsed.success) return null;
  const r = parsed.data, a = r.authority;
  if (r.transaction_id !== command.transaction_id || r.command_id !== command.command_id
    || r.workspace_id !== command.workspace_id || r.actor_id !== command.actor_id
    || r.idempotency_key !== command.idempotency_key || r.input_fingerprint !== command.input_fingerprint
    || r.aggregate_type !== command.aggregate_type || r.aggregate_id !== command.aggregate_id
    || r.aggregate_version !== command.aggregate_version || r.mutation_id !== mutationId
    || a.decision !== 'allowed' || !a.rechecked_after_lock || a.context_id !== command.context_id
    || a.workspace_id !== command.workspace_id || a.actor_id !== command.actor_id
    || a.authority_version !== command.authority_version || a.permission_code !== command.permission_code
    || a.module_code !== command.module_code || a.evaluation_purpose !== command.evaluation_purpose
    || a.transaction_context.transaction_id !== command.transaction_id
    || a.transaction_context.command_id !== command.command_id
    || a.transaction_context.lock.workspace_id !== command.workspace_id
    || a.entitlement?.workspace_id !== command.workspace_id || a.entitlement.module_code !== command.module_code
    || a.entitlement.authority_revision !== command.authority_version) return null;
  return r;
}

/** Private, inactive server adapter. The injected host MUST be the existing
 * request-local Core/role-bound composition. No route invokes this factory yet.
 * No caller result/receipt/actor, injected commands implementation, fallback host,
 * retry, store, ledger, session generator or Storage measurement is accepted.
 */
export function createDocumentsCanonicalUploadAckAdapterV1(deps: Readonly<{
  host: CoreTransactionHostV1;
  sessionClient: ServerSessionClient;
  verifyStoredObject: DocumentsStoredObjectVerifierV1;
}>) {
  const commands = createDocumentsFunctionalCommandsV1(deps.host);
  async function session() {
    // getUser verifies at the Auth server; getClaims verifies the session token.
    // Neither getSession nor decoded/caller claims can supply the actor.
    const user = await deps.sessionClient.auth.getUser();
    const token = await deps.sessionClient.auth.getClaims();
    if (user.error || token.error || !user.data.user || !token.data?.claims
      || token.data.claims.sub !== user.data.user.id) throw new Error('session unavailable');
    const identity = sessionSchema.parse({ actor_id: user.data.user.id, session_id: token.data.claims.session_id,
      expires_at: token.data.claims.exp, aal: token.data.claims.aal });
    if (identity.expires_at * 1000 <= Date.now()) throw new Error('session expired');
    return identity;
  }
  async function sameSession(expected: z.infer<typeof sessionSchema>) {
    const current = await session();
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('session changed');
  }
  return Object.freeze({
    async issue(raw: unknown, serverPlan: DocumentsCanonicalUploadIntentPlanV1) {
      try {
        const request = documentsUploadIntentRequestV1Schema.safeParse(raw);
        if (!request.success) return failure('DENIED');
        const snapshot = Object.freeze(documentsUploadRequestSnapshotV1(request.data));
        const serialized = serializeDocumentsUploadSnapshotV1(snapshot);
        const hash = createHash('sha256').update(serialized, 'utf8').digest('hex');
        // property_id is not persisted by the accepted initial writer. Never
        // acknowledge an ignored property. Replacement versions are separate.
        if (hash !== request.data.request_sha256 || snapshot.property_id !== null
          || serialized !== serializeDocumentsUploadSnapshotV1(serverPlan.snapshot)) return failure('DENIED');
        const intent = Object.freeze(documentsNewDocumentIntentV1Schema.parse(serverPlan.input));
        if (intent.context_id !== snapshot.context_id || intent.workspace_id !== snapshot.workspace_id
          || intent.filename !== snapshot.filename || intent.declared_mime_type !== snapshot.declared_mime
          || intent.max_size_bytes !== snapshot.size_bytes || intent.idempotency_key !== request.data.idempotency_key) return failure('DENIED');
        const serverContext = Object.freeze({ ...serverPlan.context });
        const identity = await session();
        const ctx = Object.freeze({ ...serverContext, actor_id: identity.actor_id });
        const command = buildDocumentsNewDocumentIntentCommandV1(intent, ctx);
        await sameSession(identity); // after Auth waits and before dispatch
        const result = await commands.issueNewIntent(intent, ctx);
        if (result.status === 'unknown_commit') return failure('UNKNOWN');
        const receipt = matchedReceipt(result, command, intent.intent_id);
        if (!receipt) return failure(result.status === 'denied' ? 'DENIED' : 'UNKNOWN');
        await sameSession(identity); // no ACK after a changed/expired session
        if (Date.parse(intent.expires_at) <= Date.now()) return failure('UNKNOWN');
        const ack = documentsUploadIntentAckV1Schema.parse({ contract_version: 'documents-upload-intent-ack.v1',
          context_id: snapshot.context_id, workspace_id: snapshot.workspace_id, actor_id: identity.actor_id,
          request_sha256: hash, idempotency_key: intent.idempotency_key,
          intent_id: receipt.mutation_id, prospective_document_id: receipt.aggregate_id });

        // Captured immutable snapshot + real issue result, not a caller token or
        // parallel persistent store. This private method cannot cross HTTP or be
        // reconstructed from JSON. Durable reconstruction is a Core15 gate.
        let pinnedFinalization: string | null = null;
        let pinnedFingerprint: string | null = null;
        let finalizing = false;
        return Object.freeze({ status: 'ACK' as const, ack,
          async finalize(rawFinalization: unknown, privatePlan: DocumentsCanonicalUploadFinalizationPlanV1) {
            if (finalizing) return failure('UNKNOWN');
            finalizing = true;
            try {
              const parsed = documentsUploadFinalizationRequestV1Schema.safeParse(rawFinalization);
              if (!parsed.success) return failure('DENIED');
              const finalRequest = parsed.data;
              const finalSerialized = serializeDocumentsUploadSnapshotV1(documentsUploadRequestSnapshotV1(finalRequest));
              const finalHash = createHash('sha256').update(finalSerialized, 'utf8').digest('hex');
              if (finalSerialized !== serialized || finalHash !== hash || finalHash !== finalRequest.request_sha256
                || finalRequest.intent_id !== intent.intent_id) return failure('DENIED');
              const input = Object.freeze(documentsInitialVersionV1Schema.parse(privatePlan.input));
              if (input.context_id !== snapshot.context_id || input.workspace_id !== snapshot.workspace_id
                || input.intent_id !== intent.intent_id || input.document_id !== intent.prospective_document_id
                || input.title !== snapshot.title || input.document_type !== snapshot.document_type
                || input.classification !== snapshot.classification || input.idempotency_key !== finalRequest.idempotency_key) return failure('DENIED');
              const context = Object.freeze({ ...privatePlan.context, actor_id: identity.actor_id });
              const planIdentity = JSON.stringify({ input, context });
              if (pinnedFinalization !== null && pinnedFinalization !== planIdentity) return failure('DENIED');
              pinnedFinalization = planIdentity;
              await sameSession(identity);
              if (Date.parse(intent.expires_at) <= Date.now()) return failure('UNKNOWN');
              const object = await verifyDocumentsStoredObjectBeforeTransactionV1(
                { bucket_id: 'document-vault', object_path: intent.object_path }, deps.verifyStoredObject);
              const measurement = requireVerifiedDocumentsStoredObjectV1(object);
              await sameSession(identity); // Storage/verification is an unbounded external wait.
              if (Date.parse(intent.expires_at) <= Date.now() || measurement.size_bytes !== snapshot.size_bytes
                || measurement.detected_mime_type !== snapshot.declared_mime) return failure('UNKNOWN');
              const expected = buildDocumentsInitialVersionCommandV1(input, context, object);
              if (pinnedFingerprint !== null && pinnedFingerprint !== expected.input_fingerprint) return failure('UNKNOWN');
              pinnedFingerprint = expected.input_fingerprint;
              // Existing host rechecks canonical authority/AAL2 and intent expiry
              // after its locks; canonical provider owns mutation/replay/scan deferred.
              const finalized = await commands.finalizeInitial(input, context, object);
              if (finalized.status === 'unknown_commit') return failure('UNKNOWN');
              const committed = matchedReceipt(finalized, expected, input.version_id);
              if (!committed) return failure(finalized.status === 'denied' ? 'DENIED' : 'UNKNOWN');
              await sameSession(identity);
              if (Date.parse(intent.expires_at) <= Date.now()) return failure('UNKNOWN');
              const { contract_version, receipt_id, workspace_id, actor_id, aggregate_type, aggregate_id,
                aggregate_version, mutation_id, idempotency_key, committed_at } = committed;
              const projection = documentsUploadFinalizationAckV1Schema.parse({
                contract_version: 'documents-upload-finalization-ack.v1', status: finalized.status,
                context_id: snapshot.context_id, workspace_id, actor_id, request_sha256: finalHash,
                intent_id: input.intent_id, document_id: input.document_id, document_version_id: mutation_id,
                receipt: { contract_version, receipt_id, workspace_id, actor_id, aggregate_type,
                  aggregate_id, aggregate_version, mutation_id, idempotency_key, committed_at },
              });
              return Object.freeze({ status: 'ACK' as const, ack: projection });
            } catch { return failure('UNKNOWN'); }
            finally { finalizing = false; }
          },
        });
      } catch { return failure('UNKNOWN'); }
    },
  });
}
