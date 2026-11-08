import { z } from 'zod';
import { selectCurrentUnitPropertyV1, currentUnitPropertySelectorRequestV1Schema } from '../core/current-unit-property-selector-v1';
import { currentAuthorityTransactionDecisionReceiptV1Schema } from '../core/current-authority-transaction-port-v1';
import type { CoreTransactionScopeV1 } from '../core/postgres-transaction-host-v1';
import { listingScopeSchema, sameId, sameSelection, type ListingScope } from './listing-flow-contract-v1';
import { readListingFlow, type ListingSourceRead } from './listing-flow-read-v1';
import type { readListingSelectedBindingV1 } from './listing-selected-binding-v1';
export type ListingSelectedBindingReaderV1 = typeof readListingSelectedBindingV1;

export const LISTING_NATIVE_READ_SOURCE = 'airprop.market_listings.read.v1' as const;
const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)));
// Preserve PostgreSQL microseconds at ordering boundaries; Date.parse alone truncates them.
function instant(value: string): bigint {
  const parsed = timestamp.parse(value);
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(parsed)?.[1] ?? '';
  if (fraction.length > 6) throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
  const withoutFraction = parsed.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, '');
  return BigInt(Date.parse(withoutFraction)) * BigInt(1000) + BigInt(fraction.padEnd(6, '0'));
}
const scopeSchema = listingScopeSchema.extend({ actor_id: uuid, tenant_id: uuid });
const rowSchema = z.strictObject({
  listing_id: uuid, tenant_id: uuid, workspace_id: uuid, property_id: uuid, unit_id: uuid,
  listing_version: z.number().int().positive().safe(), status: z.enum(['published', 'withdrawn', 'reserved']),
  available_from: timestamp, available_until: timestamp.nullable(),
});
type Row = z.infer<typeof rowSchema>;
type ServerScope = z.infer<typeof scopeSchema>;
const pageSchema = z.strictObject({ limit: z.number().int().min(1).max(100), cursor: scopeSchema.extend({ after_id: uuid }).nullable() });
export class ListingNativeReadUnavailable extends Error {
  constructor(readonly reason: 'HOST_NOT_READY' | 'CANONICAL_PRODUCER_NOT_READY' | 'SCOPE_DENIED' | 'SOURCE_INVALID'
    | 'SELECTOR_DENIED' | 'CANONICAL_WITHHELD' | 'SOURCE_DRIFT' | 'CURRENTNESS_UNPROVEN') { super(reason); }
}
/** Existing rows only. No user SQL, total count, OFFSET or dynamic order identifier.
 * Logical SELECT-only; FOR SHARE requires a lock-capable transaction, not PG READ ONLY.
 * Existing AP01 writer takes FOR UPDATE on this same Listing row. */
export const LISTING_NATIVE_PAGE_SQL = `select l.id::text as listing_id,l.tenant_id::text,l.workspace_id::text,
  l.property_id::text,l.unit_id::text,l.version as listing_version,l.status,
  pg_catalog.to_char(l.available_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as available_from,
  case when l.available_until is null then null else
    pg_catalog.to_char(l.available_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as available_until
  from airprop.market_listings l
  where l.tenant_id=$1::uuid and l.workspace_id=$2::uuid
    and l.status in ('published','withdrawn','reserved')
    and ($3::uuid is null or l.id>$3::uuid)
  order by l.id asc limit $4::integer for share of l`;

/** Actual AIRPROP query, usable only inside an admitted server transaction scope.
 * Cursor is a scoped keyset boundary, not an authorization token. */
