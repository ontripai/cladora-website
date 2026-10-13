import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import { createCorePostgresTransactionHostV1 } from '../core/postgres-transaction-host-v1';
import type { CoreTransactionScopeV1 } from '../core/postgres-transaction-host-v1';
import {
  airpropB2BindingSchema, airpropB2CommandSchema,
  type AirpropB2Command,
} from './artifact-b2-contract';
import { z } from 'zod';

type Call = { sql: string; signature: string; values: unknown[]; permission: string; aggregate: string; id: string };
function callFor(command: AirpropB2Command): Call {
  const prefix = [command.context_id, command.workspace_id];
  const key = command.idempotency_key;
  const make = (name: string, types: string, values: unknown[], permission: string, aggregate: string, id: string): Call => ({
    signature: `customer_api.${name}(${types})`,
    sql: `select customer_api.${name}(${types.split(',').map((type, i) => `$${i + 1}::${type}`).join(',')}) as result`,
    values, permission, aggregate, id,
  });
  switch (command.action) {
    case 'edit_listing': case 'withdraw_listing': case 'republish_listing':
      return make('control_airprop_listing_v1', 'uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text',
        [...prefix, command.listing_id, command.action.replace('_listing', ''), command.expected_version,
          command.action === 'withdraw_listing' ? null : command.available_from,
          command.action === 'withdraw_listing' ? null : command.available_until, command.reason, key],
        'airprop.opportunity.manage', 'airprop.market_listing', command.listing_id);
    case 'cancel_reservation': case 'expire_reservation': case 'extend_reservation': case 'convert_reservation':
      return make('control_airprop_reservation_v1', 'uuid,uuid,uuid,text,integer,timestamptz,text,text,text',
        [...prefix, command.reservation_id, command.action.replace('_reservation', ''), command.expected_version,
          command.action === 'extend_reservation' ? command.reserved_until : null,
          command.action === 'convert_reservation' ? command.conversion_reference : null, command.reason, key],
        'airprop.opportunity.manage', 'airprop.exclusive_reservation', command.reservation_id);
    case 'record_obligation_schedule':
      return make('record_airprop_obligation_schedule_v1', 'uuid,uuid,uuid,text,numeric,jsonb,text,text',
        [...prefix, command.presale_contract_id, command.currency, command.total_amount, JSON.stringify(command.terms), command.financial_source_reference, key],
        'airprop.presale.execute', 'airprop.presale_contract', command.presale_contract_id);
    case 'link_execution':
      return make('link_airprop_commercial_execution_v1', 'uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text',
        [...prefix, command.property_id, command.unit_id, command.kind, command.core_record_id, JSON.stringify(command.commercial_terms), command.effective_from, command.effective_to, key],
        'airprop.asset.manage', 'portfolio.property', command.property_id);
    case 'request_management_mandate':
      return make('request_airprop_management_mandate_v1', 'uuid,uuid,uuid,uuid,jsonb,date,date,text,text',
        [...prefix, command.property_id, command.owner_party_id, JSON.stringify(command.scope), command.valid_from, command.valid_to, command.proposal_evidence_reference, key],
        'airprop.asset.manage', 'portfolio.property', command.property_id);
    case 'accept_management_mandate':
      return make('accept_airprop_management_mandate_v1', 'uuid,uuid,uuid,text,text',
        [...prefix, command.mandate_request_id, command.acceptance_evidence_reference, key],
        'airprop.asset.manage', 'airprop.management_mandate_request', command.mandate_request_id);
    case 'link_management_work_order':
      return make('link_airprop_management_work_order_v1', 'uuid,uuid,uuid,uuid,text',
        [...prefix, command.mandate_request_id, command.work_order_id, key],
        'airprop.asset.manage', 'airprop.management_mandate_request', command.mandate_request_id);
    default: throw new Error('unsupported_airprop_command');
  }
}
const domainReceipt = z.object({ version: z.literal(1), idempotent: z.boolean() }).passthrough();
const mutationId = z.string().uuid();

/** Internal composition only. No pool, credentials, activation switch or authority implementation is created here. */
export function createAirpropB2Runtime(pool: Pick<Pool, 'connect'>) {
  const host = createCorePostgresTransactionHostV1(pool);
  return {
    async execute(bindingValue: unknown, commandValue: unknown) {
      const b = airpropB2BindingSchema.safeParse(bindingValue), c = airpropB2CommandSchema.safeParse(commandValue);
      if (!b.success || !c.success) return { status: 'denied', code: 'INVALID_COMMAND' } as const;
      const binding = b.data, command = c.data;
      if (binding.context_id !== command.context_id || binding.workspace_id !== command.workspace_id
        || ('property_id' in command && command.property_id !== binding.property_id)
        || ('expected_version' in command && command.expected_version !== binding.aggregate_version)) {
        return { status: 'denied', code: 'AUTHORITY_DENIED' } as const;
      }
      const call = callFor(command);
      const envelope = {
        contract_version: 'core-transaction-command.v1', ...binding,
        permission_code: call.permission, module_code: 'airprop_commercial', evaluation_purpose: 'airprop.b2',
        aggregate_type: call.aggregate, aggregate_id: call.id,
        provider_source_ids: [binding.property_id], idempotency_key: command.idempotency_key,
        input_fingerprint: `b2:${createHash('sha256').update(JSON.stringify(command)).digest('hex')}`,
      };
      // Do not pass the Resource binding field into Core's strict command envelope.
      const { property_id: resourcePropertyId, ...coreCommand } = envelope;
      return host.execute(coreCommand, {
        resolveAuthority,
        async validateProviders(scope: CoreTransactionScopeV1) {
          const result = await scope.query<{ allowed: boolean }>(`select
            has_function_privilege('authenticated',to_regprocedure($1),'EXECUTE') as allowed`, [call.signature]);
          return result.rowCount === 1 && result.rows[0].allowed === true && resourcePropertyId === binding.property_id;
        },
        async mutate(scope: CoreTransactionScopeV1) {
          const response = await scope.query<{ result: unknown }>(call.sql, call.values);
          if (response.rowCount !== 1) throw new Error('airprop_receipt_unavailable');
          const receipt = domainReceipt.parse(response.rows[0].result);
          const id = receipt.listing_id ?? receipt.reservation_id ?? receipt.schedule_id
            ?? receipt.link_id ?? receipt.mandate_request_id ?? receipt.action_link_id;
          return { mutation_id: mutationId.parse(id) };
        },
      });
    },
  };
}
