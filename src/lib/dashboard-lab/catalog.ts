import {CANONICAL_ROLES} from '@/lib/customer/access-matrix';
import type {Language} from '@/types';
export const PLATFORM_LAB_ROLES=['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR'] as const;
export const LAB_ROLES=[...CANONICAL_ROLES,'multi_unit_owner',...PLATFORM_LAB_ROLES] as const;
export type LabRole=typeof LAB_ROLES[number];
const names:Record<LabRole,Record<Language,string>>={
 association_admin:{ro:'Administrator asociație',en:'Association administrator',fa:'مدیر ساختمان'},
 property_manager:{ro:'Manager proprietăți',en:'Property manager',fa:'مدیر املاک'},
 president:{ro:'Președinte',en:'President',fa:'رئیس هیئت‌مدیره'},
 censor:{ro:'Cenzor',en:'Financial inspector',fa:'بازرس مالی'},
 owner:{ro:'Proprietar',en:'Unit owner',fa:'مالک واحد'},
 tenant_resident:{ro:'Chiriaș / rezident',en:'Tenant / resident',fa:'مستأجر / ساکن'},
 multi_unit_owner:{ro:'Proprietar cu mai multe unități',en:'Multi-unit owner',fa:'مالک چندواحدی'},
 PLATFORM_SUPER_ADMIN:{ro:'Superadministrator',en:'Super administrator',fa:'سوپرادمین'},
 PLATFORM_OPERATIONS:{ro:'Operațiuni platformă',en:'Platform operations',fa:'عملیات پلتفرم'},
 PLATFORM_FINANCE:{ro:'Finanțe platformă',en:'Platform finance',fa:'مالی پلتفرم'},
 PLATFORM_SUPPORT:{ro:'Suport platformă',en:'Platform support',fa:'پشتیبانی پلتفرم'},
 PLATFORM_AUDITOR:{ro:'Auditor platformă',en:'Platform auditor',fa:'ممیز پلتفرم'},
};
export const labRoleName=(role:LabRole,lang:Language)=>names[role][lang];
export const isLabRole=(value:string):value is LabRole=>LAB_ROLES.some(role=>role===value);