export async function queryListingNativePageV1(sql: CoreTransactionScopeV1, serverValue: ServerScope,
  pageValue: unknown = { limit: 100, cursor: null }): Promise<Row[]> {
  const server = scopeSchema.parse(serverValue), page = pageSchema.parse(pageValue);
  if (!sameId(sql.actor_id, server.actor_id) || !sameId(sql.workspace_id, server.workspace_id)
    || !sameId(sql.tenant_id, server.tenant_id)) throw new ListingNativeReadUnavailable('SCOPE_DENIED');
  if (page.cursor && !Object.keys(server).every(key => sameId(server[key as keyof ServerScope], page.cursor![key as keyof ServerScope]))) {
    throw new ListingNativeReadUnavailable('SCOPE_DENIED');
  }
  const result = await sql.query(LISTING_NATIVE_PAGE_SQL, [server.tenant_id, server.workspace_id, page.cursor?.after_id ?? null, page.limit]);
  const parsed = z.array(rowSchema).max(page.limit).safeParse(result.rows);
  if (!parsed.success || result.rowCount !== parsed.data.length) throw new ListingNativeReadUnavailable('SOURCE_INVALID');
  const rows = parsed.data;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], previous = i ? rows[i - 1].listing_id : page.cursor?.after_id;
    if (!sameId(row.tenant_id, server.tenant_id) || !sameId(row.workspace_id, server.workspace_id)
      || (previous && row.listing_id.toLowerCase() <= previous.toLowerCase())) throw new ListingNativeReadUnavailable('SOURCE_INVALID');
  }
  return rows;
}

/** Missing Core-owned integration, NOT an approved new Core ABI. Must open an authenticated,
 * server-resolved scoped serializable transaction without C03 command/reservation/audit writes.
 * Must await commit, discard values on error and roll back on callback failure. No retry here. */
export interface ListingNativeReadHostV1 {
  withScope<T>(actorId: string, requested: ListingScope,
    read: (sql: CoreTransactionScopeV1, server: ServerScope) => Promise<T>): Promise<{
      value: T;
      /** Actual trusted database-clock observation AFTER commit/waits, never Date.now. */
      completed_at: string;
    }>;
}
/** Trusted canonical producer only. No browser evidence, boolean allow or cached snapshot.
 * bindSelector must supply the REAL same-host post-lock receipt/request/command identity;
 * no synthesized command/lock/time. Canonical read must resolve official current Unit,
 * spec version, party and relationship, safe authorized label and actual evaluator evidence.
 * It must evaluate expiry using the database clock at/after notBefore, after any waits. */
