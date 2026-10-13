import { z } from 'zod';
import {
  airpropListingControlCommandV1Schema, airpropReservationControlCommandV1Schema,
  airpropManagementMandateCommandV1Schema, airpropManagementActionLinkCommandV1Schema,
  commercialLifecycleCommandV1Schema,
} from './commercial-lifecycle-v1';

export const AIRPROP_B2_ID = 'AIRPROP-ARTIFACT-B2-20261013-R1';
export const airpropB2CommandSchema = z.union([
  airpropListingControlCommandV1Schema,
  airpropReservationControlCommandV1Schema,
  airpropManagementMandateCommandV1Schema,
  airpropManagementActionLinkCommandV1Schema,
  commercialLifecycleCommandV1Schema.refine(command =>
    command.action === 'record_obligation_schedule' || command.action === 'link_execution'),
]);
export type AirpropB2Command = z.infer<typeof airpropB2CommandSchema>;
export const airpropB2BindingSchema = z.strictObject({
  actor_id: z.string().uuid(), context_id: z.string().uuid(), workspace_id: z.string().uuid(),
  authority_version: z.number().int().positive().safe(),
  transaction_id: z.string().uuid(), command_id: z.string().uuid(),
  property_id: z.string().uuid(), aggregate_version: z.number().int().positive().safe(),
});
/** Obtained from trusted server context and canonical Resource resolution, never request JSON. */
export type AirpropB2Binding = z.infer<typeof airpropB2BindingSchema>;
export function airpropB2Controls() {
  return { artifact_id: AIRPROP_B2_ID, commands: null, can_edit: false, state: 'pre_activation' } as const;
}
