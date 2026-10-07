import {z} from 'zod';
import {maintenanceUuidSchema} from './maintenance-schema';
export {maintenanceUuidSchema as contractorUuidSchema};
export const contractorMutationSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),context_id:maintenanceUuidSchema,id:maintenanceUuidSchema,name:z.string().trim().min(1).max(200),category:z.enum(['ventilation','pump','elevator','fire_safety','other'])}).strict(),
 z.object({action:z.literal('approve'),context_id:maintenanceUuidSchema,vendor_id:maintenanceUuidSchema,reason:z.string().trim().min(10).max(500)}).strict(),
]);