export interface ListingCanonicalProducerV1 {
  bindSelector(sql: CoreTransactionScopeV1, server: ServerScope, row: Row): Promise<{ request: unknown; authority: unknown }>;
  readCanonical(sql: CoreTransactionScopeV1, server: ServerScope, row: Row, notBefore: string): Promise<{
    core: { request: unknown; companion: unknown; authority: unknown };
    /** Earliest REAL expiry across scope/authority/resource/relationship inputs, not a minted TTL/lease.
     * Producer unavailable if it cannot establish this bound. No null/infinite fallback. */
    current_until: string;
    /** Optional REAL canonical per-action evidence, never inferred from read. */
    action_projections?: unknown;
  }>;
}
async function databaseTime(sql: CoreTransactionScopeV1) {
  const result = await sql.query<{ at: string }>(`select pg_catalog.to_char(pg_catalog.clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`);
  if (result.rowCount !== 1) throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
  return timestamp.parse(result.rows[0]?.at);
}
async function selector(sql: CoreTransactionScopeV1, server: ServerScope, row: Row, producer: ListingCanonicalProducerV1) {
  const supplied = await producer.bindSelector(sql, server, row);
  const request = currentUnitPropertySelectorRequestV1Schema.parse(supplied.request);
  const authority = currentAuthorityTransactionDecisionReceiptV1Schema.parse(supplied.authority);
  if (!sameId(request.context_id, server.context_id) || !sameId(request.workspace_id, server.workspace_id)
    || !sameId(request.actor_id, server.actor_id) || !sameId(request.property_id, row.property_id)
    || !sameId(request.unit_id, row.unit_id)) throw new ListingNativeReadUnavailable('SCOPE_DENIED');
  // Actual accepted Core selector enforces scope/transaction/lock/authority preconditions.
  const decision = await selectCurrentUnitPropertyV1(sql, authority, request);
  if (decision.decision !== 'accepted') throw new ListingNativeReadUnavailable('SELECTOR_DENIED');
}
export function createListingNativeReadV1(host: ListingNativeReadHostV1 | null, producer: ListingCanonicalProducerV1 | null,
  selectedBindingRead: ListingSelectedBindingReaderV1 | null = null): ListingSourceRead {
  return async (actorId, requested) => {
    if (!host) throw new ListingNativeReadUnavailable('HOST_NOT_READY');
    if (!producer) throw new ListingNativeReadUnavailable('CANONICAL_PRODUCER_NOT_READY');
    const request = listingScopeSchema.parse(requested);
    const completed = await host.withScope(actorId, request, async (sql, serverValue) => {
      const server = scopeSchema.parse(serverValue);
      if (!sameId(actorId, server.actor_id) || !sameId(request.context_id, server.context_id)
        || !sameId(request.workspace_id, server.workspace_id)) throw new ListingNativeReadUnavailable('SCOPE_DENIED');
      const rows = await queryListingNativePageV1(sql, server), output = [];
      const bindingFor = async (row: Row) => {
        // A missing adoption/admission disables this connection only. Do not probe
        // an uninstalled table and then catch a PostgreSQL aborted transaction.
        if (!selectedBindingRead) return { state: 'unavailable' };
        try {
          const binding = await selectedBindingRead(sql, server.context_id, row.listing_id, row.listing_version);
          return binding === null ? { state: 'legacy' } : { state: 'record', value: {
            context_id: binding.context_id, workspace_id: binding.workspace_id, tenant_id: binding.tenant_id,
            selection: binding.selection, spec_version: binding.spec_version,
          } };
        } catch (error) {
          // Invalid returned metadata is a row-local custody failure, not denial
          // of the independent read. SQL errors (including40001) always propagate.
          if (error instanceof z.ZodError || (error instanceof Error
            && ['LISTING_BINDING_INVALID', 'LISTING_BINDING_SCOPE'].includes(error.message))) return { state: 'invalid' };
          throw error;
        }
      };
      for (const row of rows) {
        await selector(sql, server, row, producer);
        const at = await databaseTime(sql);
        const evidence = await producer.readCanonical(sql, server, row, at);
        const raw = { ...row, ...request, core: evidence.core, action_projections: evidence.action_projections,
          selected_binding: await bindingFor(row) };
        // Never construct canonical labels, versions, relationships or permission receipts.
        const mapped = (await readListingFlow(async () => [raw], actorId, request))[0];
        output.push({ raw, mapped });
      }
      // All row/selector lock waits precede final collection observation and canonical rechecks.
      const currentRows = await queryListingNativePageV1(sql, server);
      if (JSON.stringify(currentRows) !== JSON.stringify(rows)) throw new ListingNativeReadUnavailable('SOURCE_DRIFT');
      for (let i = 0; i < rows.length; i++) await selector(sql, server, rows[i], producer);
      const finalBoundary = await databaseTime(sql);
      const final = [];
      const expiries: bigint[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], evidence = await producer.readCanonical(sql, server, row, finalBoundary);
        const time = (evidence.core.request as { evaluation_time?: unknown } | null)?.evaluation_time;
        if (typeof time !== 'string' || !timestamp.safeParse(time).success || instant(time) < instant(finalBoundary)) {
          throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
        }
        const expires = timestamp.safeParse(evidence.current_until);
        if (!expires.success) throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
        expiries.push(instant(expires.data));
        const raw = { ...row, ...request, core: evidence.core, action_projections: evidence.action_projections,
          selected_binding: await bindingFor(row) };
        const mapped = (await readListingFlow(async () => [raw], actorId, request))[0];
        if (!sameSelection(output[i].mapped.selection, mapped.selection)
          || output[i].mapped.source_name !== mapped.source_name) throw new ListingNativeReadUnavailable('SOURCE_DRIFT');
        // Only actual optional per-action evidence crosses the existing mapper.
        // This slice installs no producer; stored binding/read never grants manage.
        final.push(raw);
      }
      // Non-locking clock sample after ALL producer waits: equality to expiry is denied.
      // This addresses temporal expiry, not revocation outside the held serializable snapshot.
      const disclosureTime = instant(await databaseTime(sql));
      if (expiries.some(expiry => expiry <= disclosureTime)) throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
      return { rows: final, disclosureTime, expiries };
    }); // 40001 propagates unchanged; caller must not expose a partial collection.
    const completedAt = instant(completed.completed_at);
    if (completedAt < completed.value.disclosureTime || completed.value.expiries.some(expiry => expiry <= completedAt)) {
      throw new ListingNativeReadUnavailable('CURRENTNESS_UNPROVEN');
    }
    return completed.value.rows;
  };
}
