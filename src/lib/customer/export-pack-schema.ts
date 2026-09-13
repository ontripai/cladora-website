import {z} from 'zod';import {uuidSchema} from './dashboard-schema';import {EXPORT_FORMATS,EXPORT_REPORT_CODES} from './export-pack-renderer';
export const createExportPackSchema=z.object({context_id:uuidSchema,accounting_period_id:uuidSchema,idempotency_key:z.string().trim().min(8).max(120)}).strict();
export const downloadExportSchema=z.object({context_id:uuidSchema,report_code:z.enum(EXPORT_REPORT_CODES),format:z.enum(EXPORT_FORMATS)}).strict();
