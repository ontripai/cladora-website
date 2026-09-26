import type { Language } from '@/types';

type Translation = Record<Language, string>;

type DefaultPlan = {
  code: string;
  assetCategories: readonly string[];
  title: Translation;
  suggestedUnit: 'days' | 'weeks' | 'months' | 'years';
  suggestedEvery: number;
  steps: readonly { code: string; label: Translation }[];
};

/** Stable database codes. Suggestions are editable and do not prescribe legal inspection intervals. */
export const DEFAULT_MAINTENANCE_PLANS: readonly DefaultPlan[] = [
  {
    code: 'CLADORA_PM_ELEVATOR',
    assetCategories: ['elevator', 'lift', 'ascensor', 'pilot_test_elevator'],
    title: { ro: 'Verificarea periodică a liftului', en: 'Periodic elevator inspection', fa: 'بازدید دوره‌ای آسانسور' },
    suggestedUnit: 'months', suggestedEvery: 1,
    steps: [
      { code: 'CLADORA_PM_ELEVATOR_DOORS', label: { ro: 'Verifică ușile și mecanismul de închidere', en: 'Inspect doors and closing mechanism', fa: 'درها و سازوکار بسته‌شدن را بررسی کنید' } },
      { code: 'CLADORA_PM_ELEVATOR_ALARM', label: { ro: 'Testează alarma și comunicația de urgență', en: 'Test alarm and emergency communication', fa: 'هشدار و ارتباط اضطراری را آزمایش کنید' } },
      { code: 'CLADORA_PM_ELEVATOR_REPORT', label: { ro: 'Înregistrează constatările și intervențiile', en: 'Record findings and service actions', fa: 'یافته‌ها و اقدامات سرویس را ثبت کنید' } },
    ],
  },
  {
    code: 'CLADORA_PM_HVAC',
    assetCategories: ['hvac', 'heating', 'ventilation', 'air_conditioning', 'boiler', 'pump'],
    title: { ro: 'Întreținerea instalațiilor HVAC', en: 'HVAC preventive maintenance', fa: 'نگهداری پیشگیرانهٔ تأسیسات تهویه' },
    suggestedUnit: 'months', suggestedEvery: 3,
    steps: [
      { code: 'CLADORA_PM_HVAC_FILTER', label: { ro: 'Verifică filtrele și înregistrează intervenția', en: 'Inspect filters and record service', fa: 'فیلترها را بررسی و سرویس را ثبت کنید' } },
      { code: 'CLADORA_PM_HVAC_OPERATION', label: { ro: 'Verifică funcționarea și eventualele defecțiuni', en: 'Check operation and report faults', fa: 'کارکرد و عیب‌های احتمالی را بررسی کنید' } },
    ],
  },
  {
    code: 'CLADORA_PM_CCTV',
    assetCategories: ['cctv', 'camera', 'surveillance'],
    title: { ro: 'Verificarea sistemului de supraveghere video', en: 'CCTV system inspection', fa: 'بازدید سامانهٔ دوربین مداربسته' },
    suggestedUnit: 'months', suggestedEvery: 3,
    steps: [
      { code: 'CLADORA_PM_CCTV_CAMERAS', label: { ro: 'Verifică funcționarea camerelor autorizate', en: 'Check authorized cameras are working', fa: 'کارکرد دوربین‌های مجاز را بررسی کنید' } },
      { code: 'CLADORA_PM_CCTV_RECORDING', label: { ro: 'Verifică funcționarea înregistrării, fără a exporta imagini', en: 'Check recording works without exporting footage', fa: 'کارکرد ضبط را بدون خروجی گرفتن از تصاویر بررسی کنید' } },
    ],
  },
  {
    code: 'CLADORA_PM_FIRE_SAFETY',
    assetCategories: ['fire_safety', 'fire_alarm', 'fire_extinguisher'],
    title: { ro: 'Verificarea vizuală a echipamentelor de incendiu', en: 'Fire safety equipment visual check', fa: 'بازدید ظاهری تجهیزات ایمنی آتش‌سوزی' },
    suggestedUnit: 'months', suggestedEvery: 1,
    steps: [
      { code: 'CLADORA_PM_FIRE_ACCESS', label: { ro: 'Verifică accesul la echipamente și raportează obstacolele', en: 'Check equipment access and report obstructions', fa: 'دسترسی به تجهیزات و موانع را بررسی و گزارش کنید' } },
      { code: 'CLADORA_PM_FIRE_CONDITION', label: { ro: 'Înregistrează starea vizibilă și semnalează defectele', en: 'Record visible condition and report faults', fa: 'وضعیت ظاهری و خرابی‌ها را ثبت و گزارش کنید' } },
    ],
  },
];

export function maintenanceTemplateFor(code: string) {
  return DEFAULT_MAINTENANCE_PLANS.find((plan) => plan.code === code);
}

export function suggestedMaintenancePlans(categoryCode: string) {
  const normalized = categoryCode.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return DEFAULT_MAINTENANCE_PLANS.filter(plan => plan.assetCategories.includes(normalized));
}

export function localizedMaintenanceText(value: string, lang: Language): string {
  for (const plan of DEFAULT_MAINTENANCE_PLANS) {
    if (plan.code === value) return plan.title[lang];
    const step = plan.steps.find((item) => item.code === value);
    if (step) return step.label[lang];
  }
  return value;
}
