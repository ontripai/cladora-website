import {PROPERTY_PROFILES,OPERATING_MODELS} from './taxonomy';
import type {Language} from '@/types';
export const REGISTRY_VERSION='2026-09-26.1';
export type Requirement='recommended'|'optional'|'off';
export type Readiness='operational_slice'|'partial'|'read_model'|'planned';
type Label=Record<Language,string>;
export type Core={code:string;name:Label;modules:string[];routes:string[];status:Readiness;gap:Label};
const l=(fa:string,ro:string,en:string):Label=>({fa,ro,en});
export const CORES:Core[]=[
 {code:'C01',name:l('حسابداری','Contabilitate','Accounting'),modules:['accounting'],routes:['accounting','accounting/month-close','accounting/reports'],status:'partial',gap:l('رابط همه دفاتر قانونی و صندوق‌ها کامل نیست.','Interfața registrelor statutare și fondurilor este incompletă.','Statutory registers and funds UI is incomplete.')},
 {code:'C02',name:l('تسهیم هزینه','Alocarea costurilor','Cost allocation'),modules:['accounting','billing'],routes:['accounting/allocations'],status:'read_model',gap:l('نمای تسهیم فقط‌خواندنی؛ مدیریت کامل قواعد نیازمند تکمیل است.','Vizualizare doar pentru citire; administrarea regulilor rămâne de completat.','Read-only allocation view; rule management needs completion.')},
 {code:'C03',name:l('خزانه و پرداخت','Plăți și trezorerie','Treasury and payments'),modules:['payments'],routes:['payments','reconciliation'],status:'partial',gap:l('پرداخت کارتی واقعی به ارائه‌دهنده متصل نیست.','Plățile cu cardul nu au un furnizor live conectat.','Live card provider is not connected.')},
 {code:'C04',name:l('مطالبات و وصول','Creanțe și recuperare','Receivables and collection'),modules:['billing'],routes:['billing','receivables'],status:'partial',gap:l('تقسیط و وصول حقوقی کامل نیست.','Eșalonarea și recuperarea juridică sunt incomplete.','Installments and legal collection are incomplete.')},
 {code:'C05',name:l('حقوقی و مالیاتی','Conformitate și fiscalitate','Legal and tax compliance'),modules:['documents'],routes:['documents'],status:'partial',gap:l('اسناد موجود است؛ تقویم جامع مالیاتی مستقل آماده نیست.','Documente disponibile; calendarul fiscal complet nu este disponibil.','Documents exist; a complete tax calendar is not available.')},
 {code:'C06',name:l('املاک و سکونت','Proprietăți și ocupare','Properties and occupancy'),modules:['occupancy'],routes:['occupancy','ownership','leases'],status:'operational_slice',gap:l('گردش‌کار پایه موجود؛ پذیرش هر نوع ملک باید آزموده شود.','Flux de bază disponibil; acceptanța fiecărui profil trebuie testată.','Core workflow exists; each property profile needs acceptance testing.')},
 {code:'C07',name:l('تجهیزات و شناسنامه فنی','Active și registru tehnic','Assets and technical registry'),modules:['maintenance'],routes:['assets'],status:'operational_slice',gap:l('تجهیزات، بازرسی و ضمانت موجود؛ پیوند برنامه سرویس در حال تکمیل.','Active, inspecții și garanții disponibile; legătura cu planurile este în lucru.','Assets, inspections and warranties exist; service-plan linkage is in progress.')},
 {code:'C08',name:l('کنتورها و مصرف','Contoare și consum','Meters and consumption'),modules:['utilities'],routes:['utilities','meters'],status:'operational_slice',gap:l('ثبت و تأیید موجود؛ اتصال هوشمند تجهیزات باید جدا آزموده شود.','Înregistrare și verificare disponibile; integrările inteligente necesită teste separate.','Recording and approval exist; smart device integrations need separate testing.')},
 {code:'C09',name:l('تعمیر و نگهداری','Mentenanță','Maintenance'),modules:['maintenance'],routes:['maintenance'],status:'partial',gap:l('دستورکار موجود؛ برنامه ثابت دوره‌ای باید تکمیل شود.','Comenzi disponibile; planificarea periodică trebuie completată.','Work orders exist; recurring preventive scheduling needs completion.')},
 {code:'C10',name:l('پیمانکاران و قراردادها','Furnizori și contracte','Vendors and contracts'),modules:['maintenance'],routes:['vendors','vendor-contracts','procurement','purchase-orders'],status:'partial',gap:l('خرید و استعلام موجود؛ مدیریت جامع قراردادها کامل نیست.','Achiziții disponibile; administrarea completă a contractelor este incompletă.','Procurement exists; complete contract administration is unfinished.')},
 {code:'C11',name:l('اطلاع‌رسانی','Comunicări','Communications'),modules:['communications'],routes:['communications','notifications'],status:'operational_slice',gap:l('انتشار و شواهد تحویل موجود؛ کانال‌های خارجی نیازمند بررسی تنظیمات‌اند.','Publicare și dovezi disponibile; canalele externe depind de configurare.','Publishing and evidence exist; external channels depend on configuration.')},
 {code:'C12',name:l('مجامع و رأی‌گیری','Guvernanță și vot','Governance and voting'),modules:['governance'],routes:['governance','meetings'],status:'operational_slice',gap:l('گردش‌کار موجود؛ مدل‌های غیرانجمنی پذیرش جدا می‌خواهند.','Flux disponibil; modelele fără asociație necesită acceptanță separată.','Workflow exists; non-association models need separate acceptance.')},
 {code:'C13',name:l('مشاعات و پارکینگ','Spații comune și parcare','Amenities and parking'),modules:[],routes:[],status:'planned',gap:l('رزرو و تخصیص پارکینگ هنوز پیاده نشده است.','Rezervarea și alocarea parcărilor nu sunt implementate.','Parking reservations and allocation are not implemented.')},
 {code:'C14',name:l('تحلیل و مقایسه هزینه','Analiză comparativă','Cost benchmarking'),modules:[],routes:[],status:'planned',gap:l('مقایسه منطقه‌ای هنوز آماده نیست.','Comparația regională nu este disponibilă.','Regional benchmarking is not available.')},
 {code:'C15',name:l('صرفه‌جویی و ارزش','Economii și valoare','Savings and value'),modules:[],routes:[],status:'planned',gap:l('ثبت مستقل صرفه‌جویی و ارزش آماده نیست.','Registrul separat al economiilor și valorii nu este disponibil.','Dedicated savings and valuation registry is not available.')},
 {code:'C16',name:l('ورود و مهاجرت اطلاعات','Import și migrare','Import and migration'),modules:[],routes:['onboarding','building-setup'],status:'partial',gap:l('ورود کنترل‌شده موجود؛ صفحه مستقل دفتر موازی هنوز بسته است.','Import controlat disponibil; pagina Shadow Ledger rămâne închisă.','Controlled import exists; standalone Shadow Ledger is still closed.')},
 {code:'C17',name:l('امنیت و ممیزی','Securitate și audit','Security and audit'),modules:['documents','security'],routes:['audit','documents','security-access','settings/roles'],status:'partial',gap:l('امنیت پایه عملیاتی؛ تردد فقط‌خواندنی و رابط تفویض ناقص است.','Securitate de bază disponibilă; accesul fizic este doar pentru citire, delegarea incompletă.','Core security exists; physical access is read-only and delegation UI incomplete.')},
];
// Product requirements, NOT grants or a statement of legal obligations.
export function requirement(core:string,profile:string,model:string):Requirement{
 if(!CORES.some(c=>c.code===core))throw Error('UNKNOWN_CORE');
 if(!PROPERTY_PROFILES.some(p=>p.code===profile)||!OPERATING_MODELS.some(m=>m.code===model))throw Error('UNKNOWN_TAXONOMY');
 if(['C01','C03','C05','C06','C07','C09','C10','C17'].includes(core))return 'recommended';
 if(core==='C02')return ['single_villa','small_landlord_portfolio'].includes(profile)&&model==='single_owner_operated'?'off':'recommended';
 if(core==='C04')return profile==='single_villa'&&model==='single_owner_operated'?'optional':'recommended';
 if(core==='C08')return 'recommended';
 if(core==='C11')return ['single_villa','small_landlord_portfolio'].includes(profile)?'optional':'recommended';
 if(core==='C12')return ['association_managed','multi_owner_contractual','mixed_authority'].includes(model)?'recommended':'off';
 if(core==='C13')return ['standalone_parking','shared_facility','residential_complex','gated_villa_community','retail_centre','managed_township'].includes(profile)?'recommended':'optional';
 return 'optional';
}
export type RoleUse='manage'|'review'|'own'|'internal'|'none';
export function roleUse(core:string,role:string):RoleUse{
 if(role.startsWith('PLATFORM_'))return 'internal';
 if(['association_admin','property_manager'].includes(role))return 'manage';
 if(role==='president'||role==='censor')return 'review';
 if(role==='multi_unit_owner')return ['C01','C03','C04','C05','C06','C07','C09','C10','C15','C16','C17'].includes(core)?'own':'none';
 if(role==='owner')return ['C02','C03','C04','C06','C08','C09','C11','C12','C13','C17'].includes(core)?'own':'none';
 if(role==='tenant_resident')return ['C03','C04','C06','C08','C09','C11','C13','C17'].includes(core)?'own':'none';
 return 'none';
}
