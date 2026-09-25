import type { Language } from '@/types';

// Marketing intake taxonomy. This does not grant modules or create a workspace.
export const PILOT_WORKSPACE_TYPES = {
  residential: { ro: 'Rezidențial', en: 'Residential', fa: 'مسکونی', subtypes: {
    block: { ro: 'Bloc de apartamente', en: 'Apartment block', fa: 'بلوک آپارتمانی' },
    tower: { ro: 'Turn rezidențial', en: 'Residential tower', fa: 'برج مسکونی' },
    complex: { ro: 'Ansamblu cu mai multe clădiri', en: 'Multi-building complex', fa: 'مجتمع چندساختمانی' },
    villas: { ro: 'Comunitate de vile', en: 'Villa community', fa: 'شهرک ویلایی' },
    historic: { ro: 'Imobil istoric', en: 'Historic building', fa: 'ساختمان تاریخی' },
  } },
  commercial: { ro: 'Comercial', en: 'Commercial', fa: 'تجاری', subtypes: {
    building: { ro: 'Clădire comercială', en: 'Commercial building', fa: 'ساختمان تجاری' },
    centre: { ro: 'Centru comercial', en: 'Shopping centre', fa: 'مرکز تجاری' },
    units: { ro: 'Ansamblu de spații comerciale', en: 'Commercial unit complex', fa: 'مجموعه واحدهای تجاری' },
  } },
  retail: { ro: 'Retail / magazine', en: 'Retail / shops', fa: 'فروشگاهی', subtypes: {
    shop: { ro: 'Magazin individual', en: 'Single shop', fa: 'فروشگاه مستقل' },
    shops: { ro: 'Ansamblu de magazine', en: 'Group of shops', fa: 'مجموعه فروشگاه‌ها' },
    market: { ro: 'Piață / galerie comercială', en: 'Market / retail arcade', fa: 'بازار یا پاساژ' },
  } },
  office: { ro: 'Birouri', en: 'Office', fa: 'اداری', subtypes: {
    building: { ro: 'Clădire de birouri', en: 'Office building', fa: 'ساختمان اداری' },
    campus: { ro: 'Campus de birouri', en: 'Office campus', fa: 'پردیس اداری' },
    suites: { ro: 'Ansamblu de birouri', en: 'Office suite complex', fa: 'مجموعه دفاتر' },
  } },
  industrial: { ro: 'Industrial / logistic', en: 'Industrial / logistics', fa: 'صنعتی / لجستیکی', subtypes: {
    factory: { ro: 'Fabrică', en: 'Factory', fa: 'کارخانه' },
    workshop: { ro: 'Atelier', en: 'Workshop', fa: 'کارگاه' },
    warehouse: { ro: 'Depozit', en: 'Warehouse', fa: 'انبار' },
    logistics: { ro: 'Centru logistic', en: 'Logistics centre', fa: 'مرکز لجستیک' },
    park: { ro: 'Parc industrial', en: 'Industrial park', fa: 'پارک صنعتی' },
  } },
  mixed: { ro: 'Utilizare mixtă', en: 'Mixed use', fa: 'چندمنظوره', subtypes: {
    residential_commercial: { ro: 'Rezidențial–comercial', en: 'Residential–commercial', fa: 'مسکونی–تجاری' },
    residential_office: { ro: 'Rezidențial–birouri', en: 'Residential–office', fa: 'مسکونی–اداری' },
    commercial_office: { ro: 'Comercial–birouri', en: 'Commercial–office', fa: 'تجاری–اداری' },
    other: { ro: 'Altă combinație', en: 'Other combination', fa: 'ترکیب دیگر' },
  } },
  shared: { ro: 'Comun între clădiri', en: 'Shared across buildings', fa: 'مشترک بین ساختمان‌ها', subtypes: {
    utilities: { ro: 'Instalații comune', en: 'Shared utilities', fa: 'تأسیسات مشترک' },
    parking: { ro: 'Parcare comună', en: 'Shared parking', fa: 'پارکینگ مشترک' },
    grounds: { ro: 'Curți / servicii comune', en: 'Shared grounds / services', fa: 'محوطه یا خدمات مشترک' },
    other: { ro: 'Alt spațiu comun', en: 'Other shared space', fa: 'فضای مشترک دیگر' },
  } },
  other: { ro: 'Alt tip — descrieți', en: 'Other — describe', fa: 'سایر — توضیح دهید', subtypes: {} },
} as const;

export type PilotWorkspaceType = keyof typeof PILOT_WORKSPACE_TYPES;
export const pilotWorkspaceTypes = Object.keys(PILOT_WORKSPACE_TYPES) as PilotWorkspaceType[];
export function pilotWorkspaceSubtypeValid(type: PilotWorkspaceType, subtype: string): boolean {
  return type === 'other' ? subtype === '' : Object.hasOwn(PILOT_WORKSPACE_TYPES[type].subtypes, subtype);
}
export function pilotWorkspaceLabel(type: PilotWorkspaceType, lang: Language): string {
  return PILOT_WORKSPACE_TYPES[type][lang];
}
